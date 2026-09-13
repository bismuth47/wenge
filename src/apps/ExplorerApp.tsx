import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Frame, MenuList, MenuListItem, ProgressBar, Separator, TextInput } from "react95";
import { showConfirm, showError, showInfo } from "../components/SystemDialog";
import { ICONS } from "../assets/icons";
import {
  createR2Folder,
  deleteR2Key,
  guessMime,
  listR2,
  listR2Flat,
  normalizePrefix,
  r2NameOfKey,
  uploadToR2,
  type R2DragItem,
  type R2File,
  type WengeDropAction,
} from "../lib/r2";
import {
  beginFileDragSession,
  cancelFileDragSession,
  createFileDragGhost,
  finishFileDragSession,
  isFileDragging,
  moveFileDragSession,
  registerWengeDrop,
  DRAG_THRESHOLD_PX,
} from "../lib/pointerDrag";
import {
  DOWNLOADS_CHANGED_EVENT,
  deleteDownload,
  listDownloads,
  openDownload,
  type DownloadDoc,
} from "../lib/downloads";
import { handleDownload } from "../lib/downloadTarget";
import {
  deleteVfsFile, getVfsFile, moveVfsFile, renameVfsFile, saveBlobToVfs, useVfsDirectory } from "../lib/vfs/store";
import type { VfsFile } from "../lib/vfs/types";
import { setPendingVfsFile, vfsOpenTarget } from "../lib/vfs/openWith";
import { getFsClipboard, setFsClipboard, type FsClipboardItem } from "../lib/fsClipboard";
import { sendItemToDesktop } from "../lib/desktopDropBridge";
import { fromExplorerPath, normalizeVfsDir, normalizeVfsPath } from "../lib/vfs/path";
import { setBusy } from "../hooks/useAnimatedCursor";

// --- Animated busy cursor (wait_0..wait_7) while async folder loads are in flight ---
// A module-level ref counter lets multiple Explorer windows coexist: the global
// w95-busy class is only cleared once the LAST window stops loading.
let explorerBusyRefs = 0;
function acquireExplorerBusy() {
  if (explorerBusyRefs === 0) setBusy(true);
  explorerBusyRefs += 1;
}
function releaseExplorerBusy() {
  explorerBusyRefs = Math.max(0, explorerBusyRefs - 1);
  if (explorerBusyRefs === 0) setBusy(false);
}

export type ExplorerOpenId = "notepad"|"wordpad"|"paint"|"calc"|"clock"|"msdos"|"minesweeper"|"solitaire"|"freecell"|"hearts"|"media-player"|"cd-player"|"sound-recorder"|"volume"|"control"|"help"|"find"|"recycle"|"network"|"my-computer"|string;

type FEntry = { name: string; size: string; type: string; app?: string };

/**
 * 右クリック対象の1行 (コンテキストメニュー用)。
 * デスクトップのアプリアイコンと同じメニュー (Open/Explore/Cut/Copy/Paste/
 * Create Shortcut/Delete/Rename/Properties) を表示するためのエントリ情報。
 */
type ExplorerCtxRow =
  | { t: "r2-folder"; name: string; prefix: string }
  | { t: "r2-file"; key: string; name: string; url: string; size: number; mime: string }
  | { t: "vfs-file"; id: string; name: string; mime: string; size: number }
  | { t: "fs-folder"; name: string; childPath: string }
  | { t: "fs-file"; name: string; size: string; type: string; app?: string };

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

