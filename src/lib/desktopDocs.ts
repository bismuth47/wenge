export type DesktopDoc = {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
  sourceR2Key?: string;
  blob: Blob;
};

const DB_NAME = "wenge-desktop";
const STORE = "docs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
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

export async function saveDocFromBlob(opts: {
  name: string;
  mime: string;
  blob: Blob;
  sourceR2Key?: string;
}): Promise<DesktopDoc> {
  const doc: DesktopDoc = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: opts.name,
    mime: opts.mime,
    size: opts.blob.size,
    createdAt: new Date().toISOString(),
    sourceR2Key: opts.sourceR2Key,
    blob: opts.blob,
  };
  await tx("readwrite", (s) => s.put(doc));
  return doc;
}

export async function listDesktopDocs(): Promise<DesktopDoc[]> {
  try {
    const all = await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
    void all;
  } catch {
    // ignore probe
  }
  try {
    return await tx<DesktopDoc[]>("readonly", (s) => s.getAll());
  } catch {
    return [];
  }
}

export async function deleteDesktopDoc(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export function downloadDesktopDoc(doc: DesktopDoc) {
  const url = URL.createObjectURL(doc.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.name;
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
