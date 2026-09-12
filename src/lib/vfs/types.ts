export type VfsFile = {
  id: string;
  /** normalized full path, e.g. "C:/Desktop/photo.png" */
  path: string;
  /** basename */
  name: string;
  /** normalized dir, e.g. "C:/Desktop" */
  dir: string;
  mime: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  sourceUrl?: string;
  sourceR2Key?: string;
  blob: Blob;
};

export type VfsDir = {
  path: string;
  createdAt: string;
};

export const VFS_DESKTOP = "C:/Desktop";
export const VFS_DOCUMENTS = "C:/Documents";
export const VFS_DOWNLOADS = "C:/Wenge/Downloads";
export const VFS_MEDIA = "C:/Wenge/Media";
export const VFS_ROOT = "C:/";

export const VFS_DEFAULT_DIRS = [
  "C:/",
  "C:/Wenge",
  VFS_DESKTOP,
  VFS_DOCUMENTS,
  VFS_DOWNLOADS,
  "C:/Wenge/Media",
  "C:/Wenge/Games",
] as const;

export function newVfsId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
