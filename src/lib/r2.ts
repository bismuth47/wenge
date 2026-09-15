export type R2File = { key: string; url: string; size: number; uploadedAt: string };
export type R2List = { files: R2File[]; folders: string[]; prefix: string; note?: string };

/** Drag payload shared between Explorer (source) and Desktop (target). */
export const R2_DRAG_MIME = "application/x-wenge-r2";
/** 修飾キー付きドロップの動作 (Win準拠: 無修飾=move / Ctrl=copy / Alt=shortcut) */
export type WengeDropAction = "move" | "copy" | "shortcut";
export type WengeDropModifiers = { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean };
export function resolveDropAction(mod?: WengeDropModifiers, fallback: WengeDropAction = "move"): WengeDropAction {
  if (mod?.altKey) return "shortcut";
  if (mod?.ctrlKey) return "copy";
  return fallback;
}
/** bodyに付与してDnD中のカーソルを move_hand.png に固定するためのクラス */
export const WENGE_DRAGGING_CLASS = "wenge-dragging";
export function markWengeDragStart() {
  try { document.body.classList.add(WENGE_DRAGGING_CLASS); } catch {}
}
export function markWengeDragEnd() {
  try { document.body.classList.remove(WENGE_DRAGGING_CLASS); } catch {}
}
export type R2DragItem =
  | { kind: "file"; key: string; name: string; url: string; size: number; mime: string }
  | { kind: "folder"; prefix: string; name: string }
  | { kind: "vfs-file"; id: string; name: string; mime: string; size: number }
  /** 実体のない仮想エントリ (C:\系静的表示など)。ドロップ先でショートカット化する */
  | { kind: "shortcut"; label: string; appId?: string; explorerPath?: string; iconSrc?: string; vfsId?: string; r2Key?: string; r2Prefix?: string; r2Mime?: string; r2Size?: number };

export function normalizePrefix(p: string): string {
  const s = p.replace(/^\/+/, "");
  if (!s) return "";
  return s.endsWith("/") ? s : s + "/";
}

export function r2NameOfKey(key: string): string {
  const s = key.replace(/\/$/, "");
  const i = s.lastIndexOf("/");
  return i >= 0 ? s.slice(i + 1) : s;
}

export function formatR2Path(prefix: string): string {
  const p = normalizePrefix(prefix);
  if (!p) return "R2:\\";
  return "R2:\\" + p.replace(/\//g, "\\").replace(/\\$/, "");
}

export async function listR2(prefix: string): Promise<R2List> {
  const p = normalizePrefix(prefix);
  const res = await fetch(`/api/files?prefix=${encodeURIComponent(p)}`);
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  const data = await res.json();
  return {
    files: data.files ?? [],
    folders: data.folders ?? [],
    prefix: data.prefix ?? p,
    note: data.note,
  };
}

/** Flat recursive list used when copying a whole folder to the desktop. */
export async function listR2Flat(prefix: string): Promise<R2File[]> {
  const p = normalizePrefix(prefix);
  const res = await fetch(`/api/files?prefix=${encodeURIComponent(p)}&flat=1`);
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  const data = await res.json();
  const files: R2File[] = data.files ?? [];
  // Exclude the folder placeholder itself
  return files.filter((f) => f.key !== p);
}

export async function presignUpload(key: string, contentType: string): Promise<{ url: string; key: string }> {
  const clean = key.replace(/^\/+/, "");
  const res = await fetch("/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ presign: true, key: clean, contentType }),
  });
  if (!res.ok) throw new Error(`presign failed: ${res.status}`);
  return res.json();
}

export async function uploadToR2(prefix: string, file: File): Promise<string> {
  const p = normalizePrefix(prefix);
  const key = `${p}${file.name}`;
  let url: string;
  try {
    ({ url } = await presignUpload(key, file.type || "application/octet-stream"));
  } catch (e: any) {
    throw new Error(`upload failed at presign step: ${e?.message || e}`);
  }
  try {
    const put = await fetch(url, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
    if (!put.ok) throw new Error(`PUT ${put.status}`);
  } catch (e: any) {
    if (e instanceof TypeError) {
      throw new Error(
        "upload failed at PUT step (network/CORS): browser could not reach R2. Check the bucket CORS policy."
      );
    }
    throw new Error(`upload failed at PUT step: ${e?.message || e}`);
  }
  return key;
}

export async function createR2Folder(prefix: string, name: string): Promise<string> {
  const clean = name.trim().replace(/^\/+|\/+$/g, "").replace(/\.\./g, "");
  if (!clean) throw new Error("folder name is required");
  const key = `${normalizePrefix(prefix)}${clean}/`;
  const res = await fetch("/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mkdir: true, key }),
  });
  if (!res.ok) throw new Error(`mkdir failed: ${res.status}`);
  const data = await res.json();
  return data.key ?? key;
}

export async function deleteR2Key(key: string): Promise<void> {
  const res = await fetch(`/api/files?key=${encodeURIComponent(key)}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `delete failed: ${res.status}`);
  }
}

export function guessMime(name: string, fallback = "application/octet-stream"): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    txt: "text/plain", md: "text/markdown", html: "text/html", css: "text/css",
    js: "text/javascript", json: "application/json", png: "image/png",
    jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp",
    webp: "image/webp", svg: "image/svg+xml", mp3: "audio/mpeg", wav: "audio/wav",
    mp4: "video/mp4", pdf: "application/pdf",
  };
  return map[ext] || fallback;
}