export function ExplorerApp({ onOpenApp, initialPath }: { onOpenApp?: (id: any, file?: VfsFile) => void; initialPath?: string | null }) {
  const [path, setPath] = useState(initialPath ?? "C:\\Wenge\\Documents");
  const [input, setInput] = useState(initialPath ?? "C:\\Wenge\\Documents");
  const [selected, setSelected] = useState<string | null>(null);
  // --- R2 state ---
  const [r2Prefix, setR2Prefix] = useState<string | null>(null); // null = local mode
  const [r2Files, setR2Files] = useState<R2File[]>([]);
  const [r2Folders, setR2Folders] = useState<string[]>([]);
  const [r2Loading, setR2Loading] = useState(false);
  const [r2Note, setR2Note] = useState<string | null>(null);
  const [r2NoteDismissed, setR2NoteDismissed] = useState(false);
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
    setR2NoteDismissed(false);
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

  // フォルダ移動・読込中はアニメーション待機カーソル (wait_0..wait_7) を表示する。
  const explorerLoading = r2Loading || dlLoading || vfsLoading;
  useEffect(() => {
    if (explorerLoading) acquireExplorerBusy();
    return () => { if (explorerLoading) releaseExplorerBusy(); };
  }, [explorerLoading]);
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
  // R2ファイルをダウンロード保存せず、その場で対応アプリで開く (画像・HTML・テキスト・音声/動画など)。
  // 開けない種類 (pdf/不明形式など) は従来どおりダウンロードダイアログにフォールバックする。
  const openR2Entry = async (r2key: string) => {
    const f = r2Files.find((x) => x.key === r2key);
    if (!f) return;
    const name = r2NameOfKey(f.key);
    const mime = guessMime(name);
    const target = vfsOpenTarget({ id: `r2:${f.key}`, name, mime } as VfsFile);
    if (target === "preview" || target === "explorer") {
      handleDownload({ name, mime, url: f.url, sourceR2Key: f.key });
      return;
    }
    setR2Busy(`Opening ${name}...`);
    try {
      const res = await fetch(f.url);
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      const blob = await res.blob();
      const vfsFile = {
        id: `r2:${f.key}`,
        path: `R2:/${f.key}`,
        name,
        dir: "R2:/",
        mime: blob.type || mime,
        size: blob.size || f.size,
        createdAt: f.uploadedAt,
        updatedAt: f.uploadedAt,
        sourceUrl: f.url,
        sourceR2Key: f.key,
        blob,
      } as VfsFile;
      const appId = target === "notepad" ? "notepad" : target === "wordpad" ? "wordpad" : target === "image-viewer" ? "image-viewer" : target === "ie" ? "ie" : "media-player";
      setPendingVfsFile(vfsFile);
      try {
        (window as any).__wengePendingVfs = vfsFile;
      } catch {}
      onOpenApp?.(appId, vfsFile);
    } catch (e: any) {
      showError("R2 File Share", e?.message || "Cannot open file.");
    } finally {
      setR2Busy(null);
    }
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
      const filesToUpload = Array.from(list);
      const folderSet = new Set<string>();
      for (const file of filesToUpload) {
        const filePath = file.webkitRelativePath || file.name;
        const parts = filePath.split('/');
        let cur = r2Prefix;
        for (let i = 0; i < parts.length - 1; i++) {
          cur += parts[i] + '/';
          folderSet.add(cur);
        }
      }
      await Promise.allSettled([...folderSet].map((folderPath) => {
        const folderName = folderPath.slice(r2Prefix.length).replace(/^\//, '');
        return createR2Folder(r2Prefix, folderName);
      }));
      for (const file of filesToUpload) {
        const filePath = file.webkitRelativePath || file.name;
        const parts = filePath.split('/');
        let fullKey = r2Prefix;
        for (let j = 0; j < parts.length; j++) {
          fullKey += parts[j];
          if (j !== parts.length - 1) fullKey += '/';
        }
        await uploadToR2(fullKey, file);
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

  // ---- Pointer Eventsベースのファイルドラッグ (ネイティブDnD不使用) ----
  // 行の onClick (選択) / onDoubleClick (開く) を壊さないよう、キャプチャも
  // preventDefaultも行わず、windowリスナーでしきい値超過後のみセッション化する。
  // touchはタップ操作に専念させ、ドラッグセッションは開始しない。
  type RowDragState = { pid: number; off: () => void };
  const rowDragRef = useRef<RowDragState | null>(null);
  const cancelRowDragListeners = () => {
    try { rowDragRef.current?.off(); } catch {}
    rowDragRef.current = null;
  };
  useEffect(() => () => { cancelRowDragListeners(); cancelFileDragSession(); }, []);
  const onFileRowPointerDown = (e: React.PointerEvent, payload: R2DragItem) => {
    if (e.pointerType === "touch") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    cancelRowDragListeners();
    const startX = e.clientX, startY = e.clientY, pid = e.pointerId;
    const ghostIcon = payload.kind === "folder" || payload.kind === "shortcut" ? ICONS.folderClosed : ICONS.fileWindows;
    const dragLabel = payload.kind === "shortcut" ? payload.label : payload.name;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pid || !rowDragRef.current) return;
      const mod = { ctrlKey: ev.ctrlKey, altKey: ev.altKey, shiftKey: ev.shiftKey };
      if (!isFileDragging()) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) <= DRAG_THRESHOLD_PX) return;
        beginFileDragSession(payload, createFileDragGhost(dragLabel, ghostIcon), ev.clientX, ev.clientY, mod);
      } else {
        moveFileDragSession(ev.clientX, ev.clientY, mod);
      }
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      cancelRowDragListeners();
      if (isFileDragging()) finishFileDragSession(ev.clientX, ev.clientY, { ctrlKey: ev.ctrlKey, altKey: ev.altKey, shiftKey: ev.shiftKey });
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      cancelRowDragListeners();
      cancelFileDragSession();
    };
    const off = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    rowDragRef.current = { pid, off };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  const [vfsBusy, setVfsBusy] = useState<string | null>(null);

  // --- 右クリック「デスクトップと同じメニュー」のための項目（コンテキストメニュー） ---

  const explorerCtxRef = useRef<ExplorerCtxRow | null>(null);

  /** 行の info からドラッグ(デスクトップ送信)用の R2DragItem を合成する */
  const asDragItem = (row: ExplorerCtxRow): R2DragItem => {
    switch(row.t) {
      case "r2-folder": return { kind: "folder", prefix: row.prefix, name: row.name };
      case "r2-file": return { kind: "file", key: row.key, name: row.name, url: row.url, size: row.size, mime: row.mime };
      case "vfs-file": return { kind: "vfs-file", id: row.id, name: row.name, mime: row.mime, size: row.size };
      case "fs-folder": return { kind: "shortcut", label: row.name, explorerPath: row.childPath, iconSrc: ICONS.folderClosed };
      case "fs-file": return { kind: "shortcut", label: row.name, appId: row.app, iconSrc: ICONS.fileWindows };
    }
  };

  /**
   * 行のキャプション(名称)を返す。 rename などで利用。
   */
  const rowNiceLabel = (row: ExplorerCtxRow): string => {
    switch(row.t){
      case "r2-folder": return row.name;
      case "r2-file": return row.name;
      case "vfs-file": return row.name;
      case "fs-folder": return row.name;
      case "fs-file": return row.name;
    }
  };

  // コンテキストメニューの表示位置 (ビューポート座標)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; row: ExplorerCtxRow } | null>(null);

  /** 行の右クリックハンドラー: メニューを開き、対象行を選択する
   */
  const ctxRowId = (row: ExplorerCtxRow): string => {
    switch(row.t){
      case "r2-folder": return `r2d:${row.name}`;
      case "r2-file": return `r2f:${row.key}`;
      case "vfs-file": return `vfs:${row.id}`;
      case "fs-folder": return row.name;
      case "fs-file": return row.name;
    }
  };

  const onRowContextMenu = (e: React.MouseEvent, row: ExplorerCtxRow) => {
    e.preventDefault();
    explorerCtxRef.current = row;
    setSelected(ctxRowId(row));
    setCtxMenu({ x: e.clientX, y: e.clientY, row });
  };

  /** コンテキストメニューを閉じる */
  const closeCtxMenu = (() => {
    // 選択を保持するかどうかは Dev プリンシパル次第。今回はメニューを閉じる際に
    // 選択を解除しない（後でダブルクリック等を想定）。ただし App.tsx のデスクトップ
    // と同じ挙動に合わせるため、[data-context-menu] 外クリック時に閉じる。
    setCtxMenu(null);
  }) as (() => void);

  /** Handle a click outside the menu -> close
   */
  useEffect(()=>{
    if(!ctxMenu) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if(t && t.closest("[data-explorer-ctx-menu]")) return;
      closeCtxMenu();
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [ctxMenu]);

  // --- コンテキストメニューの各アクション ---

  const openCtxRow = useCallback(async () => {
    const row = explorerCtxRef.current ?? ctxMenu?.row ?? null;
    if(!row) return;
    switch(row.t){
      case "r2-folder": void enterR2(row.prefix); break;
      case "r2-file": void openR2Entry(row.key); break;
      case "vfs-file": openVfsEntry(row.id); break;
      case "fs-folder": goTo(row.childPath); break;
      case "fs-file": openEntry({ name: row.name, size: row.size, type: row.type, app: row.app }); break;
    }
    closeCtxMenu();
  }, [enterR2, openR2Entry, openVfsEntry, openEntry, goTo]);

  const exploreCtxRow = useCallback(() => {
    const row = explorerCtxRef.current ?? ctxMenu?.row ?? null;
    if(!row) return;
    switch(row.t){
      case "r2-folder": void enterR2(row.prefix); break;
      case "fs-folder": goTo(row.childPath); break;
      case "r2-file": void enterR2(""); break;
      case "fs-file":
        // ファイルの Explore は現在フォルダ既表示のため何もしない
        break;
      case "vfs-file":
      default:
        void goUp();
    }
    closeCtxMenu();
  }, [enterR2, goTo, goUp]);

  const cutCopyCtxRow = useCallback((op: "cut" | "copy") => {
    const row = explorerCtxRef.current ?? ctxMenu?.row ?? null;
    if(!row) return;
    const label = rowNiceLabel(row);
    const clipboardItem: FsClipboardItem = {
      op,
      kind: row.t=== "vfs-file" ? "explorer-vfs"
        : row.t === "fs-file" ? "fs-file"
        : row.t === "fs-folder" ? "fs-folder"
        : row.t === "r2-folder" ? "r2-folder"
        : row.t === "r2-file" ? "r2-file"
        : "unknown",
      id: row.t === "vfs-file" ? row.id : row.t === "r2-file" ? row.key : row.t === "fs-file" ? row.name : row.t === "fs-folder" ? row.name : row.t === "r2-folder" ? row.prefix : label,
      label,
      item: row,
    };
    setFsClipboard(clipboardItem);
    closeCtxMenu();
  }, [rowNiceLabel]);


  const shortcutCtxRow = useCallback(() => {
    const row = explorerCtxRef.current ?? ctxMenu?.row ?? null;
    if(!row) return;
    const item = asDragItem(row);
    sendItemToDesktop(item, "shortcut", ctxMenu?.x ?? 0, ctxMenu?.y ?? 0);
    closeCtxMenu();
  }, [asDragItem, ctxMenu, sendItemToDesktop]);

  const deleteCtxRow = useCallback(async () => {
    const row = explorerCtxRef.current ?? ctxMenu?.row ?? null;
    if(!row) return;
    const label = rowNiceLabel(row);
    let ok = false;
    switch(row.t){
      case "r2-folder":
        ok = await showConfirm("Explorer", `Delete '${label}' and everything inside it?\nThis cannot be undone.`, "Delete","Cancel");
        if(!ok) return;
        await deleteR2Key(row.prefix);
        void refreshR2(r2Prefix!);
        break;
      case "r2-file":
        ok = await showConfirm("Explorer", `Delete '${label}'?\nThis cannot be undone.`, "Delete","Cancel");
        if(!ok) return;
        await deleteR2Key(row.key);
        void refreshR2(r2Prefix!);
        break;
      case "vfs-file":
        ok = await showConfirm("Explorer", `Delete '${label}'?\nThis cannot be undone.`, "Delete","Cancel");
        if(!ok) return;
        try{
          await deleteVfsFile(row.id);
          void refreshVfs();
        }catch(e:any){ showError("Explorer", e?.message || "Delete failed."); }
        break;
      case "fs-file":
      case "fs-folder":
        showInfo("Explorer", `Cannot delete.\nIt is a system folder.`);
        return;
    }
    closeCtxMenu();
  }, [rowNiceLabel, r2Prefix, deleteR2Key, deleteVfsFile, refreshVfs, refreshR2]);

  const renameCtxRow = useCallback(async () => {
    const row = explorerCtxRef.current ?? ctxMenu?.row ?? null;
    if(!row) return;

    if(row.t === "vfs-file"){
      const ok = await showConfirm("Explorer", `Rename '${rowNiceLabel(row)}'?`, "Rename","Cancel");
      if(!ok) return;
      setVfsBusy("Renaming...");
      try{
        const src = await getVfsFile(row.id);
        if(!src) throw new Error("File not found.");
        const newName = window.prompt("Rename to:", src.name);
        if(!newName || !newName.trim()) { closeCtxMenu(); return; }
        await renameVfsFile(row.id, newName.trim());
        void refreshVfs();
      }catch(e:any){ showError("Explorer", e?.message || "Rename failed."); }
      finally{ setVfsBusy(null); }
      closeCtxMenu();
      return;
    }

    if(row.t === "fs-file"){
      showInfo("Explorer", `Cannot rename.\nIt is a system file.`);
      return;
    }
    showError("Explorer", `Cannot rename this kind.`);
    closeCtxMenu();
  }, [vfsBusy, refreshVfs, rowNiceLabel]);

  const propertiesCtxRow = useCallback(() => {
    const row = explorerCtxRef.current ?? ctxMenu?.row ?? null;
    if(!row) return;
    switch(row.t){
      case "r2-folder":
        showInfo(`${row.name} Properties`, `Type: Folder\nLocation: R2\nName: ${row.name}`);
        break;
      case "r2-file":
        showInfo(`${row.name} Properties`, `Type: R2 File\nName: ${row.name}\nSize: ${(row.size/1024).toFixed(1)} KB`);
        break;
      case "vfs-file": {
        const src = vfsFiles.find((x)=> x.id===row.id);
        const sizeKb = src ? (src.size/1024).toFixed(1) : "unknown";
        showInfo(`${src?.name ?? row.name} Properties`, `Type: ${src?.mime ?? "File"}\nLocation: C:\\Desktop\nSize: ${sizeKb} KB`);
        break;
      }
      case "fs-folder":
        showInfo(`${row.name} Properties`, `Type: Folder\nLocation: ${row.childPath}`);
        break;
      case "fs-file":
        showInfo(`${row.name} Properties`, `Type: ${row.type}\nLocation: ${row.app ? `Opens with: ${row.app}` : "Unknown"}`);
        break;
    }
    closeCtxMenu();
  }, [vfsFiles, rowNiceLabel]);

  // VFSフォルダへのコピー (Explorer内DnD / OSファイルDnDの受け皿)
  const copyR2FileToVfs = async (targetDir: string, item: Extract<R2DragItem, { kind: "file" }>) => {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const blob = await res.blob();
    await saveBlobToVfs({ blob, dir: targetDir, name: item.name, mime: blob.type || item.mime || guessMime(item.name) });
  };

  const dropWengeItemToVfs = async (targetDir: string, item: R2DragItem, action: WengeDropAction = "move") => {
    const dir = normalizeVfsDir(targetDir);
    if (item.kind === "vfs-file") {
      const src = await getVfsFile(item.id);
      if (!src) throw new Error("Source file not found.");
      if (normalizeVfsDir(src.dir) === dir) return; // 同一フォルダ内はなにもしない
      if (action === "shortcut") return; // Explorer一覧はショートカットを表示しない
      if (action === "copy" || item.id === undefined) {
        await saveBlobToVfs({ blob: src.blob, dir, name: src.name, mime: src.mime, sourceUrl: src.sourceUrl, sourceR2Key: src.sourceR2Key });
        return;
      }
      // 無修飾 = 移動 (Documents/Downloads/Desktop相互)
      await moveVfsFile(item.id, dir);
      return;
    }
    if (item.kind === "file") {
      await copyR2FileToVfs(dir, item);
      return;
    }
    // ショートカットはVFSフォルダにはコピーしない (デスクトップ専用)
    if (item.kind !== "folder") return;
    // R2フォルダごとコピー
    const files = await listR2Flat(item.prefix);
    if (files.length === 0) { showInfo("Explorer", `Folder '${item.name}' is empty.\nNothing to copy.`); return; }
    for (const f of files) {
      const rel = f.key.slice(item.prefix.length) || r2NameOfKey(f.key);
      const res = await fetch(f.url);
      if (!res.ok) continue;
      const blob = await res.blob();
      const name = `${item.name}/${rel}`;
      await saveBlobToVfs({ blob, dir, name, mime: blob.type || guessMime(name), sourceR2Key: f.key });
    }
  };

  const onUploadOsFilesToVfs = async (targetDir: string, list: FileList | null) => {
    if (!list || list.length === 0) return;
    setVfsBusy("Copying...");
    try {
      for (const f of Array.from(list)) {
        await saveBlobToVfs({ blob: f, dir: targetDir, name: f.name, mime: f.type || guessMime(f.name) });
      }
      refreshVfs();
    } catch (e: any) {
      showError("Explorer", e?.message || "Copy failed.");
    } finally {
      setVfsBusy(null);
    }
  };

  // Pointer DnD用: VFSフォルダへのコピー/移動実処理 (無修飾=移動 / Ctrl=コピー / Alt=無視)
  const dropPointerFileToVfs = useCallback(async (targetDir: string, item: R2DragItem, action: WengeDropAction = "move") => {
    if (item.kind === "vfs-file" && action === "shortcut") return; // Explorer一覧はショートカットを表示しない
    setVfsBusy(action === "copy" ? "Copying..." : "Moving...");
    try {
      await dropWengeItemToVfs(targetDir, item, action);
      refreshVfs();
    } catch (err: any) {
      showError("Explorer", (action === "copy" ? "Copy failed.\n" : "Move failed.\n") + (err?.message || "Could not copy file."));
    } finally {
      setVfsBusy(null);
    }
  }, [refreshVfs]);

  // Pointer DnD用: R2へのコピー (VFS -> R2アップロード扱い)
  const dropPointerFileToR2 = useCallback(async (prefix: string, item: R2DragItem) => {
    if (item.kind !== "vfs-file") return;
    setR2Busy("Uploading...");
    try {
      const src = await getVfsFile(item.id);
      if (!src) throw new Error("Source file not found.");
      const file = new File([src.blob], src.name, { type: src.mime || guessMime(src.name) });
      await uploadToR2(prefix, file);
      await refreshR2(prefix);
  } catch (err: any) {
    showError("R2 File Share", err?.message || "Upload failed.");
  } finally {
    setR2Busy(null);
  }
}, [refreshR2]);

  const pasteCtxRow = useCallback(async () => {
    const cb = getFsClipboard();
    if(!cb) return;

    if(cb.kind === "explorer-r2" || cb.kind === "r2-file") {
      const row = cb.item as Extract<ExplorerCtxRow, { t: "r2-file" }> | undefined;
      if(!row) { showError("Paste","Unable to paste."); return; }
      if(inR2 && r2Prefix) {
        if(cb.op === "copy"){
          await dropPointerFileToR2(r2Prefix!, row as any);
          void refreshR2(r2Prefix!);
        } else {
          showError("Paste","Cut to R2 is not supported yet.");
        }
        closeCtxMenu();
        return;
      }
      if(!isVfsDir || !vfsPath){ showError("Paste","Cannot paste to this folder."); return; }
      const item = { kind: "file" as const, ...row } as R2DragItem;
      await dropPointerFileToVfs(vfsPath, item, cb.op as WengeDropAction);
      void refreshVfs();
      closeCtxMenu();
      return;
    }

    if(cb.kind === "explorer-vfs") {
      const row = cb.item as Extract<ExplorerCtxRow, { t: "vfs-file" }> | undefined;
      if(!row){ showError("Paste","Unable to paste."); return; }
      if(isVfsDir && vfsPath) await dropPointerFileToVfs(vfsPath, { kind: "vfs-file", id: row.id, name: row.name, mime: row.mime, size: row.size }, cb.op as WengeDropAction);
      else if(inR2 && r2Prefix){
        await dropPointerFileToR2(r2Prefix, { kind: "vfs-file", id: row.id, name: row.name, mime: row.mime, size: row.size });
      }
      void refreshVfs();
      closeCtxMenu();
      return;
    }

    showError("Paste","Item of this type cannot be pasted here.");
    closeCtxMenu();
  }, [getFsClipboard, inR2, r2Prefix, isVfsDir, vfsPath, refreshVfs, refreshR2, dropPointerFileToR2, dropPointerFileToVfs]);

  // ドロップ先エレメントの登録 (一覧ペイン + 左ペインのVFSフォルダ)
  const listPaneRef = useRef<HTMLDivElement | null>(null);
  const navDesktopRef = useRef<HTMLDivElement | null>(null);
  const navDocsRef = useRef<HTMLDivElement | null>(null);
  const navDlRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const pane = listPaneRef.current;
    if (pane) {
      if (inR2 && r2Prefix !== null) {
        const prefix = r2Prefix;
        cleanups.push(registerWengeDrop(pane, { onDrop: (payload) => { void dropPointerFileToR2(prefix, payload); } }));
      } else if (!inR2 && isVfsDir && vfsPath) {
        const dir = vfsPath;
        cleanups.push(registerWengeDrop(pane, { onDrop: (payload, _pos, action) => { void dropPointerFileToVfs(dir, payload, action ?? "move"); } }));
      } else if (!inR2 && !inDownloads) {
        // 実体のない仮想フォルダ (C:\Windows等): 何もせず受け止める。
        // (登録しないと背後のデスクトップに素通りしてしまうため)
        cleanups.push(registerWengeDrop(pane, { onDrop: () => {} }));
      }
    }
    const navs: Array<[React.RefObject<HTMLDivElement | null>, string]> = [
      [navDesktopRef, DESKTOP_KEY],
      [navDocsRef, DOCUMENTS_KEY],
      [navDlRef, DOWNLOADS_KEY],
    ];
    for (const [ref, target] of navs) {
      const el = ref.current;
      if (!el) continue;
      const dir = fromExplorerPath(target);
      cleanups.push(registerWengeDrop(el, { onDrop: (payload, _pos, action) => { void dropPointerFileToVfs(dir, payload, action ?? "move"); } }));
    }
    return () => { cleanups.forEach((fn) => { try { fn(); } catch {} }); };
  });

  // ネイティブDnDはOS外からの実ファイル受け入れ専用に残す。
  // (内部移動はPointer DnD、OSカーソルが出るのは外部ドロップ時のみ)
  const handleR2Drop = async (e: React.DragEvent) => {
    if (r2Prefix === null) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      await onUploadFiles(e.dataTransfer.files);
    }
  };
  const handleVfsDirDragOver = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types || []);
    if (types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleVfsDirDrop = (targetDir: string) => async (e: React.DragEvent) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      await onUploadOsFilesToVfs(targetDir, e.dataTransfer.files);
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
          <input ref={fileRef} type="file" multiple webkitdirectory directory mozdirectory style={{ display: "none" }} onChange={(e) => onUploadFiles(e.target.files)} />
          <Button size="sm" onClick={() => setMkdirOpen((v) => !v)} disabled={!!r2Busy}>New Folder...</Button>
          <Button size="sm" onClick={onDeleteSelected} disabled={!selected || !!r2Busy}>Delete</Button>
          <Button size="sm" onClick={() => { if (selected?.startsWith("r2f:")) openR2Entry(selected.slice(4)); }} disabled={!selected?.startsWith("r2f:") || !!r2Busy}>Open</Button>
          <Button size="sm" onClick={onDownloadSelected} disabled={!selected?.startsWith("r2f:") || !!r2Busy}>Download...</Button>
            <span style={{ fontSize: 11, color: "#555" }}>{r2Busy ?? (r2Loading ? "Loading..." : "")}</span>
        </div>
      )}
      {isVfsDir && !inDownloads && (
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <Button size="sm" onClick={() => refreshVfs()} disabled={vfsLoading}>Refresh</Button>
          <Button size="sm" onClick={() => { const f = vfsFiles.find((x) => `vfs:${x.id}` === selected); if (f) openVfsEntry(f.id); }} disabled={!selected?.startsWith("vfs:")}>Open</Button>
          <Button size="sm" onClick={() => { const id = (selected ?? "").slice(4); if (selected?.startsWith("vfs:") && id) deleteVfsEntry(id); }} disabled={!selected?.startsWith("vfs:")}>Delete</Button>
            {vfsBusy && <span style={{ fontSize: 11, color: "#555" }}>{vfsBusy}</span>}
            {vfsLoading && <span style={{ fontSize: 11, color: "#555" }}>Loading...</span>}
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
          <span style={{ fontSize: 11, color: "#555" }}>{dlLoading ? "Loading..." : ""}</span>
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
            const isVfsTarget = n.target === DESKTOP_KEY || n.target === DOCUMENTS_KEY || n.target === DOWNLOADS_KEY;
            const vfsTargetDir = isVfsTarget ? fromExplorerPath(n.target) : null;
            const navRef = n.target === DESKTOP_KEY ? navDesktopRef : n.target === DOCUMENTS_KEY ? navDocsRef : n.target === DOWNLOADS_KEY ? navDlRef : null;
            return (<div key={n.label} ref={navRef ?? undefined} data-wenge-drop={isVfsTarget ? `explorer-nav:${n.label}` : undefined} onClick={() => { if (n.target === "__recycle") onOpenApp?.("recycle"); else if (n.target === "__network") onOpenApp?.("network"); else if (n.target === "__r2") enterR2(""); else goTo(n.target); }}
              onDragOver={isVfsTarget ? handleVfsDirDragOver : undefined}
              onDrop={isVfsTarget && vfsTargetDir ? handleVfsDirDrop(vfsTargetDir) : undefined}
              title={isVfsTarget ? `Drop files here to copy to ${n.label}` : undefined}
              style={{ paddingLeft: (n.label === "Wenge" || n.label === "Windows" || n.label === "Downloads" || n.label === "Desktop" || n.label === "Documents") ? 12 : 0, background: active ? "#000080" : "transparent", color: active ? "#fff" : "#000", display: "flex", alignItems: "center", gap: 4, cursor: "url('/cursors/arrow.png') 0 0, default", paddingTop: 2, paddingBottom: 2 }}><img src={n.icon} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} draggable={false} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {n.label}</div>);
          })}
        </Frame>
        {ctxMenu && (
          <div
            data-explorer-ctx-menu
            style={{ position: "fixed", left: ctxMenu.x + 4, top: ctxMenu.y + 2, zIndex: 9999, minWidth: 168, background: "#c0c0c0", border: "2px outset #fff", padding: 2, fontFamily: "MS Sans Serif", fontSize: 11, boxShadow: "2px 2px 5px rgba(0,0,0,0.4)" }}
            onMouseDown={(e)=> e.stopPropagation()}
            onContextMenu={(e)=> { e.preventDefault(); e.stopPropagation(); }}
          >
            <MenuList data-explorer-ctx-menu style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 0 }}>
              <MenuListItem primary onClick={openCtxRow} style={{ fontSize: 11, height: 18, display: "flex", alignItems: "center", justifyContent: "flex-start", padding: "0 12px 0 20px", lineHeight: 1.15 }}><b style={{ fontWeight: 700 }}>Open</b></MenuListItem>
              <MenuListItem onClick={exploreCtxRow} style={{ fontSize: 11, height: 18, display: "flex", alignItems: "center", justifyContent: "flex-start", padding: "0 12px 0 20px", lineHeight: 1.15 }}>Explore</MenuListItem>
              <Separator data-explorer-ctx-menu style={{ height: 10, margin: "2px 4px 2px 4px" }} />
              <MenuListItem disabled={!ctxMenu?.row} onClick={()=> cutCopyCtxRow("cut")} style={{ fontSize: 11, height: 18, display: "flex", alignItems: "center", justifyContent: "flex-start", padding: "0 12px 0 20px", lineHeight: 1.15 }}>Cut</MenuListItem>
              <MenuListItem disabled={!ctxMenu?.row} onClick={()=> cutCopyCtxRow("copy")} style={{ fontSize: 11, height: 18, display: "flex", alignItems: "center", justifyContent: "flex-start", padding: "0 12px 0 20px", lineHeight: 1.15 }}>Copy</MenuListItem>
              <MenuListItem disabled={!getFsClipboard()} onClick={()=> pasteCtxRow()} style={{ fontSize: 11, height: 18, display: "flex", alignItems: "center", justifyContent: "flex-start", padding: "0 12px 0 20px", lineHeight: 1.15 }}>Paste{getFsClipboard() ? ` (${getFsClipboard()!.op==="cut" ? "Move" : "Copy"}: ${getFsClipboard()!.label})` : ""}</MenuListItem>
              <Separator data-explorer-ctx-menu style={{ height: 10, margin: "2px 4px 2px 4px" }} />
              <MenuListItem onClick={shortcutCtxRow} style={{ fontSize: 11, height: 18, display: "flex", alignItems: "center", justifyContent: "flex-start", padding: "0 12px 0 20px", lineHeight: 1.15 }}>Create Shortcut</MenuListItem>
              <MenuListItem onClick={deleteCtxRow} style={{ fontSize: 11, height: 18, display: "flex", alignItems: "center", justifyContent: "flex-start", padding: "0 12px 0 20px", lineHeight: 1.15 }}>Delete</MenuListItem>
              <MenuListItem onClick={renameCtxRow} style={{ fontSize: 11, height: 18, display: "flex", alignItems: "center", justifyContent: "flex-start", padding: "0 12px 0 20px", lineHeight: 1.15 }}>Rename</MenuListItem>
              <Separator data-explorer-ctx-menu style={{ height: 10, margin: "2px 4px 2px 4px" }} />
              <MenuListItem onClick={propertiesCtxRow} style={{ fontSize: 11, height: 18, display: "flex", alignItems: "center", justifyContent: "flex-start", padding: "0 12px 0 20px", lineHeight: 1.15 }}>Properties</MenuListItem>
            </MenuList>
          </div>
        )}
        <Frame
          variant="well"
          style={{ flex: 1, background: "#fff", padding: 0, overflow: "hidden", minHeight: 0, position: "relative" }}
          onDragOver={(e) => {
            const types = Array.from(e.dataTransfer.types || []);
            if (types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }
          }}
          onDrop={inR2 ? handleR2Drop : (isVfsDir && vfsPath) ? handleVfsDirDrop(vfsPath) : undefined}
          title={inR2 ? "Drop OS/VFS files here to upload · drag files out to the Desktop" : (isVfsDir ? "Drop files here to move (Ctrl=copy) · drag files out to the Desktop" : undefined)}
        >
          <div ref={listPaneRef} data-wenge-drop="explorer-pane" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "auto" }}>
            {inR2 ? (
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#c0c0c0" }}><th style={{ textAlign: "left", padding: 3 }}>Name</th><th>Size</th><th>Type</th></tr></thead>
                <tbody>
                  {!!r2Prefix && (<tr onClick={goUp} onDoubleClick={goUp} style={{ cursor: "url('/cursors/arrow.png') 0 0, default" }} title="Up to parent folder"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> ..</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Parent Folder</td></tr>)}
                  {r2Folders.map((fd) => {
                    const sel = selected === `r2d:${fd}`;
                    return (<tr key={`d:${fd}`} onPointerDown={(e) => onFileRowPointerDown(e, { kind: "folder", prefix: `${r2Prefix}${fd}/`, name: fd })} onClick={() => setSelected(sel ? null : `r2d:${fd}`)} onDoubleClick={() => enterR2(`${r2Prefix}${fd}/`)} onContextMenu={(e)=> onRowContextMenu(e, {t:"r2-folder", name:fd, prefix:`${r2Prefix}${fd}/`})} style={{ borderTop: "1px solid #c0c0c0", background: sel ? "#000080" : "transparent", color: sel ? "#fff" : "#000", cursor: "url('/cursors/arrow.png') 0 0, default", touchAction: "pan-y" }} title="Drag to the Desktop to copy this folder"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} draggable={false} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {fd}</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Folder</td></tr>);
                  })}
                  {r2Files.map((f) => {
                    const name = r2NameOfKey(f.key);
                    const sel = selected === `r2f:${f.key}`;
                    return (<tr key={f.key} onPointerDown={(e) => onFileRowPointerDown(e, { kind: "file", key: f.key, name, url: f.url, size: f.size, mime: guessMime(name) })} onClick={() => setSelected(sel ? null : `r2f:${f.key}`)} onDoubleClick={() => openR2Entry(f.key)} onContextMenu={(e)=> onRowContextMenu(e, {t:"r2-file", key:f.key, name, url:f.url, size:f.size, mime:guessMime(name)})} style={{ borderTop: "1px solid #c0c0c0", background: sel ? "#000080" : "transparent", color: sel ? "#fff" : "#000", cursor: "url('/cursors/arrow.png') 0 0, default", touchAction: "pan-y" }} title="Drag to the Desktop to move (Ctrl=copy, Alt=shortcut) · double-click to open in app"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.fileWindows} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} draggable={false} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {name}</td><td style={{ textAlign: "center" }}>{formatSize(f.size)}</td><td style={{ textAlign: "center" }}>R2 File</td></tr>);
                  })}
                </tbody>
              </table>
            ) : isVfsDir ? (
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#c0c0c0" }}><th style={{ textAlign: "left", padding: 3 }}>Name</th><th>Size</th><th>Type</th></tr></thead>
                <tbody>
                  <tr onClick={() => goTo("C:\\Wenge")} onDoubleClick={() => goTo("C:\\Wenge")} style={{ cursor: "url('/cursors/arrow.png') 0 0, default" }} title="Up to parent folder"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> ..</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Parent Folder</td></tr>
                  {vfsFiles.map((f) => {
                    const sel = selected === `vfs:${f.id}`;
                    return (<tr key={f.id} onPointerDown={(e) => onFileRowPointerDown(e, { kind: "vfs-file", id: f.id, name: f.name, mime: f.mime, size: f.size })} onClick={() => setSelected(sel ? null : `vfs:${f.id}`)} onDoubleClick={() => openVfsEntry(f.id)} onContextMenu={(e)=> onRowContextMenu(e, {t:"vfs-file", id:f.id, name:f.name, mime:f.mime, size:f.size})} style={{ borderTop: "1px solid #c0c0c0", background: sel ? "#000080" : "transparent", color: sel ? "#fff" : "#000", cursor: "url('/cursors/arrow.png') 0 0, default", touchAction: "pan-y" }} title="Drag to the Desktop to move (Ctrl=copy, Alt=shortcut) · double-click to open in app"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.fileWindows} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} draggable={false} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {f.name}</td><td style={{ textAlign: "center" }}>{formatSize(f.size)}</td><td style={{ textAlign: "center" }}>{vfsOpenTarget(f)}</td></tr>);
                  })}
                </tbody>
              </table>
            ) : inDownloads ? (
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#c0c0c0" }}><th style={{ textAlign: "left", padding: 3 }}>Name</th><th>Size</th><th>Type</th></tr></thead>
                <tbody>
                  <tr onClick={() => goTo("C:\\Wenge")} onDoubleClick={() => goTo("C:\\Wenge")} style={{ cursor: "url('/cursors/arrow.png') 0 0, default" }} title="Up to parent folder"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> ..</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Parent Folder</td></tr>
                  {dlDocs.map((d) => {
                    const name = d.name.split("/").pop() || d.name;
                    const sel = selected === `dl:${d.id}`;
                    return (<tr key={d.id} onPointerDown={(e) => onFileRowPointerDown(e, { kind: "vfs-file", id: d.id, name, mime: d.mime, size: d.size })} onClick={() => setSelected(sel ? null : `dl:${d.id}`)} onDoubleClick={() => openDownload(d)} onContextMenu={(e)=> onRowContextMenu(e, {t:"vfs-file", id:d.id, name, mime:d.mime, size:d.size})} style={{ borderTop: "1px solid #c0c0c0", background: sel ? "#000080" : "transparent", color: sel ? "#fff" : "#000", cursor: "url('/cursors/arrow.png') 0 0, default", touchAction: "pan-y" }} title="Drag to the Desktop to move (Ctrl=copy, Alt=shortcut) · double-click to open"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.fileWindows} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} draggable={false} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {name}</td><td style={{ textAlign: "center" }}>{formatSize(d.size)}</td><td style={{ textAlign: "center" }}>Download</td></tr>);
                  })}
                </tbody>
              </table>
            ) : (
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#c0c0c0" }}><th style={{ textAlign: "left", padding: 3 }}>Name</th><th>Size</th><th>Type</th></tr></thead>
                <tbody>
                  {key !== "C:\\" && (<tr onClick={goUp} onDoubleClick={goUp} style={{ cursor: "url('/cursors/arrow.png') 0 0, default" }} title="Up to parent folder"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> ..</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Parent Folder</td></tr>)}
                  {folders.map((fd) => {
                    const childPath = key === "C:\\" ? ("C:\\" + fd) : (key + "\\" + fd);
                    return (<tr key={fd} onPointerDown={(e) => onFileRowPointerDown(e, { kind: "shortcut", label: fd, explorerPath: childPath, iconSrc: ICONS.folderClosed })} onClick={() => setSelected(fd)} onDoubleClick={() => goTo(childPath)} onContextMenu={(e)=> onRowContextMenu(e, {t:"fs-folder", name:fd, childPath})} title="Drag to the Desktop to create a shortcut" style={{ borderTop: "1px solid #c0c0c0", background: selected === fd ? "#000080" : "transparent", color: selected === fd ? "#fff" : "#000", cursor: "url('/cursors/arrow.png') 0 0, default" }}><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {fd}</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Folder</td></tr>);
                  })}
                  {files.map((f) => (<tr key={f.name} onPointerDown={(e) => onFileRowPointerDown(e, { kind: "shortcut", label: f.name, appId: f.app, iconSrc: ICONS.fileWindows })} onClick={() => setSelected(f.name)} onDoubleClick={() => openEntry(f)} onContextMenu={(e)=> onRowContextMenu(e, {t:"fs-file", name:f.name, size:f.size, type:f.type, app:f.app})} title="Drag to the Desktop to create a shortcut" style={{ borderTop: "1px solid #c0c0c0", background: selected === f.name ? "#000080" : "transparent", color: selected === f.name ? "#fff" : "#000", cursor: "url('/cursors/arrow.png') 0 0, default" }}><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.fileWindows} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {f.name}</td><td style={{ textAlign: "center" }}>{f.size}</td><td style={{ textAlign: "center" }}>{f.type}</td></tr>))}
                </tbody>
              </table>
            )}
            {!inR2 && !dir && <div style={{ padding: 16, fontSize: 11 }}>Folder not found. <a href="#" onClick={(e) => { e.preventDefault(); goTo("C:\\"); }}>Back to C:\</a></div>}
            {inR2 && !r2Loading && r2Folders.length === 0 && r2Files.length === 0 && (
              <div style={{ padding: 16, fontSize: 11, color: "#555" }}>
                {r2Note && !r2NoteDismissed && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, background: "#ffffe1", border: "1px solid #808080", padding: "4px 6px", color: "#000" }}>
                    <span style={{ flex: 1 }}>{r2Note}</span>
                    <Button size="sm" onClick={() => setR2NoteDismissed(true)} title="Dismiss this message">×</Button>
                  </div>
                )}
                Empty folder. Upload files or create a folder — or drop OS files here.
              </div>
            )}
            {inDownloads && !dlLoading && dlDocs.length === 0 && (
              <div style={{ padding: 16, fontSize: 11, color: "#555" }}>Empty. Files you save via "Wenge内" will appear here.</div>
            )}
          </div>
          </Frame>
      </div>
      <div style={{ height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f0f0", borderTop: "1px solid #808080", fontSize: 11, flexShrink: 0 }}>
        <ProgressBar value={inR2 ? (r2Loading ? 50 : 100) : inDownloads ? (dlLoading ? 50 : 100) : (dir ? 100 : 0)} style={{ height: 32, width: "100%" }} />
      </div>
    </div>
  );
}
