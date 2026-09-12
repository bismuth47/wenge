import { showDownloadChoice, showError, showInfo } from "../components/SystemDialog";
import { downloadBlobToMachine } from "./downloads";
import { saveBlobToVfs } from "./vfs/store";
import { VFS_DOWNLOADS, VFS_MEDIA, VFS_DESKTOP, VFS_DOCUMENTS } from "./vfs/types";

export type DownloadTarget = "machine" | "wenge";
export type DownloadSetting = "ask" | DownloadTarget;

const KEY = "wenge_dl_target";
export const DL_TARGET_EVENT = "wenge:dl-target";

export function getDownloadSetting(): DownloadSetting {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "machine" || v === "wenge" || v === "ask") return v;
  } catch {}
  return "ask";
}

export function setDownloadSetting(v: DownloadSetting) {
  try {
    localStorage.setItem(KEY, v);
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent<DownloadSetting>(DL_TARGET_EVENT, { detail: v }));
  } catch {}
}

/** ファイル拡張子に応じたVFS保存先ディレクトリを返す */
export function getVfsDirByExt(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    mp3: VFS_MEDIA, wav: VFS_MEDIA, ogg: VFS_MEDIA, m4a: VFS_MEDIA, flac: VFS_MEDIA, mid: VFS_MEDIA,
    png: VFS_DESKTOP, jpg: VFS_DESKTOP, jpeg: VFS_DESKTOP, gif: VFS_DESKTOP, bmp: VFS_DESKTOP,
    webp: VFS_DESKTOP, svg: VFS_DESKTOP, ico: VFS_DESKTOP,
    txt: VFS_DOCUMENTS, md: VFS_DOCUMENTS, json: VFS_DOCUMENTS, js: VFS_DOCUMENTS, ts: VFS_DOCUMENTS,
    html: VFS_DOCUMENTS, htm: VFS_DOCUMENTS, css: VFS_DOCUMENTS, xml: VFS_DOCUMENTS,
    pdf: VFS_DOCUMENTS, doc: VFS_DOCUMENTS, rtf: VFS_DOCUMENTS,
  };
  return map[ext] ?? VFS_DOWNLOADS;
}

export type DownloadSource = {
  /** display name (may include a virtual folder prefix like "photos/a.png") */
  name: string;
  mime?: string;
  /** remote URL to fetch when no blob is given */
  url?: string;
  /** already-available bytes (preferred over url) */
  blob?: Blob;
  sourceR2Key?: string;
  /** VFS dir for "inside Wenge" saves. Defaults to directory based on file extension */
  targetDir?: string;
};

async function resolveBlob(src: DownloadSource): Promise<{ blob: Blob; mime: string }> {
  if (src.blob) return { blob: src.blob, mime: src.blob.type || src.mime || "application/octet-stream" };
  if (!src.url) throw new Error("No file data available.");
  const res = await fetch(src.url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const blob = await res.blob();
  return { blob, mime: blob.type || src.mime || "application/octet-stream" };
}

/**
 * Single entry point for every in-OS download action.
 * Default is "Wenge内" (VFS) unless remembered otherwise.
 * File extension determines the VFS destination directory.
 */
export async function handleDownload(src: DownloadSource): Promise<void> {
  const displayName = src.name.split("/").pop() || src.name;
  let setting = getDownloadSetting();
  if (setting === "ask") {
    const choice = await showDownloadChoice(displayName);
    if (!choice) return; // cancelled
    if (choice.remember) setDownloadSetting(choice.target);
    setting = choice.target;
  }
  if (setting === "machine") {
    if (src.blob) {
      downloadBlobToMachine(displayName, src.blob);
      return;
    }
    if (!src.url) {
      showError("Download", "No file data available.");
      return;
    }
    try {
      const { blob } = await resolveBlob(src);
      downloadBlobToMachine(displayName, blob);
    } catch (e: any) {
      showError("Download", e?.message || "Download failed.");
    }
    return;
  }
  // Inside Wenge: persist bytes to the VFS (auto-selected dir by extension)
  try {
    const { blob, mime } = await resolveBlob(src);
    const dir = (src as { targetDir?: string }).targetDir ?? getVfsDirByExt(src.name);
    await saveBlobToVfs({ name: src.name, dir, mime, blob, sourceR2Key: src.sourceR2Key, sourceUrl: src.url });
    showInfo("Download", `'${displayName}' を ${dir} に保存しました。`);
  } catch (e: any) {
    showError("Download", e?.message || "Save failed.");
  }
}
