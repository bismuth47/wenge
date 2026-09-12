import { VFS_DEFAULT_DIRS, type VfsDir, type VfsFile } from "./types";
import { normalizeVfsDir, normalizeVfsPath, vfsBasename, vfsDirname } from "./path";

const DB_NAME = "wenge-desktop";
// v3: unified `files` + `dirs` stores. Migrates legacy `docs` (Desktop)
// and `downloads` (C:/Wenge/Downloads) stores from v2.
export const VFS_DB_VERSION = 3;
export const VFS_FILES_STORE = "files";
export const VFS_DIRS_STORE = "dirs";

function ensureStores(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(VFS_FILES_STORE)) {
    db.createObjectStore(VFS_FILES_STORE, { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains(VFS_DIRS_STORE)) {
    db.createObjectStore(VFS_DIRS_STORE, { keyPath: "path" });
  }
  // keep legacy stores around so getAll() migration can read them
  if (!db.objectStoreNames.contains("docs")) {
    db.createObjectStore("docs", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("downloads")) {
    db.createObjectStore("downloads", { keyPath: "id" });
  }
}

function seedDirs(t: IDBTransaction) {
  try {
    const dirs = t.objectStore(VFS_DIRS_STORE);
    const now = new Date().toISOString();
    for (const d of VFS_DEFAULT_DIRS) {
      const path = normalizeVfsDir(d);
      try {
        const req = dirs.get(path);
        req.onsuccess = () => {
          if (!req.result) {
            try { dirs.put({ path, createdAt: now } as VfsDir); } catch {}
          }
        };
      } catch {}
    }
  } catch {}
}

type LegacyDoc = {
  id: string; name: string; mime: string; size: number; createdAt: string;
  sourceR2Key?: string; blob: Blob;
};

function migrateLegacy(t: IDBTransaction) {
  // Runs inside the versionchange transaction (async requests allowed).
  try {
    if (!t.objectStoreNames.contains(VFS_FILES_STORE)) return;
    const files = t.objectStore(VFS_FILES_STORE);
    const now = new Date().toISOString();
    const putMigrated = (doc: LegacyDoc, dir: string) => {
      try {
        const name = (doc.name || "file").split("\\").pop() || "file";
        const path = normalizeVfsPath(`${normalizeVfsDir(dir)}/${name}`.replace(/\/+/g, "/"));
        const get = files.get(doc.id);
        get.onsuccess = () => {
          if (get.result) return; // already migrated
          const f: VfsFile = {
            id: doc.id,
            path,
            name: vfsBasename(path),
            dir: vfsDirname(path),
            mime: doc.mime || "application/octet-stream",
            size: doc.blob?.size ?? doc.size ?? 0,
            createdAt: doc.createdAt || now,
            updatedAt: now,
            sourceR2Key: doc.sourceR2Key,
            blob: doc.blob,
          };
          try { files.put(f); } catch {}
        };
      } catch {}
    };
    for (const [store, dir] of [["docs", "C:/Desktop"], ["downloads", "C:/Wenge/Downloads"]] as const) {
      try {
        if (!t.objectStoreNames.contains(store)) continue;
        const legacy = t.objectStore(store);
        const all = legacy.getAll();
        all.onsuccess = () => {
          const rows = (all.result ?? []) as LegacyDoc[];
          for (const d of rows) {
            if (!d || !d.blob) continue;
            putMigrated(d, dir);
          }
        };
      } catch {}
    }
  } catch {}
}

export function openVfsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, VFS_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        ensureStores(db);
        try {
          const t = req.transaction!;
          seedDirs(t);
          migrateLegacy(t);
        } catch {}
      };
      req.onsuccess = () => {
        const db = req.result;
        // Safety: fresh open without upgrade still needs default dirs.
        try {
          const t = db.transaction(VFS_DIRS_STORE, "readwrite");
          seedDirs(t);
        } catch {}
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => {};
    } catch (e) {
      reject(e);
    }
  });
}

export function vfsTx<T>(
  stores: string | string[],
  mode: IDBTransactionMode,
  fn: (t: IDBTransaction) => IDBRequest<T>
): Promise<T> {
  return openVfsDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let t: IDBTransaction;
        try {
          t = db.transaction(stores, mode);
        } catch (e) {
          db.close();
          reject(e);
          return;
        }
        let req: IDBRequest<T>;
        try {
          req = fn(t);
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
