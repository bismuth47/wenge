/**
 * Back-compat wrapper: old `docs` (Desktop) API on top of the unified VFS.
 * New code should use src/lib/vfs/store.ts directly.
 */
import { deleteVfsFile, listVfsDir, notifyVfsChanged, saveBlobToVfs, VFS_CHANGED_EVENT } from "./vfs/store";
import { VFS_DESKTOP, type VfsFile } from "./vfs/types";

export type DesktopDoc = {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
  sourceR2Key?: string;
  blob: Blob;
};

function toLegacy(f: VfsFile): DesktopDoc {
  return { id: f.id, name: f.path.replace(/^C:\/Desktop\//i, "") || f.name, mime: f.mime, size: f.size, createdAt: f.createdAt, sourceR2Key: f.sourceR2Key, blob: f.blob };
}

/** Re-exported so Desktop state can also subscribe to VFS changes. */
export { VFS_CHANGED_EVENT };

export async function saveDocFromBlob(opts: {
  name: string; mime: string; blob: Blob; sourceR2Key?: string;
}): Promise<DesktopDoc> {
  const f = await saveBlobToVfs({ blob: opts.blob, dir: VFS_DESKTOP, name: opts.name, mime: opts.mime, sourceR2Key: opts.sourceR2Key });
  // saveBlobToVfs already notified; keep legacy listeners working too
  notifyVfsChanged(VFS_DESKTOP);
  return toLegacy(f);
}

export async function listDesktopDocs(): Promise<DesktopDoc[]> {
  try {
    return (await listVfsDir(VFS_DESKTOP)).map(toLegacy);
  } catch {
    return [];
  }
}

export async function deleteDesktopDoc(id: string): Promise<void> {
  await deleteVfsFile(id);
}

export function downloadDesktopDoc(doc: DesktopDoc) {
  const url = URL.createObjectURL(doc.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.name.split("/").pop() || doc.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function previewDesktopDoc(doc: DesktopDoc) {
  const url = URL.createObjectURL(doc.blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function docIconKey(id: string): string {
  return `doc:${id}`;
}

export function isDocIconKey(key: string): boolean {
  return key.startsWith("doc:");
}

export function docIdFromKey(key: string): string {
  return key.slice("doc:".length);
}
