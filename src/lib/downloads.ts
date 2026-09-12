/**
 * Back-compat wrapper: old `downloads` (C:/Wenge/Downloads) API on top of the unified VFS.
 * New code should use src/lib/vfs/store.ts directly.
 */
import { deleteVfsFile, downloadVfsFileToMachine, listVfsDir, openVfsFileInNewTab, saveBlobToVfs, VFS_CHANGED_EVENT } from "./vfs/store";
import { VFS_DOWNLOADS, type VfsFile } from "./vfs/types";

export type DownloadDoc = {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
  sourceR2Key?: string;
  blob: Blob;
};

export const DOWNLOADS_CHANGED_EVENT = "wenge:downloads-changed";

// Bridge VFS notifications to legacy listeners (Explorer Downloads view).
if (typeof window !== "undefined") {
  window.addEventListener(VFS_CHANGED_EVENT, (e) => {
    const dir = (e as CustomEvent<string | undefined>).detail;
    if (!dir) {
      window.dispatchEvent(new CustomEvent(DOWNLOADS_CHANGED_EVENT));
      return;
    }
    try {
      const norm = dir.replace(/\\/g, "/").replace(/\/+$/, "");
      if (norm.toLowerCase() === VFS_DOWNLOADS.toLowerCase()) {
        window.dispatchEvent(new CustomEvent(DOWNLOADS_CHANGED_EVENT));
      }
    } catch {}
  });
}

function toLegacy(f: VfsFile): DownloadDoc {
  return { id: f.id, name: f.path.replace(/^C:\/Wenge\/Downloads\//i, "") || f.name, mime: f.mime, size: f.size, createdAt: f.createdAt, sourceR2Key: f.sourceR2Key, blob: f.blob };
}

function notifyChanged() {
  try {
    window.dispatchEvent(new CustomEvent(DOWNLOADS_CHANGED_EVENT));
  } catch {}
}

export async function saveDownload(opts: {
  name: string; mime: string; blob: Blob; sourceR2Key?: string;
}): Promise<DownloadDoc> {
  const f = await saveBlobToVfs({ blob: opts.blob, dir: VFS_DOWNLOADS, name: opts.name, mime: opts.mime, sourceR2Key: opts.sourceR2Key });
  notifyChanged();
  return toLegacy(f);
}

export async function listDownloads(): Promise<DownloadDoc[]> {
  try {
    return (await listVfsDir(VFS_DOWNLOADS)).map(toLegacy);
  } catch {
    return [];
  }
}

export async function deleteDownload(id: string): Promise<void> {
  await deleteVfsFile(id);
  notifyChanged();
}

/** Open inside Wenge (preview in a new tab). Object URL is revoked after 60s. */
export function openDownload(doc: DownloadDoc) {
  openVfsFileInNewTab(doc as unknown as VfsFile);
}

/** Force a real download to the user's machine via anchor download attribute. */
export function downloadBlobToMachine(name: string, blob: Blob) {
  downloadVfsFileToMachine({ name, blob } as VfsFile);
}
