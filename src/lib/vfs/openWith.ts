import type { VfsFile } from "./types";

export type VfsOpenTarget = "notepad" | "wordpad" | "image-viewer" | "media-player" | "preview" | "explorer" | "ie" | "msdos";

const TEXT_EXTS = new Set(["txt", "md", "markdown", "json", "js", "ts", "tsx", "css", "xml", "csv", "log", "ini"]);
const HTML_EXTS = new Set(["html"]);
const BAT_EXTS = new Set(["bat"]);
const DOC_EXTS = new Set(["doc", "rtf"]);
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "m4a", "flac", "mid", "midi"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "ogv", "mov"]);

export function vfsOpenTarget(file: VfsFile): VfsOpenTarget {
  const mime = (file.mime || "").toLowerCase();
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (HTML_EXTS.has(ext)) return "ie";
  if (mime.startsWith("image/") || IMAGE_EXTS.has(ext)) return "image-viewer";
  if (mime.startsWith("audio/") || mime.startsWith("video/") || AUDIO_EXTS.has(ext) || VIDEO_EXTS.has(ext)) return "media-player";
  if (mime === "application/pdf" || ext === "pdf") return "preview";
  if (BAT_EXTS.has(ext)) return "msdos";
  if (mime.startsWith("text/") || TEXT_EXTS.has(ext)) return "notepad";
  if (DOC_EXTS.has(ext)) return "wordpad";
  return "explorer";
}

/** Pending file opened via double-click — consumed by Notepad/MediaPlayer/ImageViewer on mount. */
const PENDING_KEY = "wenge_vfs_pending";

export function setPendingVfsFile(file: VfsFile) {
  try {
    // Blob can't go through localStorage; keep in-memory + expose object URL.
    (window as any).__wengePendingVfs = file;
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ id: file.id, name: file.name, mime: file.mime }));
  } catch {}
}

export function consumePendingVfsFile(): VfsFile | null {
  try {
    const f = (window as any).__wengePendingVfs as VfsFile | undefined;
    if (f) {
      delete (window as any).__wengePendingVfs;
      try { sessionStorage.removeItem(PENDING_KEY); } catch {}
      return f;
    }
  } catch {}
  return null;
}

export function peekPendingVfsMeta(): { id: string; name: string; mime: string } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
