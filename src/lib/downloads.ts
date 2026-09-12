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

const DB_NAME = "wenge-desktop";
const DB_VERSION = 2;
const STORE = "downloads";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Fresh installs may come through here first: ensure both stores exist.
      if (!db.objectStoreNames.contains("docs")) {
        db.createObjectStore("docs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let req: IDBRequest<T>;
        try {
          req = fn(store);
        } catch (e) {
          db.close();
          reject(e);
          return;
        }
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
      })
  );
}

function notifyChanged() {
  try {
    window.dispatchEvent(new CustomEvent(DOWNLOADS_CHANGED_EVENT));
  } catch {}
}

export async function saveDownload(opts: {
  name: string;
  mime: string;
  blob: Blob;
  sourceR2Key?: string;
}): Promise<DownloadDoc> {
  const doc: DownloadDoc = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: opts.name,
    mime: opts.mime,
    size: opts.blob.size,
    createdAt: new Date().toISOString(),
    sourceR2Key: opts.sourceR2Key,
    blob: opts.blob,
  };
  await tx("readwrite", (s) => s.put(doc));
  notifyChanged();
  return doc;
}

export async function listDownloads(): Promise<DownloadDoc[]> {
  try {
    const all = await tx<DownloadDoc[]>("readonly", (s) => s.getAll());
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function deleteDownload(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
  notifyChanged();
}

/** Open inside Wenge (preview in a new tab). Object URL is revoked after 60s. */
export function openDownload(doc: DownloadDoc) {
  const url = URL.createObjectURL(doc.blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Force a real download to the user's machine via anchor download attribute. */
export function downloadBlobToMachine(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Sanitize path-ish names ("folder/file") down to a file name for the download attribute
  a.download = name.split("/").pop() || name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
