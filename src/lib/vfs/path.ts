/** Path helpers for the virtual filesystem. Canonical form: "C:/Foo/Bar" */

export function normalizeVfsPath(p: string): string {
  let s = (p ?? "").trim().replace(/\//g, "/").replace(/\\/g, "/");
  s = s.replace(/\/+/g, "/");
  // "C:" -> "C:/", "c:/foo/" -> "C:/foo"
  const m = s.match(/^([a-zA-Z]):\/?(.*)$/);
  if (!m) {
    // bare relative -> treat as under C:/
    s = s.replace(/^\/+/, "");
    return s ? `C:/${s}` : "C:/";
  }
  const drive = m[1].toUpperCase();
  let rest = m[2].replace(/^\/+/, "").replace(/\/+$/, "");
  return rest ? `${drive}:/${rest}` : `${drive}:/`;
}

export function normalizeVfsDir(p: string): string {
  return normalizeVfsPath(p);
}

export function vfsBasename(p: string): string {
  const n = normalizeVfsPath(p);
  if (n === "C:/") return "C:/";
  const i = n.lastIndexOf("/");
  return n.slice(i + 1);
}

export function vfsDirname(p: string): string {
  const n = normalizeVfsPath(p);
  if (n === "C:/") return "C:/";
  const i = n.lastIndexOf("/");
  const d = n.slice(0, i);
  return d.endsWith(":") ? `${d}/` : d || "C:/";
}

export function vfsJoin(dir: string, name: string): string {
  const d = normalizeVfsPath(dir);
  const clean = name.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\.\./g, "");
  if (!clean) return d;
  // nested names like "photos/a.png" are allowed
  return d === "C:/" ? `C:/${clean}` : `${d}/${clean}`;
}

export function vfsEquals(a: string, b: string): boolean {
  return normalizeVfsPath(a).toLowerCase() === normalizeVfsPath(b).toLowerCase();
}

export function isVfsDescendant(path: string, dir: string): boolean {
  const p = normalizeVfsPath(path).toLowerCase();
  const d = normalizeVfsPath(dir).toLowerCase();
  if (d === "c:/") return p.startsWith("c:/");
  return p === d || p.startsWith(d + "/");
}

/** "C:\Wenge\Documents" style input (explorer) -> canonical VFS path */
export function fromExplorerPath(p: string): string {
  return normalizeVfsPath(p);
}

/** canonical VFS path -> "C:\Wenge\Documents" display style */
export function toExplorerPath(p: string): string {
  return normalizeVfsPath(p).replace(/\//g, "\\");
}
