import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Frame, ProgressBar, TextInput } from "react95";
import { showConfirm, showError, showInfo } from "../components/SystemDialog";
import { ICONS } from "../assets/icons";
import {
  R2_DRAG_MIME,
  createR2Folder,
  deleteR2Key,
  guessMime,
  listR2,
  normalizePrefix,
  r2NameOfKey,
  uploadToR2,
  type R2DragItem,
  type R2File,
} from "../lib/r2";
import {
  DOWNLOADS_CHANGED_EVENT,
  deleteDownload,
  listDownloads,
  openDownload,
  type DownloadDoc,
} from "../lib/downloads";
import { handleDownload } from "../lib/downloadTarget";
import { deleteVfsFile, useVfsDirectory } from "../lib/vfs/store";
import type { VfsFile } from "../lib/vfs/types";
import { setPendingVfsFile, vfsOpenTarget } from "../lib/vfs/openWith";
import { fromExplorerPath, normalizeVfsPath } from "../lib/vfs/path";

export type ExplorerOpenId = "notepad"|"wordpad"|"paint"|"calc"|"clock"|"msdos"|"minesweeper"|"solitaire"|"freecell"|"hearts"|"media-player"|"cd-player"|"sound-recorder"|"volume"|"control"|"help"|"find"|"recycle"|"network"|"my-computer"|string;

type FEntry = { name: string; size: string; type: string; app?: string };

const FS: Record<string, { folders: string[]; files: FEntry[] }> = {
  "C:\\": { folders: ["Wenge","Windows","Program Files"], files: [{name:"AUTOEXEC.BAT",size:"1 KB",type:"Batch",app:"msdos"}, {name:"CONFIG.SYS",size:"1 KB",type:"System"}] },
  "C:\\Wenge": { folders: ["Documents","Media","Games","Downloads"], files: [{name:"README.txt",size:"2 KB",type:"Text",app:"notepad"},{name:"Wenge.bmp",size:"256 KB",type:"Bitmap",app:"paint"},{name:"Setup.exe",size:"1.2 MB",type:"Application"}] },
  "C:\\Wenge\\Documents": { folders: [], files: [{name:"README.txt",size:"2 KB",type:"Text",app:"notepad"},{name:"Report.doc",size:"45 KB",type:"Document",app:"wordpad"},{name:"Budget.xls",size:"32 KB",type:"Sheet"}] },
  "C:\\Wenge\\Media": { folders: [], files: [{name:"chimes.wav",size:"120 KB",type:"Sound",app:"media-player"},{name:"tada.wav",size:"80 KB",type:"Sound",app:"media-player"},{name:"Wenge.bmp",size:"256 KB",type:"Bitmap",app:"paint"}] },
  "C:\\Wenge\\Games": { folders: [], files: [{name:"Solitaire",size:"",type:"Game",app:"solitaire"},{name:"Minesweeper",size:"",type:"Game",app:"minesweeper"}] },
  "C:\\Windows": { folders: ["System","Fonts","Help"], files: [{name:"WIN.COM",size:"45 KB",type:"Application"},{name:"NOTEPAD.EXE",size:"32 KB",type:"Application",app:"notepad"},{name:"CALC.EXE",size:"18 KB",type:"Application",app:"calc"}] },
  "C:\\Windows\\System": { folders: [], files: [{name:"SHELL.DLL",size:"120 KB",type:"System"}] },
  "C:\\Windows\\Fonts": { folders: [], files: [{name:"MS Sans Serif",size:"",type:"Font"}] },
  "C:\\Windows\\Help": { folders: [], files: [{name:"WENGE.HLP",size:"60 KB",type:"Help",app:"help"}] },
  "C:\\Program Files": { folders: ["Internet Explorer","Media Player"], files: [{name:"README.txt",size:"1 KB",type:"Text",app:"notepad"},{name:"readme.htm",size:"1 KB",type:"Web page",app:"ie"}] },
};

