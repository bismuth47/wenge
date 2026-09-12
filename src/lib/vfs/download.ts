import { showDownloadChoice, showError, showInfo } from "../../components/SystemDialog";
import { downloadBlobToMachine } from "../downloads";
import { getDownloadSetting, setDownloadSetting } from "../downloadTarget";
import { saveBlobToVfs } from "./store";
import { VFS_DOWNLOADS } from "./types";

export type VfsDownloadSource = {
  name: string;
  mime?: string;
  url?: string;
  blob?: Blob;
  sourceR2Key?: string;
  /** VFS dir to save into when staying inside Wenge. Defaults to C:/Wenge/Downloads */
  targetDir?: string;
};

type BlobSource = {
  name?: string;
  url?: string;
  mime?: string;
  blob?: Blob;
};

async function resolveBlob(src: BlobSource): Promise<{ blob: Blob; mime: string }> {
  if (src.blob) return { blob: src.blob, mime: src.blob.type || src.mime || "application/octet-stream" };
  if (!src.url) throw new Error("No file data available.");
  // Route through the same-origin proxy so arbitrary internet files are
  // fetchable regardless of the target site's CORS policy.
  const proxied = src.url.startsWith("/") ? src.url : `/api/proxy?url=${encodeURIComponent(src.url)}`;
  let res = await fetch(proxied);
  if (!res.ok && !src.url.startsWith("/")) {
    // Fall back to a direct fetch (e.g. CORS-enabled hosts / blob: URLs).
    res = await fetch(src.url);
  }
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    // Proxy error envelope (bot-blocked etc.) — not a saveable file.
    const body = await res.text().catch(() => "");
    try {
      const j = JSON.parse(body);
      throw new Error(j?.error || "Save blocked by proxy.");
    } catch (e: any) {
      if (e?.message && !e.message.includes("Unexpected token")) throw e;
      throw new Error("This page cannot be saved (proxy block).");
    }
  }
  const blob = await res.blob();
  return { blob, mime: blob.type || src.mime || "application/octet-stream" };
}

export function fileNameFromUrl(pageUrl: string, disposition: string | null): string {
  if (disposition) {
    const m = disposition.match(/filename\*?=(?:UTF-8''|")?([^";\n]+)/i);
    if (m) {
      try {
        const decoded = decodeURIComponent(m[1].replace(/^"|"$/g, "").trim());
        if (decoded) return decoded;
      } catch {}
    }
  }
  try {
    const u = new URL(pageUrl);
    const base = u.pathname.split("/").filter(Boolean).pop() || "";
    if (base && base.includes(".")) return base;
    if (base) return `${base}.html`;
    return `${u.hostname}.html`;
  } catch {
    return "download.html";
  }
}

/**
 * Fetch an arbitrary URL (or use given bytes) and save it into the VFS
 * instead of downloading to the real machine.
 */
export async function saveUrlToVfs(
  url: string,
  dir: string,
  opts?: { filename?: string; mime?: string; sourceR2Key?: string }
) {
  const { blob, mime } = await resolveBlob({ url, mime: opts?.mime, name: '' });
  let name = opts?.filename;
  if (!name) {
    try {
      const u = new URL(url);
      name = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "") || `${u.hostname}.html`;
    } catch {
      name = "download";
    }
  }
  return saveBlobToVfs({ blob, dir, name, mime, sourceUrl: url, sourceR2Key: opts?.sourceR2Key });
}

/**
 * Full download entry point with destination choice.
 * Kept compatible with the old handleDownload() signature.
 */
export async function handleVfsDownload(src: VfsDownloadSource): Promise<void> {
  const displayName = src.name.split("/").pop() || src.name;
  let setting = getDownloadSetting();
  if (setting === "ask") {
    const choice = await showDownloadChoice(displayName);
    if (!choice) return;
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
  try {
    const { blob, mime } = await resolveBlob(src);
    const dir = src.targetDir ?? VFS_DOWNLOADS;
    await saveBlobToVfs({ blob, dir, name: src.name, mime, sourceUrl: src.url, sourceR2Key: src.sourceR2Key });
    showInfo("Download", `'${displayName}' を ${dir} に保存しました。`);
  } catch (e: any) {
    showError("Download", e?.message || "Save failed.");
  }
}
