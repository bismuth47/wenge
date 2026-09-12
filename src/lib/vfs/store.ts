import { useCallback, useEffect, useState } from "react";
import { VFS_DIRS_STORE, VFS_FILES_STORE, vfsTx } from "./db";
import { normalizeVfsDir, normalizeVfsPath, vfsBasename, vfsDirname, vfsJoin } from "./path";
import { newVfsId, type VfsDir, type VfsFile } from "./types";
import { guessMime } from "../r2";

export const VFS_CHANGED_EVENT = "wenge:vfs-changed";

export function notifyVfsChanged(dir?: string) {
  try {
    window.dispatchEvent(new CustomEvent<string | undefined>(VFS_CHANGED_EVENT, { detail: dir }));
  } catch {}
}

function uniquePath(dir: string, name: string, taken: Set<string>): string {
  const base = name || "file";
  const lower = (s: string) => s.toLowerCase();
  const takenLower = new Set([...taken].map(lower));
  let candidate = vfsJoin(dir, base);
  if (!takenLower.has(lower(candidate))) return candidate;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  for (let i = 2; i < 1000; i++) {
    candidate = vfsJoin(dir, `${stem} (${i})${ext}`);
    if (!takenLower.has(lower(candidate))) return candidate;
  }
  return vfsJoin(dir, `${stem}-${Date.now()}${ext}`);
}

export async function listVfsDir(dir: string): Promise<VfsFile[]> {
  const d = normalizeVfsDir(dir);
  try {
    const all = await vfsTx<VfsFile[]>(VFS_FILES_STORE, "readonly", (t) =>
      t.objectStore(VFS_FILES_STORE).getAll()
    );
    return all
      .filter((f) => f && normalizeVfsDir(f.dir) === d)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function listVfsDirs(): Promise<VfsDir[]> {
  try {
    return await vfsTx<VfsDir[]>(VFS_DIRS_STORE, "readonly", (t) =>
      t.objectStore(VFS_DIRS_STORE).getAll()
    );
  } catch {
    return [];
  }
}

export async function ensureVfsDir(dir: string): Promise<void> {
  const d = normalizeVfsDir(dir);
  try {
    await vfsTx([VFS_DIRS_STORE], "readwrite", (t) => {
      const store = t.objectStore(VFS_DIRS_STORE);
      const now = new Date().toISOString();
      const get = store.get(d);
      get.onsuccess = () => {
        if (!get.result) {
          try { store.put({ path: d, createdAt: now } as VfsDir); } catch {}
        }
      };
      // return a dummy request; completion tracked via transaction
      return store.get(d);
    });
  } catch {}
}

export async function saveBlobToVfs(opts: {
  blob: Blob;
  dir?: string;
  /** full path wins over dir+name */
  path?: string;
  name?: string;
  mime?: string;
  sourceUrl?: string;
  sourceR2Key?: string;
}): Promise<VfsFile> {
  const dir = normalizeVfsDir(opts.dir ?? "C:/Wenge/Downloads");
  await ensureVfsDir(dir);
  const siblings = await listVfsDir(dir);
  const taken = new Set(siblings.map((f) => normalizeVfsPath(f.path)));
  const rawName = opts.name || vfsBasename(opts.path ?? "") || "file";
  const safeName = rawName.split("/").pop()!.split("\\").pop() || "file";
  const path = opts.path
    ? uniquePath(vfsDirname(opts.path), vfsBasename(opts.path), new Set())
    : uniquePath(dir, safeName, taken);
  const now = new Date().toISOString();
  const file: VfsFile = {
    id: newVfsId(),
    path,
    name: vfsBasename(path),
    dir: vfsDirname(path),
    mime: opts.mime || opts.blob.type || guessMime(safeName),
    size: opts.blob.size,
    createdAt: now,
    updatedAt: now,
    sourceUrl: opts.sourceUrl,
    sourceR2Key: opts.sourceR2Key,
    blob: opts.blob,
  };
  await ensureVfsDir(file.dir);
  await vfsTx(VFS_FILES_STORE, "readwrite", (t) => t.objectStore(VFS_FILES_STORE).put(file));
  notifyVfsChanged(file.dir);
  return file;
}

export async function deleteVfsFile(id: string): Promise<string | undefined> {
  let dir: string | undefined;
  try {
    const all = await vfsTx<VfsFile[]>(VFS_FILES_STORE, "readonly", (t) =>
      t.objectStore(VFS_FILES_STORE).getAll()
    );
    dir = all.find((f) => f.id === id)?.dir;
  } catch {}
  await vfsTx(VFS_FILES_STORE, "readwrite", (t) => t.objectStore(VFS_FILES_STORE).delete(id));
  notifyVfsChanged(dir);
  return dir;
}

export async function getVfsFile(id: string): Promise<VfsFile | undefined> {
  try {
    return await vfsTx<VfsFile | undefined>(VFS_FILES_STORE, "readonly", (t) =>
      t.objectStore(VFS_FILES_STORE).get(id)
    );
  } catch {
    return undefined;
  }
}

export async function mkdirVfs(dir: string): Promise<void> {
  await ensureVfsDir(dir);
  notifyVfsChanged(normalizeVfsDir(dir));
}

/** React hook: watch one VFS directory (Desktop icons auto-update). */
export function useVfsDirectory(dir: string): { files: VfsFile[]; loading: boolean; refresh: () => void } {
  const norm = normalizeVfsDir(dir);
  const [files, setFiles] = useState<VfsFile[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listVfsDir(norm)
      .then((rows) => { if (!cancelled) setFiles(rows); })
      .catch(() => { if (!cancelled) setFiles([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [norm]);

  useEffect(() => {
    const cleanup = refresh();
    const onChange = (e: Event) => {
      const changed = (e as CustomEvent<string | undefined>).detail;
      if (!changed || normalizeVfsDir(changed) === norm) refresh();
    };
    window.addEventListener(VFS_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(VFS_CHANGED_EVENT, onChange);
      cleanup?.();
    };
  }, [refresh, norm]);

  return { files, loading, refresh };
}

export function openVfsFileInNewTab(file: VfsFile) {
  const url = URL.createObjectURL(file.blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadVfsFileToMachine(file: VfsFile) {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