export function normExplorerKey(p: string): string {
  let s = p.trim().replace(/\//g, "\\");
  s = s.replace(/\\+$/, "");
  if (!s) return "C:\\";
  if (/^c:$/i.test(s)) return "C:\\";
  const hit = Object.keys(FS).find((k) => k.toLowerCase() === s.toLowerCase());
  return hit ?? s;
}

/** "R2:\\photos\\2024" / "r2://photos" / "R:\\photos" / "\\\\R2\\photos" -> "photos/" ; non-R2 -> null */
export function parseR2Path(p: string): string | null {
  const t = p.trim();
  if (/^r2\s*:/i.test(t)) {
    const rest = t.replace(/^r2\s*:/i, "").replace(/^[/\\]+/, "");
    return normalizePrefix(rest.replace(/\\/g, "/"));
  }
  if (/^R\s*:[\\/]/i.test(t)) {
    const rest = t.replace(/^R\s*:[\\/]/i, "").replace(/^[/\\]+/, "");
    return normalizePrefix(rest.replace(/\\/g, "/"));
  }
  if (/^\\\\R2(\\|$)/i.test(t)) {
    const rest = t.replace(/^\\\\R2/i, "").replace(/^[/\\]+/, "");
    return normalizePrefix(rest.replace(/\\/g, "/"));
  }
  return null;
}

export function formatR2Path(prefix: string): string {
  const p = normalizePrefix(prefix);
  if (!p) return "R2:\\";
  return "R2:\\" + p.replace(/\//g, "\\").replace(/\\$/, "");
}

/** Virtual download folder backed by the VFS IndexedDB store. */
export const DOWNLOADS_KEY = "C:\\Wenge\\Downloads";
export const DESKTOP_KEY = "C:\\Desktop";
export const DOCUMENTS_KEY = "C:\\Documents";

function formatSize(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return "1 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ExplorerApp({ onOpenApp }: { onOpenApp?: (id: any, file?: VfsFile) => void }) {
  const [path, setPath] = useState("C:\\Wenge\\Documents");
  const [input, setInput] = useState("C:\\Wenge\\Documents");
  const [selected, setSelected] = useState<string | null>(null);
  // --- R2 state ---
  const [r2Prefix, setR2Prefix] = useState<string | null>(null); // null = local mode
  const [r2Files, setR2Files] = useState<R2File[]>([]);
  const [r2Folders, setR2Folders] = useState<string[]>([]);
  const [r2Loading, setR2Loading] = useState(false);
  const [r2Note, setR2Note] = useState<string | null>(null);
  const [r2Busy, setR2Busy] = useState<string | null>(null);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const inR2 = r2Prefix !== null;
  // --- Downloads (IndexedDB-backed virtual folder) state ---
  const [dlDocs, setDlDocs] = useState<DownloadDoc[]>([]);
  const [dlLoading, setDlLoading] = useState(false);
  const refreshDownloads = useCallback(async () => {
    setDlLoading(true);
    try {
      setDlDocs(await listDownloads());
    } catch {
      setDlDocs([]);
    } finally {
      setDlLoading(false);
    }
  }, []);
  useEffect(() => {
    const onDl = () => { refreshDownloads(); };
    window.addEventListener(DOWNLOADS_CHANGED_EVENT, onDl);
    return () => window.removeEventListener(DOWNLOADS_CHANGED_EVENT, onDl);
  }, [refreshDownloads]);

  const refreshR2 = useCallback(async (prefix: string) => {
    setR2Loading(true);
    setR2Note(null);
    try {
      const data = await listR2(prefix);
      setR2Files(data.files);
      setR2Folders(data.folders);
      if (data.note) setR2Note(data.note);
    } catch (e: any) {
      setR2Files([]);
      setR2Folders([]);
      setR2Note(null);
      showError("R2 File Share", e?.message || "Failed to list R2 folder.");
    } finally {
      setR2Loading(false);
    }
  }, []);

  const enterR2 = useCallback((prefix: string) => {
    const p = normalizePrefix(prefix);
    setR2Prefix(p);
    setPath(formatR2Path(p));
    setInput(formatR2Path(p));
    setSelected(null);
    setMkdirOpen(false);
    refreshR2(p);
  }, [refreshR2]);

  useEffect(() => {
    if (r2Prefix !== null) refreshR2(r2Prefix);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const key = normExplorerKey(path);
  const inDownloads = !inR2 && key === DOWNLOADS_KEY;
  // C:/Desktop と C:/Documents はVFS実データで表示（永続化・デスクトップ連動）
  const vfsPath = !inR2 ? normalizeVfsPath(fromExplorerPath(key)) : null;
  const isVfsDir = !inR2 && !!vfsPath && (vfsPath.toLowerCase() === "c:/desktop" || vfsPath.toLowerCase() === "c:/documents" || vfsPath.toLowerCase() === "c:/wenge/downloads");
  const { files: vfsFiles, loading: vfsLoading, refresh: refreshVfs } = useVfsDirectory(!inR2 && isVfsDir && vfsPath ? vfsPath : "C:/Desktop");
  const dir = inDownloads || isVfsDir ? { folders: [] as string[], files: [] as FEntry[] } : FS[key];
  const folders = dir?.folders ?? [];
  const files = dir?.files ?? [];
  const openVfsEntry = (id: string) => {
    const f = vfsFiles.find((x) => x.id === id);
    if (!f) return;
    const target = vfsOpenTarget(f);
    if (target === "preview" || target === "explorer") {
      const url = URL.createObjectURL(f.blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    const appId = target === "notepad" ? "notepad" : target === "wordpad" ? "wordpad" : target === "image-viewer" ? "image-viewer" : target === "ie" ? "ie" : "media-player";
    setPendingVfsFile(f);
    try {
      (window as any).__wengePendingVfs = f;
    } catch {}
    onOpenApp?.(appId, f);
  };
  const deleteVfsEntry = async (id: string) => {
    const f = vfsFiles.find((x) => x.id === id);
    const ok = await showConfirm("Explorer", `Delete '${f?.name ?? id}'?\nThis cannot be undone.`, "Delete", "Cancel");
    if (!ok) return;
    try {
      await deleteVfsFile(id);
      setSelected(null);
      refreshVfs();
    } catch (e: any) {
      showError("Explorer", e?.message || "Delete failed.");
    }
  };
  const goTo = (p: string) => {
    const r2 = parseR2Path(p);
    if (r2 !== null) { enterR2(r2); return; }
    const k = normExplorerKey(p);
    // C:/Desktop | C:/Documents | C:/Wenge/Downloads はVFS実データ
    if (k === DESKTOP_KEY || k === DOCUMENTS_KEY || k === DOWNLOADS_KEY) {
      setR2Prefix(null);
      setPath(k); setInput(k); setSelected(null);
      if (k === DOWNLOADS_KEY) refreshDownloads();
      return;
    }
    if ((FS as any)[k]) {
      setR2Prefix(null);
      setPath(k); setInput(k); setSelected(null);
    }
    else { showError("Explorer", "Cannot find '" + p + "'.\nCheck the spelling and try again."); setInput(path); }
  };
  const goUp = () => {
    if (inR2) {
      const p = r2Prefix!;
      if (!p) return;
      const parts = p.replace(/\/$/, "").split("/");
      parts.pop();
      enterR2(parts.length ? parts.join("/") + "/" : "");
      return;
    }
    if (inDownloads) { goTo("C:\\Wenge"); return; }
    if (isVfsDir) { goTo("C:\\Wenge"); return; }
    if (key === "C:\\") return;
    const parts = key.split("\\").filter(Boolean);
    parts.pop();
    goTo(parts.length <= 1 ? "C:\\" : parts.join("\\"));
  };
  const openEntry = (f: FEntry) => {
    if (f.app && onOpenApp) onOpenApp(f.app);
    else if (f.app) showInfo("Explorer", f.name + " opens " + f.app + ".");
    else showInfo("Explorer", f.name + "\nSize: " + (f.size || "-") + "\nType: " + f.type);
  };

  // --- R2 actions ---
  const onUploadFiles = async (list: FileList | null) => {
    if (!list || list.length === 0 || r2Prefix === null) return;
    setR2Busy("Uploading...");
    try {
      for (const f of Array.from(list)) {
        await uploadToR2(r2Prefix, f);
      }
      await refreshR2(r2Prefix);
    } catch (e: any) {
      showError("R2 File Share", e?.message || "Upload failed.");
    } finally {
      setR2Busy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onMkdir = async () => {
    if (r2Prefix === null) return;
    const name = mkdirName.trim().replace(/^\/+|\/+$/g, "");
    if (!name) { showError("R2 File Share", "Type a folder name."); return; }
    setR2Busy("Creating folder...");
    try {
      await createR2Folder(r2Prefix, name);
      setMkdirName("");
      setMkdirOpen(false);
      await refreshR2(r2Prefix);
    } catch (e: any) {
      showError("R2 File Share", e?.message || "Cannot create folder.");
    } finally {
      setR2Busy(null);
    }
  };

  const onDeleteSelected = async () => {
    if (r2Prefix === null || !selected) return;
    const isDir = selected.startsWith("r2d:");
    const name = selected.slice(4);
    const targetKey = isDir ? `${r2Prefix}${name}/` : selected.slice(4);
    const ok = await showConfirm("R2 File Share", `Delete '${name}'${isDir ? " and everything inside it" : ""}?\nThis cannot be undone.`, "Delete", "Cancel");
    if (!ok) return;
    setR2Busy("Deleting...");
    try {
      await deleteR2Key(targetKey);
      setSelected(null);
      await refreshR2(r2Prefix);
    } catch (e: any) {
      showError("R2 File Share", e?.message || "Delete failed.");
    } finally {
      setR2Busy(null);
    }
  };

  // --- R2 download (asks machine vs Wenge) ---
  const onDownloadSelected = () => {
    if (r2Prefix === null || !selected || !selected.startsWith("r2f:")) return;
    const k = selected.slice(4);
    const f = r2Files.find((x) => x.key === k);
    if (!f) return;
    const name = r2NameOfKey(f.key);
    handleDownload({ name, mime: guessMime(name), url: f.url, sourceR2Key: f.key });
  };

  // --- Downloads (IndexedDB virtual folder) actions ---
  const onDeleteDownloadSelected = async () => {
    if (!selected || !selected.startsWith("dl:")) return;
    const id = selected.slice(3);
    const doc = dlDocs.find((d) => d.id === id);
    const ok = await showConfirm("Explorer", `Delete '${doc?.name ?? id}' from Downloads?\nThis cannot be undone.`, "Delete", "Cancel");
    if (!ok) return;
    try {
      await deleteDownload(id);
      setSelected(null);
      await refreshDownloads();
    } catch (e: any) {
      showError("Explorer", e?.message || "Delete failed.");
    }
  };

  const startDownloadDrag = (e: React.DragEvent, doc: DownloadDoc) => {
    // Blob URLs are fetchable, so the Desktop drop handler can copy them as-is.
    const url = URL.createObjectURL(doc.blob);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    const name = doc.name.split("/").pop() || doc.name;
    startDrag(e, { kind: "file", key: `downloads/${doc.id}/${name}`, name, url, size: doc.size, mime: doc.mime });
  };

  const startDrag = (e: React.DragEvent, item: R2DragItem) => {
    e.dataTransfer.setData(R2_DRAG_MIME, JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
    // Allow dropping onto the real OS desktop / file manager: Chrome/Firefox
    // honor the DownloadURL format to download the file on drop.
    if (item.kind === "file") {
      try {
        e.dataTransfer.setData("DownloadURL", `${item.mime}:${item.name}:${item.url}`);
        e.dataTransfer.setData("text/uri-list", item.url);
      } catch {}
    }
  };

  const crumbs = key === "C:\\" ? ["C:\\"] : key.split("\\");
  const r2Crumbs = inR2 ? normalizePrefix(r2Prefix!).replace(/\/$/, "").split("/").filter(Boolean) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <Button size="sm" onClick={goUp} disabled={inR2 ? !r2Prefix : key === "C:\\"} title="Up one level">Up</Button>
        <span style={{ fontSize: 11 }}>Location:</span>
        <TextInput value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") goTo(input); }} style={{ flex: 1 }} />
        <Button size="sm" onClick={() => goTo(input)}>Go</Button>
      </div>
      {inR2 ? (
        <div style={{ fontSize: 11, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          <a href="#" onClick={(e) => { e.preventDefault(); enterR2(""); }} style={{ color: "#000080" }}>R2:\</a>
          {r2Crumbs.map((c, i) => {
            const p = r2Crumbs.slice(0, i + 1).join("/") + "/";
            return (<span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: "#808080" }}>›</span><a href="#" onClick={(e) => { e.preventDefault(); enterR2(p); }} style={{ color: "#000080" }}>{c}</a></span>);
          })}
        </div>
      ) : (
        <div style={{ fontSize: 11, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {crumbs.map((c, i) => {
            const p = i === 0 ? "C:\\" : crumbs.slice(0, i + 1).join("\\");
            return (<span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>{i > 0 && <span style={{ color: "#808080" }}>›</span>}<a href="#" onClick={(e) => { e.preventDefault(); goTo(p); }} style={{ color: "#000080" }}>{i === 0 ? "C:\\" : c}</a></span>);
          })}
        </div>
      )}
      {inR2 && (
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <Button size="sm" onClick={() => refreshR2(r2Prefix!)} disabled={r2Loading}>Refresh</Button>
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={!!r2Busy}>Upload...</Button>
          <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={(e) => onUploadFiles(e.target.files)} />
          <Button size="sm" onClick={() => setMkdirOpen((v) => !v)} disabled={!!r2Busy}>New Folder...</Button>
          <Button size="sm" onClick={onDeleteSelected} disabled={!selected || !!r2Busy}>Delete</Button>
          <Button size="sm" onClick={onDownloadSelected} disabled={!selected?.startsWith("r2f:") || !!r2Busy}>Download...</Button>
            <span style={{ fontSize: 11, color: "#555" }}>{r2Busy ?? (r2Loading ? "Loading..." : "")}</span>
        </div>
      )}
      {isVfsDir && !inDownloads && (
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <Button size="sm" onClick={() => refreshVfs()} disabled={vfsLoading}>Refresh</Button>
          <Button size="sm" onClick={() => { const f = vfsFiles.find((x) => `vfs:${x.id}` === selected); if (f) openVfsEntry(f.id); }} disabled={!selected?.startsWith("vfs:")}>Open</Button>
          <Button size="sm" onClick={() => { const id = (selected ?? "").slice(4); if (selected?.startsWith("vfs:") && id) deleteVfsEntry(id); }} disabled={!selected?.startsWith("vfs:")}>Delete</Button>
            <span style={{ fontSize: 11, color: "#555" }}>{vfsLoading ? "Loading..." : "VFS (永続). Double-click to open in app."}</span>
        </div>
      )}
      {inDownloads && (
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <Button size="sm" onClick={refreshDownloads} disabled={dlLoading}>Refresh</Button>
          <Button size="sm" onClick={() => {
            const doc = dlDocs.find((d) => `dl:${d.id}` === selected);
            if (doc) openDownload(doc);
          }} disabled={!selected?.startsWith("dl:")}>Open</Button>
          <Button size="sm" onClick={onDeleteDownloadSelected} disabled={!selected?.startsWith("dl:")}>Delete</Button>
          <span style={{ fontSize: 11, color: "#555" }}>{dlLoading ? "Loading..." : "Files saved via “Wenge内”. Drag one onto the Desktop to copy it there."}</span>
        </div>
      )}
      {inR2 && mkdirOpen && (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 11 }}>Folder name:</span>
          <TextInput value={mkdirName} onChange={(e) => setMkdirName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onMkdir(); }} placeholder="e.g. photos" style={{ flex: 1 }} />
          <Button size="sm" onClick={onMkdir} disabled={!!r2Busy}>Create</Button>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Frame variant="well" style={{ width: 130, padding: 6, background: "#fff", fontSize: 11, overflow: "auto" }}>
          {[ { label: "My Computer", icon: ICONS.myComputer, target: "C:\\" }, { label: "C: (Wenge)", icon: ICONS.hardDrive, target: "C:\\" }, { label: "Wenge", icon: ICONS.folderClosed, target: "C:\\Wenge" }, { label: "Desktop", icon: ICONS.folderClosed, target: DESKTOP_KEY }, { label: "Documents", icon: ICONS.folderClosed, target: DOCUMENTS_KEY }, { label: "Downloads", icon: ICONS.folderClosed, target: DOWNLOADS_KEY }, { label: "Windows", icon: ICONS.folderClosed, target: "C:\\Windows" }, { label: "R2 File Share", icon: ICONS.fileShare, target: "__r2" }, { label: "Recycle Bin", icon: ICONS.recycle, target: "__recycle" }, { label: "Network", icon: ICONS.network, target: "__network" } ].map((n) => {
            const active = inR2 ? n.target === "__r2" : (n.target !== "__recycle" && n.target !== "__network" && n.target !== "__r2" && normExplorerKey(n.target) === key);
            return (<div key={n.label} onClick={() => { if (n.target === "__recycle") onOpenApp?.("recycle"); else if (n.target === "__network") onOpenApp?.("network"); else if (n.target === "__r2") enterR2(""); else goTo(n.target); }} style={{ paddingLeft: (n.label === "Wenge" || n.label === "Windows" || n.label === "Downloads" || n.label === "Desktop" || n.label === "Documents") ? 12 : 0, background: active ? "#000080" : "transparent", color: active ? "#fff" : "#000", display: "flex", alignItems: "center", gap: 4, cursor: "url('/cursors/hand.png') 12 0, pointer", paddingTop: 2, paddingBottom: 2 }}><img src={n.icon} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {n.label}</div>);
          })}
        </Frame>
        <Frame
          variant="well"
          style={{ flex: 1, background: "#fff", padding: 0, overflow: "hidden", minHeight: 0, position: "relative" }}
          onDragOver={inR2 ? (e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } } : undefined}
          onDrop={inR2 ? (e) => { if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { e.preventDefault(); onUploadFiles(e.dataTransfer.files); } } : undefined}
          title={inR2 ? "You can also drop OS files here to upload" : undefined}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 24, overflow: "auto" }}>
            {inR2 ? (
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#c0c0c0" }}><th style={{ textAlign: "left", padding: 3 }}>Name</th><th>Size</th><th>Type</th></tr></thead>
                <tbody>
                  {!!r2Prefix && (<tr onClick={goUp} onDoubleClick={goUp} style={{ cursor: "url('/cursors/hand.png') 12 0, pointer" }} title="Up to parent folder"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> ..</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Parent Folder</td></tr>)}
                  {r2Folders.map((fd) => {
                    const sel = selected === `r2d:${fd}`;
                    return (<tr key={`d:${fd}`} draggable onDragStart={(e) => startDrag(e, { kind: "folder", prefix: `${r2Prefix}${fd}/`, name: fd })} onClick={() => setSelected(sel ? null : `r2d:${fd}`)} onDoubleClick={() => enterR2(`${r2Prefix}${fd}/`)} style={{ borderTop: "1px solid #c0c0c0", background: sel ? "#000080" : "transparent", color: sel ? "#fff" : "#000", cursor: "grab" }} title="Drag to the Desktop to copy this folder"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} draggable={false} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {fd}</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Folder</td></tr>);
                  })}
                  {r2Files.map((f) => {
                    const name = r2NameOfKey(f.key);
                    const sel = selected === `r2f:${f.key}`;
                    const dl = () => handleDownload({ name, mime: guessMime(name), url: f.url, sourceR2Key: f.key });
                    return (<tr key={f.key} draggable onDragStart={(e) => startDrag(e, { kind: "file", key: f.key, name, url: f.url, size: f.size, mime: guessMime(name) })} onClick={() => setSelected(sel ? null : `r2f:${f.key}`)} onDoubleClick={dl} style={{ borderTop: "1px solid #c0c0c0", background: sel ? "#000080" : "transparent", color: sel ? "#fff" : "#000", cursor: "grab" }} title="Drag to the Desktop to copy · double-click to download"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.fileWindows} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} draggable={false} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {name}</td><td style={{ textAlign: "center" }}>{formatSize(f.size)}</td><td style={{ textAlign: "center" }}>R2 File</td></tr>);
                  })}
                </tbody>
              </table>
            ) : isVfsDir ? (
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#c0c0c0" }}><th style={{ textAlign: "left", padding: 3 }}>Name</th><th>Size</th><th>Type</th></tr></thead>
                <tbody>
                  <tr onClick={() => goTo("C:\\Wenge")} onDoubleClick={() => goTo("C:\\Wenge")} style={{ cursor: "url('/cursors/hand.png') 12 0, pointer" }} title="Up to parent folder"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> ..</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Parent Folder</td></tr>
                  {vfsFiles.map((f) => {
                    const sel = selected === `vfs:${f.id}`;
                    return (<tr key={f.id} onClick={() => setSelected(sel ? null : `vfs:${f.id}`)} onDoubleClick={() => openVfsEntry(f.id)} style={{ borderTop: "1px solid #c0c0c0", background: sel ? "#000080" : "transparent", color: sel ? "#fff" : "#000", cursor: "url('/cursors/hand.png') 12 0, pointer" }} title="Double-click to open in app"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.fileWindows} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} draggable={false} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {f.name}</td><td style={{ textAlign: "center" }}>{formatSize(f.size)}</td><td style={{ textAlign: "center" }}>{vfsOpenTarget(f)}</td></tr>);
                  })}
                </tbody>
              </table>
            ) : inDownloads ? (
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#c0c0c0" }}><th style={{ textAlign: "left", padding: 3 }}>Name</th><th>Size</th><th>Type</th></tr></thead>
                <tbody>
                  <tr onClick={() => goTo("C:\\Wenge")} onDoubleClick={() => goTo("C:\\Wenge")} style={{ cursor: "url('/cursors/hand.png') 12 0, pointer" }} title="Up to parent folder"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> ..</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Parent Folder</td></tr>
                  {dlDocs.map((d) => {
                    const name = d.name.split("/").pop() || d.name;
                    const sel = selected === `dl:${d.id}`;
                    return (<tr key={d.id} draggable onDragStart={(e) => startDownloadDrag(e, d)} onClick={() => setSelected(sel ? null : `dl:${d.id}`)} onDoubleClick={() => openDownload(d)} style={{ borderTop: "1px solid #c0c0c0", background: sel ? "#000080" : "transparent", color: sel ? "#fff" : "#000", cursor: "grab" }} title="Drag to the Desktop to copy · double-click to open"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.fileWindows} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} draggable={false} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {name}</td><td style={{ textAlign: "center" }}>{formatSize(d.size)}</td><td style={{ textAlign: "center" }}>Download</td></tr>);
                  })}
                </tbody>
              </table>
            ) : (
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#c0c0c0" }}><th style={{ textAlign: "left", padding: 3 }}>Name</th><th>Size</th><th>Type</th></tr></thead>
                <tbody>
                  {key !== "C:\\" && (<tr onClick={goUp} onDoubleClick={goUp} style={{ cursor: "url('/cursors/hand.png') 12 0, pointer" }} title="Up to parent folder"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> ..</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Parent Folder</td></tr>)}
                  {folders.map((fd) => (<tr key={fd} onClick={() => setSelected(fd)} onDoubleClick={() => goTo(key === "C:\\" ? ("C:\\" + fd) : (key + "\\" + fd))} style={{ borderTop: "1px solid #c0c0c0", background: selected === fd ? "#000080" : "transparent", color: selected === fd ? "#fff" : "#000", cursor: "url('/cursors/hand.png') 12 0, pointer" }}><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {fd}</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Folder</td></tr>))}
                  {files.map((f) => (<tr key={f.name} onClick={() => setSelected(f.name)} onDoubleClick={() => openEntry(f)} style={{ borderTop: "1px solid #c0c0c0", background: selected === f.name ? "#000080" : "transparent", color: selected === f.name ? "#fff" : "#000", cursor: "url('/cursors/hand.png') 12 0, pointer" }}><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.fileWindows} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {f.name}</td><td style={{ textAlign: "center" }}>{f.size}</td><td style={{ textAlign: "center" }}>{f.type}</td></tr>))}
                </tbody>
              </table>
            )}
            {!inR2 && !dir && <div style={{ padding: 16, fontSize: 11 }}>Folder not found. <a href="#" onClick={(e) => { e.preventDefault(); goTo("C:\\"); }}>Back to C:\</a></div>}
            {inR2 && !r2Loading && r2Folders.length === 0 && r2Files.length === 0 && (
              <div style={{ padding: 16, fontSize: 11, color: "#555" }}>{r2Note ?? "Empty folder. Upload files or create a folder — or drop OS files here."}</div>
            )}
            {inDownloads && !dlLoading && dlDocs.length === 0 && (
              <div style={{ padding: 16, fontSize: 11, color: "#555" }}>Empty. Files you save via "Wenge内" will appear here.</div>
            )}
          </div>
          <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, height: 24, display: "flex", alignItems: "center", padding: "0 8px", background: "#c0c0c0", borderTop: "1px solid #808080", fontSize: 11 }}>{inR2 ? `${r2Folders.length + r2Files.length} object(s) · ${formatR2Path(r2Prefix!)}${r2Note ? ` · ${r2Note}` : ""}` : inDownloads ? `${dlDocs.length} object(s) · ${DOWNLOADS_KEY}` : (dir ? (folders.length + files.length) + " object(s)" : "0 object(s)") + ` · ${key}`}</div>
        </Frame>
      </div>
      <div style={{ height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f0f0", borderTop: "1px solid #808080", fontSize: 11, flexShrink: 0 }}>
        <ProgressBar value={inR2 ? (r2Loading ? 50 : 100) : inDownloads ? (dlLoading ? 50 : 100) : (dir ? 100 : 0)} style={{ height: 32, width: "100%" }} />
      </div>
    </div>
  );
}
