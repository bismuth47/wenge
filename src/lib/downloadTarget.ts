import { showDownloadChoice, showError, showInfo } from "../components/SystemDialog";
import { downloadBlobToMachine, saveDownload } from "./downloads";

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

export type DownloadSource = {
  /** display name (may include a virtual folder prefix like "photos/a.png") */
  name: string;
  mime?: string;
  /** remote URL to fetch when no blob is given */
  url?: string;
  /** already-available bytes (preferred over url) */
  blob?: Blob;
  sourceR2Key?: string;
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
 * Asks machine-vs-Wenge (unless remembered), then executes.
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
    // Force a real file download instead of navigating (old window.open behavior
    // only previews viewable types in a tab).
    try {
      const { blob } = await resolveBlob(src);
      downloadBlobToMachine(displayName, blob);
    } catch (e: any) {
      showError("Download", e?.message || "Download failed.");
    }
    return;
  }
  // Inside Wenge: persist bytes to IndexedDB so C:\Wenge\Downloads can show them.
  try {
    const { blob, mime } = await resolveBlob(src);
    await saveDownload({ name: src.name, mime, blob, sourceR2Key: src.sourceR2Key });
    showInfo("Download", `'${displayName}' を C:\\Wenge\\Downloads に保存しました。`);
  } catch (e: any) {
    showError("Download", e?.message || "Save failed.");
  }
}
