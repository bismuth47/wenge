import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import {
  Button,
  MenuList,
  MenuListItem,
  Separator,
  Toolbar,
  AppBar,
  Frame,
  TextInput,
  Checkbox,
  Fieldset,
  ProgressBar,
  Slider,
  GroupBox,
  Radio,
} from "react95";
import { WindowFrame } from "./components/WindowFrame";
import { Win95Scroll } from "./components/Win95Scroll";
import { SystemDialogs, showConfirm, showError, showInfo } from "./components/SystemDialog";
import { XpBoot } from "./components/XpBoot";
import { XpLogin } from "./components/XpLogin";
import { useClock } from "./hooks/useClock";
import { SOUNDS, useSound, getVolume, getSoundEnabled, setSoundEnabled, setVolume, applyMasterVolume } from "./hooks/useSound";
import { useAnimatedCursor } from "./hooks/useAnimatedCursor";
import { NotepadApp } from "./apps/Notepad";
import { MyComputerApp } from "./apps/MyComputer";
import { RecycleBinApp } from "./apps/RecycleBin";
import { InternetExplorerApp } from "./apps/InternetExplorer";
import { AboutWengeApp } from "./apps/AboutWenge";
import { FileShareApp } from "./apps/FileShare";
import { ChatApp } from "./apps/ChatApp";
import { ControlPanelApp } from "./apps/ControlPanel";
import { ExplorerApp } from "./apps/ExplorerApp";
import { RunDialog } from "./apps/RunDialog";
import { MinesweeperApp } from "./apps/Minesweeper";
import { MediaPlayerApp } from "./apps/MediaPlayer";
import { WordPadApp } from "./apps/WordPad";
import { MsDosApp } from "./apps/MsDos";
import { ExeRunnerApp } from "./apps/ExeRunner";
import { ClockApp } from "./apps/ClockApp";
import { CharMapApp } from "./apps/CharMap";
import { SoundRecorderApp } from "./apps/SoundRecorder";
import { VolumeControlApp } from "./apps/VolumeControl";
import { SolitaireApp } from "./apps/Solitaire";
import { FreeCellApp } from "./apps/FreeCell";
import { HeartsApp } from "./apps/Hearts";
import { BackupApp } from "./apps/Backup";
import { ScanDiskApp } from "./apps/ScanDisk";
import { SysMonApp } from "./apps/SysMon";
import { FindApp } from "./apps/Find";
import { HelpApp } from "./apps/Help";
import { BriefcaseApp } from "./apps/Briefcase";
import { DialerApp } from "./apps/Dialer";
import { NetworkApp } from "./apps/Network";
import { CdPlayerApp } from "./apps/CdPlayer";
import { ImageViewerApp } from "./apps/ImageViewer";
import { ICONS, ICON_FALLBACK } from "./assets/icons";
import { R2_DRAG_MIME, formatR2Path, guessMime, listR2, listR2Flat, markWengeDragEnd, markWengeDragStart, normalizePrefix, r2NameOfKey, type R2DragItem, type WengeDropAction } from "./lib/r2";
import {
  deleteDesktopDoc,
  docIconKey,
  docIdFromKey,
  isDocIconKey,
  listDesktopDocs,
  saveDocFromBlob,
  type DesktopDoc,
} from "./lib/desktopDocs";
import { VFS_CHANGED_EVENT, copyVfsFile, getVfsFile, moveVfsFile, renameVfsFile } from "./lib/vfs/store";
import { VFS_DESKTOP } from "./lib/vfs/types";
import { normalizeVfsDir } from "./lib/vfs/path";
import { useFsClipboard, setFsClipboard } from "./lib/fsClipboard";
import { onSendToDesktop } from "./lib/desktopDropBridge";
import { beginFileDragSession, cancelFileDragSession, createFileDragGhost, finishFileDragSession, initPointerDragCleanup, isFileDragging, moveFileDragSession, registerWengeDrop, DRAG_THRESHOLD_PX } from "./lib/pointerDrag";
import { setPendingVfsFile, vfsOpenTarget } from "./lib/vfs/openWith";
import type { VfsFile } from "./lib/vfs/types";
import {
  RESOLUTION_EVENT,
  RESOLUTIONS,
  UI_SCALE_EVENT,
  getResolution,
  getUiScale,
  setViewMetrics,
  type ResolutionId,
  type UiScale,
} from "./lib/display";

// --- Types ---
type AppId =
  | "my-computer"
  | "recycle"
  | "notepad"
  | "wordpad"
  | "msdos"
  | "exe-runner"
  | "clock"
  | "charmap"
  | "sound-recorder"
  | "volume"
  | "solitaire"
  | "freecell"
  | "hearts"
  | "backup"
  | "scandisk"
  | "sysmon"
  | "find"
  | "help"
  | "briefcase"
  | "dialer"
  | "network"
  | "cd-player"
  | "ie"
  | "file-share"
  | "chat"
  | "about"
  | "control"
  | "minesweeper"
  | "media-player"
  | "paint"
  | "calc"
  | "explorer"
  | "image-viewer"
  | "run";

type WinState = {
  id: AppId;
  title: string;
  icon: string;
  iconSrc: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

// --- Styled ---
// 画面全体のステージ。仮想解像度モード時は黒帯レターボックス、Native時は壁紙色で全面。
const ScreenStage = styled.div<{ $virtual: boolean; $bg?: string }>`
  position: fixed;
  inset: 0;
  background: ${(p) => (p.$virtual ? "#000" : (p.$bg ?? "#008080"))};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const Desktop = styled.div<{ $bg?: string; $w?: number; $h?: number }>`
  width: ${(p) => (p.$w != null ? `${p.$w}px` : "100vw")};
  height: ${(p) => (p.$h != null ? `${p.$h}px` : "100vh")};
  ${(p) => (p.$h == null ? "height: 100dvh;" : "")}
  background: ${(p) => p.$bg ?? "#008080"};
  position: relative;
  overflow: hidden;
  padding-bottom: 30px;
  box-sizing: border-box;
  flex-shrink: 0;
  /* Pointer Eventsドラッグ用: タッチのスクロール横取りを防ぐ */
  touch-action: none;
`;

// Absolute positioned icons container
const IconsLayer = styled.div`
  position: absolute;
  inset: 0;
  bottom: 30px;
  overflow: hidden;
`;

const Icon = styled.div<{ $selected?: boolean; $x:number; $y:number }>`
  position: absolute;
  left: ${(p)=>p.$x}px;
  top: ${(p)=>p.$y}px;
  width: 80px;
  height: 84px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: url('/cursors/arrow.png') 0 0, default;
  padding: 4px;
  box-sizing: border-box;
  background: ${(p) => (p.$selected ? "#000080" : "transparent")};
  color: #fff;
  border: 1px dotted ${(p) => (p.$selected ? "#fff" : "transparent")};
  user-select: none;
  touch-action: none;
  &:active {
    background: #000080;
  }
`;

const IconImg = styled.img`
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  filter: drop-shadow(1px 1px 0 rgba(0, 0, 0, 0.6));
  object-fit: contain;
  flex-shrink: 0;
`;

const IconFallback = styled.span`
  font-size: 28px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  filter: drop-shadow(1px 1px 0 rgba(0, 0, 0, 0.6));
`;

const IconLabel = styled.div`
  font-size: 11px;
  text-align: center;
  line-height: 1.1;
  text-shadow: 1px 1px 0 #000;
  word-break: break-word;
  width: 100%;
`;

const SelectionRect = styled.div<{ $x:number; $y:number; $w:number; $h:number }>`
  position: absolute;
  left: ${(p)=>p.$x}px;
  top: ${(p)=>p.$y}px;
  width: ${(p)=>p.$w}px;
  height: ${(p)=>p.$h}px;
  border: 1px dotted #000;
  outline: 1px dotted #fff;
  background: rgba(0,0,128,0.12);
  pointer-events: none;
  z-index: 5;
`;

const ContextMenu = styled.div<{ $x:number; $y:number }>`
  position: absolute;
  left: ${(p)=>p.$x}px;
  top: ${(p)=>p.$y}px;
  z-index: 9998;
  min-width: 132px;
  max-width: 200px;
  background: #c0c0c0;
  border: 2px outset #fff;
  padding: 2px;
  font-size: 11px;
  & ul {
    padding: 0 !important;
    margin: 0 !important;
    display: flex !important;
    flex-direction: column;
    gap: 0 !important;
  }
  & li {
    margin: 0 !important;
    padding: 0 !important;
  }
  & [role="menuitem"] {
    font-size: 11px !important;
    line-height: 1.15 !important;
    min-height: 0 !important;
    height: 18px !important;
    margin: 0 !important;
    padding: 0 12px 0 20px !important;
    display: flex !important;
    align-items: center !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 196px;
  }
  & hr {
    margin: 0 1px !important;
  }
`;

const Taskbar = styled(AppBar)`
  position: absolute !important;
  bottom: 0 !important;
  top: auto !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  height: 30px !important;
  min-height: 30px !important;
  max-height: 30px !important;
  z-index: 9999;
  border-bottom: 0 !important;
  border-right: 0 !important;
  border-left: 0 !important;
  box-sizing: border-box;
`;

const StartButton = styled.button<{ $active?: boolean }>`
  width: 56px;
  height: 22px;
  min-height: 22px;
  max-height: 22px;
  margin: 0 0 0 4px;
  flex-shrink: 0;
  align-self: center;
  background: #c0c0c0;
  border-top: 2px solid #fff;
  border-left: 2px solid #fff;
  border-right: 2px solid #808080;
  border-bottom: 2px solid #808080;
  box-shadow: inset 0 0 0 1px #dfdfdf, 1px 1px 0 #000;
  font-family: 'ms_sans_serif';
  font-weight: bold;
  font-size: 11px;
  line-height: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  box-sizing: border-box;
  cursor: url('/cursors/arrow.png') 0 0, default;
  user-select: none;
  position: relative;
  vertical-align: middle;
  ${(p) => p.$active && `
    border-top: 2px solid #808080;
    border-left: 2px solid #808080;
    border-right: 2px solid #fff;
    border-bottom: 2px solid #fff;
    box-shadow: inset 1px 1px 0 #000;
    padding-top: 1px;
    padding-left: 5px;
  `}
  &:focus { outline: none; }
`;

const StartMenuWrap = styled.div`
  position: absolute;
  left: 2px;
  bottom: 32px;
  z-index: 9998;
  width: 210px;
  max-height: calc(100vh - 40px);
  overflow: visible;
  cursor: url('/cursors/arrow.png') 0 0, default;
  /* react95 MenuListItem sets cursor default internally: override it
     (and its children like img and span) so the Win95 arrow cursor
     persists over every start-menu row including the Programs submenu */
  li, li * {
    cursor: url('/cursors/arrow.png') 0 0, default !important;
  }
`;

const VolumePopup = styled.div`
  position: absolute;
  bottom: 34px;
  right: 6px;
  z-index: 9998;
  width: 190px;
  padding: 8px 10px 10px;
  background: #c0c0c0;
  border-top: 2px solid #fff;
  border-left: 2px solid #fff;
  border-right: 2px solid #808080;
  border-bottom: 2px solid #808080;
  box-shadow: inset 0 0 0 1px #dfdfdf, 2px 2px 4px rgba(0,0,0,0.4);
  box-sizing: border-box;
`;

// --- Programsサブメニュー: 画面内に収まるよう上下位置を自動補正 ---
// 実測で判明した問題: サブメニュー (maxHeight=100dvh-80) を Programs行の
// top:-4 に固定すると、高さ620pxに対して行位置y=406 → 下端1026が画面外
// (700px画面) にはみ出し、下部項目がスクロールでも到達不可に見えた。
// 実機Win95と同様、下端がタスクバーに掛かる場合は上へずらして収める。
function ProgramsSubmenu({ children, scale = 1, viewH }: { children: React.ReactNode; scale?: number; viewH?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const adjust = () => {
      el.style.top = "-4px";
      const s = scale > 0 ? scale : 1;
      // transform scale下ではgetBoundingClientRectが画面pxを返すため、
      // 仮想画面原点基準の仮想pxに換算して比較する。
      const screenTop = document.getElementById("wenge-virtual-screen")?.getBoundingClientRect().top ?? 0;
      const r = el.getBoundingClientRect();
      const maxBottom = (viewH ?? window.innerHeight) - 34; // タスクバー分を除外
      if ((r.bottom - screenTop) / s > maxBottom) {
        el.style.top = `${-4 - ((r.bottom - screenTop) / s - maxBottom)}px`;
      }
      const r2 = el.getBoundingClientRect();
      if ((r2.top - screenTop) / s < 2) {
        el.style.top = `${parseFloat(el.style.top || "-4") - (r2.top - screenTop) / s + 2}px`;
      }
    };
    adjust();
    window.addEventListener("resize", adjust);
    return () => window.removeEventListener("resize", adjust);
  }, [scale, viewH]);
  return (
    <div ref={ref} style={{ position:"absolute", left:"100%", top:-4, width:216, maxHeight: viewH != null ? `${viewH - 80}px` : "calc(100dvh - 80px)", zIndex:9999, display:"flex", flexDirection:"column", minHeight:0, cursor: "url('/cursors/arrow.png') 0 0, default" }}>
      {children}
    </div>
  );
}

// --- Tray speaker: click toggles a small volume slider popup (Win95 style) ---
function TrayVolume() {
  const [open, setOpen] = useState(false);
  const [vol, setVol] = useState(() => getVolume());
  const [muted, setMuted] = useState(() => !getSoundEnabled());
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onVol = (e: Event) => setVol((e as CustomEvent<number>).detail);
    const onEn = (e: Event) => setMuted(!((e as CustomEvent<boolean>).detail));
    window.addEventListener("wenge:volume", onVol);
    window.addEventListener("wenge:sound-enabled", onEn);
    return () => { window.removeEventListener("wenge:volume", onVol); window.removeEventListener("wenge:sound-enabled", onEn); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open ]);
  const applyVol = (v: number) => {
    const n = Math.max(0, Math.min(100, Math.round(v)));
    setVol(n);
    setVolume(n);
    if (n > 0 && muted) { setMuted(false); setSoundEnabled(true); }
  };
  const toggleMute = () => {
    if (muted || vol === 0) { setMuted(false); setSoundEnabled(true); if (vol === 0) applyVol(70); }
    else { setMuted(true); setSoundEnabled(false); }
  };
  return (
    <div ref={wrapRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <img
        src={ICONS.volume}
        alt="Volume"
        title={muted || vol === 0 ? "Muted — click to adjust volume" : `Volume ${vol}% — click to adjust`}
        width={16}
        height={16}
        style={{ imageRendering: "pixelated" as const, cursor: "url('/cursors/arrow.png') 0 0, default", opacity: muted || vol === 0 ? 0.45 : 1 }}
        onClick={() => setOpen(v => !v)}
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
      />
      {open && (
        <VolumePopup onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>Volume</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Slider
              value={muted ? 0 : vol}
              min={0}
              max={100}
              onChange={(v: number) => applyVol(v)}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, minWidth: 34, textAlign: "right" }}>{muted ? "Mute" : `${vol}%`}</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <Button size="sm" style={{ flex: 1 }} onClick={toggleMute}>{muted || vol === 0 ? "Unmute" : "Mute"}</Button>
            <Button size="sm" style={{ flex: 1 }} onClick={() => {
              const v = muted ? 0 : vol;
              if (v <= 0) return;
              try { const a = new Audio(SOUNDS.chord); a.volume = (v / 100) * 0.9; a.play().catch(() => {}); } catch {}
            }}>Test</Button>
          </div>
        </VolumePopup>
      )}
    </div>
  );
}

// --- App definitions ---
const APP_DEFS: Record<AppId, { title: string; icon: string; iconSrc: string; w: number; h: number; component: React.ReactNode }> = {
  "my-computer": { title: "My Computer", icon: ICON_FALLBACK.myComputer, iconSrc: ICONS.myComputer, w: 420, h: 340, component: <MyComputerApp /> },
  recycle: { title: "Recycle Bin", icon: ICON_FALLBACK.recycle, iconSrc: ICONS.recycle, w: 400, h: 300, component: <RecycleBinApp /> },
  notepad: { title: "Notepad", icon: ICON_FALLBACK.notepad, iconSrc: ICONS.notepad, w: 480, h: 360, component: <NotepadApp /> },
  wordpad: { title: "WordPad", icon: ICON_FALLBACK.wordpad, iconSrc: ICONS.wordpad, w: 520, h: 380, component: <WordPadApp /> },
  msdos: { title: "MS-DOS Prompt", icon: ICON_FALLBACK.msdos, iconSrc: ICONS.msdos, w: 520, h: 320, component: <MsDosApp /> },
  clock: { title: "Clock", icon: ICON_FALLBACK.clock, iconSrc: ICONS.clock, w: 260, h: 300, component: <ClockApp /> },
  charmap: { title: "Character Map", icon: ICON_FALLBACK.charmap, iconSrc: ICONS.charmap, w: 420, h: 380, component: <CharMapApp /> },
  "sound-recorder": { title: "Sound Recorder", icon: ICON_FALLBACK.soundRecorder, iconSrc: ICONS.soundRecorder, w: 380, h: 320, component: <SoundRecorderApp /> },
  volume: { title: "Volume Control", icon: ICON_FALLBACK.volume, iconSrc: ICONS.volume, w: 260, h: 300, component: <VolumeControlApp /> },
  solitaire: { title: "Solitaire", icon: ICON_FALLBACK.solitaire, iconSrc: ICONS.solitaire, w: 540, h: 420, component: <SolitaireApp /> },
  freecell: { title: "FreeCell", icon: ICON_FALLBACK.freecell, iconSrc: ICONS.freecell, w: 540, h: 420, component: <FreeCellApp /> },
  hearts: { title: "Hearts", icon: ICON_FALLBACK.hearts, iconSrc: ICONS.hearts, w: 400, h: 460, component: <HeartsApp /> },
  backup: { title: "Backup", icon: ICON_FALLBACK.backup, iconSrc: ICONS.backup, w: 460, h: 300, component: <BackupApp /> },
  scandisk: { title: "ScanDisk", icon: ICON_FALLBACK.scandisk, iconSrc: ICONS.scandisk, w: 460, h: 320, component: <ScanDiskApp /> },
  sysmon: { title: "System Monitor", icon: ICON_FALLBACK.sysmon, iconSrc: ICONS.sysmon, w: 500, h: 280, component: <SysMonApp /> },
  find: { title: "Find", icon: ICON_FALLBACK.find, iconSrc: ICONS.find, w: 460, h: 300, component: <FindApp /> },
  help: { title: "Help", icon: ICON_FALLBACK.help, iconSrc: ICONS.help, w: 520, h: 360, component: <HelpApp /> },
  briefcase: { title: "Briefcase", icon: ICON_FALLBACK.briefcase, iconSrc: ICONS.briefcase, w: 460, h: 300, component: <BriefcaseApp /> },
  dialer: { title: "Phone Dialer", icon: ICON_FALLBACK.dialer, iconSrc: ICONS.dialer, w: 280, h: 360, component: <DialerApp /> },
  network: { title: "Network Neighborhood", icon: ICON_FALLBACK.network, iconSrc: ICONS.network, w: 460, h: 320, component: <NetworkApp /> },
  "cd-player": { title: "CD Player", icon: ICON_FALLBACK.cdPlayer, iconSrc: ICONS.cdPlayer, w: 320, h: 260, component: <CdPlayerApp /> },
  ie: { title: "Internet Explorer", icon: ICON_FALLBACK.ie, iconSrc: ICONS.ie, w: 720, h: 520, component: <InternetExplorerApp /> },
  "file-share": { title: "File Share", icon: ICON_FALLBACK.fileShare, iconSrc: ICONS.fileShare, w: 520, h: 400, component: <FileShareApp /> },
  chat: { title: "Wenge Chat", icon: ICON_FALLBACK.chat, iconSrc: ICONS.chat, w: 420, h: 440, component: <ChatApp /> },
  about: { title: "About Wenge", icon: ICON_FALLBACK.about, iconSrc: ICONS.about, w: 380, h: 340, component: <AboutWengeApp /> },
  control: { title: "Control Panel", icon: ICON_FALLBACK.controlPanel, iconSrc: ICONS.controlPanel, w: 460, h: 460, component: <ControlPanelApp /> },
  minesweeper: { title: "Minesweeper", icon: ICON_FALLBACK.minesweeper, iconSrc: ICONS.minesweeper, w: 340, h: 380, component: <MinesweeperApp /> },
  "media-player": { title: "Media Player", icon: ICON_FALLBACK.mediaPlayer, iconSrc: ICONS.mediaPlayer, w: 520, h: 460, component: <MediaPlayerApp /> },
  paint: { title: "Paint", icon: ICON_FALLBACK.paint, iconSrc: ICONS.paint, w: 500, h: 380, component: <PaintApp /> },
  calc: { title: "Calculator", icon: ICON_FALLBACK.calc, iconSrc: ICONS.calc, w: 220, h: 300, component: <CalcApp /> },
  "image-viewer": { title: "Image Viewer", icon: ICON_FALLBACK.paint, iconSrc: ICONS.paint, w: 520, h: 480, component: <ImageViewerApp /> },
  explorer: { title: "Explorer", icon: ICON_FALLBACK.explorer, iconSrc: ICONS.explorer, w: 560, h: 400, component: <div /> },
  "exe-runner": { title: "Program", icon: ICON_FALLBACK.fileWindows, iconSrc: ICONS.fileWindows, w: 420, h: 380, component: <div /> },
  run: { title: "Run", icon: ICON_FALLBACK.run, iconSrc: ICONS.run, w: 380, h: 200, component: <div /> },
};

// --- Programsメニュー構成 (実機Win95準拠のカスケード分類) ---
// フラットに全件並べると巨大化するため、分類フォルダ配下に収める。
// トップ直下は分類4 + 単独6 = 10行程度に収まる。全アプリ追加時はここへ追記。
type ProgramsGroup = { label: string; ids: AppId[] };
const PROGRAMS_GROUPS: ProgramsGroup[] = [
  { label: "Accessories", ids: ["wordpad", "notepad", "paint", "calc", "clock", "charmap", "msdos"] },
  { label: "Multimedia", ids: ["media-player", "cd-player", "sound-recorder", "volume"] },
  { label: "Games", ids: ["minesweeper", "solitaire", "freecell", "hearts"] },
  { label: "System Tools", ids: ["scandisk", "backup", "sysmon"] },
];
const PROGRAMS_TOP: AppId[] = ["my-computer", "explorer", "file-share", "chat", "briefcase", "dialer", "network"];

// --- Documentsメニュー構成 (実機Win95準拠: Explorerを直接開かずカスケード表示) ---
// ExplorerApp の "C:\\Wenge\\Documents" と同期させる。appId があるものは
// 対応アプリを開き、ないもの (Budget.xls 等) は Explorer でフォルダ表示する。
type DocumentsItem = { label: string; appId: AppId; iconSrc: string };
const DOCUMENTS_ITEMS: DocumentsItem[] = [
  { label: "README.txt", appId: "notepad", iconSrc: ICONS.notepad },
  { label: "Report.doc", appId: "wordpad", iconSrc: ICONS.wordpad },
  { label: "Budget.xls", appId: "explorer", iconSrc: ICONS.fileWindows },
];

// --- Settingsメニュー構成 (実機Win95準拠: 直開きせずカスケード表示) ---
const SETTINGS_ITEMS: DocumentsItem[] = [
  { label: "Control Panel", appId: "control", iconSrc: ICONS.controlPanel },
];

// --- Findメニュー構成 (実機Win95準拠: 直開きせずカスケード表示) ---
const FIND_ITEMS: DocumentsItem[] = [
  { label: "Files or Folders...", appId: "find", iconSrc: ICONS.find },
  { label: "Computer...", appId: "network", iconSrc: ICONS.network },
];

function PaintApp() {
  const [color, setColor] = useState("#ff0000");
  const [size, setSize] = useState(4);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);
  const getPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // transform scale下でも正しく描画できるよう実ピクセル換算する
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <span style={{ fontSize: 11 }}>Width: {size}px</span>
        <div style={{ width: 80 }}><Slider value={size} min={1} max={12} onChange={(v: number) => setSize(Math.max(1, Math.min(12, Math.round(v))))} /></div>
        <Button size="sm" onClick={() => {
          const ctx = canvasRef.current?.getContext("2d");
          if (ctx && canvasRef.current) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height); }
        }}>Clear</Button>
      </div>
      <canvas
        ref={canvasRef}
        width={460}
        height={220}
        style={{ border: "2px inset #fff", background: "#fff", cursor: "crosshair" }}
        onMouseDown={(e) => {
          drawing.current = true;
          const { x, y } = getPos(e);
          const ctx = canvasRef.current!.getContext("2d")!;
          ctx.strokeStyle = color;
          ctx.lineWidth = size;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onMouseMove={(e) => {
          if (!drawing.current) return;
          const { x, y } = getPos(e);
          const ctx = canvasRef.current!.getContext("2d")!;
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onMouseUp={() => (drawing.current = false)}
        onMouseLeave={() => (drawing.current = false)}
      />
    </div>
  );
}

function CalcApp() {
  const [display, setDisplay] = useState("0");
  const [a, setA] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const input = (v: string) => setDisplay((d) => (d === "0" ? v : d + v));
  const calc = () => {
    if (a === null || !op) return;
    const b = parseFloat(display);
    let r = 0;
    if (op === "+") r = a + b;
    if (op === "-") r = a - b;
    if (op === "*") r = a * b;
    if (op === "/") r = a / b;
    setDisplay(String(r));
    setA(null);
    setOp(null);
  };
  const btn = (label: string, onClick: () => void, opts?: any) => (
    <Button onClick={onClick} style={{ minWidth: 36, height: 28 }} {...opts}>{label}</Button>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Frame variant="field" style={{ padding: 4, background: "#fff", textAlign: "right", fontSize: 16, fontFamily: "monospace" }}>{display}</Frame>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
        {["7","8","9","/"].map(v => btn(v, () => v.match(/[0-9]/) ? input(v) : (setA(parseFloat(display)), setOp(v), setDisplay("0"))))}
        {["4","5","6","*"].map(v => btn(v, () => v.match(/[0-9]/) ? input(v) : (setA(parseFloat(display)), setOp(v), setDisplay("0"))))}
        {["1","2","3","-"].map(v => btn(v, () => v.match(/[0-9]/) ? input(v) : (setA(parseFloat(display)), setOp(v), setDisplay("0"))))}
        {["0",".","=","+"].map(v => btn(v, () => v==="=" ? calc() : v==="." ? setDisplay(d=>d.includes(".")?d:d+".") : v.match(/[0-9]/) ? input(v) : (setA(parseFloat(display)), setOp(v), setDisplay("0")), v==="=" ? { style:{ background:"#000080", color:"#fff", minWidth:36, height:28 }} : undefined))}
        <Button onClick={()=>setDisplay("0")} style={{ gridColumn:"span 4" }}>C</Button>
      </div>
    </div>
  );
}

function DemoControls() {
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState("a");
  const [slider, setSlider] = useState(40);
  const [text, setText] = useState("Sample");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Fieldset label="Retro UI Parts">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button onClick={() => showInfo("Button", `Default pressed${text ? ` — input: ${text}` : ""}`)}>Default</Button>
          <Button disabled>Disabled</Button>
          <Button active onClick={() => showInfo("Button", "Pressed state demo.")}>Pressed</Button>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          <Checkbox checked={checked} onChange={() => setChecked(!checked)} value="cb1" label="Checkbox" />
          <Radio checked={radio === "a"} onChange={() => setRadio("a")} value="a" label="Option A" name="demo" />
          <Radio checked={radio === "b"} onChange={() => setRadio("b")} value="b" label="Option B" name="demo" />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Text input" width={140} />
          <div style={{ width: 100 }}><Slider value={slider} onChange={(v: number) => setSlider(Math.max(0, Math.min(100, Math.round(v))))} min={0} max={100} /></div>
          <span style={{ fontSize: 11 }}>{slider}%</span>
        </div>
        <ProgressBar value={slider} style={{ marginTop: 8 }} />
      </Fieldset>
      <GroupBox label="Additional">
        <div style={{ fontSize: 11 }}>Demonstrates GroupBox / Fieldset / Frame / Separator</div>
        <Separator style={{ margin: "8px 0" }} />
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="sm" onClick={() => showInfo("Size", "Small button pressed.")}>Small</Button>
          <Button size="sm" onClick={() => showInfo("Size", "Medium button pressed.")}>Medium</Button>
          <Button size="sm" onClick={() => showInfo("Size", "Large button pressed.")}>Large</Button>
        </div>
      </GroupBox>
    </div>
  );
}

// --- Icon grid constants ---
const GRID_W=96;
const GRID_H=84;
const ICON_W=80;
const ICON_H=84;

function getDefaultPos(index:number, _desktopW:number, desktopH:number){
  const cols=Math.max(1, Math.floor(desktopH/GRID_H));
  const col=Math.floor(index/cols);
  const row=index%cols;
  return { x: 12 + col*GRID_W, y: 12 + row*GRID_H };
}

export default function App() {
  useAnimatedCursor();
  const clock = useClock();
  const playStartup = useSound(SOUNDS.startup, 0.4);
  const playChord = useSound(SOUNDS.chord, 0.5);
  const playDing = useSound(SOUNDS.ding, 0.5);
  const playMinimize = useSound(SOUNDS.minimize, 0.5);
  const playRestore = useSound(SOUNDS.restore, 0.5);
  // playNav はアプリ起動時の音を無効化したため未使用
  // const playNav = useSound(SOUNDS.navigation, 0.4);
  const playError = useSound(SOUNDS.error, 0.5);
  const playRecycle = useSound(SOUNDS.recycle, 0.5);

  const [windows, setWindows] = useState<WinState[]>(() =>
    (Object.keys(APP_DEFS) as AppId[]).map((id, idx) => ({
      id,
      title: APP_DEFS[id].title,
      icon: APP_DEFS[id].icon,
      iconSrc: APP_DEFS[id].iconSrc,
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      x: 80 + (idx % 4) * 28,
      y: 24 + (idx % 4) * 28,
      w: APP_DEFS[id].w,
      h: APP_DEFS[id].h,
      z: idx + 1,
    }))
  );
  // Icon positions with localStorage persistence
const desktopRef=useRef<HTMLDivElement>(null);
const [iconPos, setIconPos]=useState<Record<string,{x:number,y:number}>>({});
const [selectedIds,setSelectedIds]=useState<Set<AppId>>(new Set());
const [dragging,setDragging]=useState<{id:AppId, offsetX:number, offsetY:number, startX:number, startY:number, hasMoved:boolean}|null>(null);
const [multiDrag, setMultiDrag]=useState<Record<string,{x:number,y:number}>|null>(null);
const [selectionRect,setSelectionRect]=useState<{x0:number,y0:number,x1:number,y1:number}|null>(null);
const suppressDesktopClick=useRef(false);
type IconCtxTarget =
  | { kind: "app"; id: AppId; label: string }
  | { kind: "doc"; key: string; docId: string; label: string }
  | { kind: "shortcut"; key: string; label: string }
  | { kind: "run" };
const [contextMenu,setContextMenu]=useState<{x:number,y:number; target?: IconCtxTarget} | null>(null);
// Win95風アイコンメニュー用の編集・クリップボード状態
const [renamingId, setRenamingId]=useState<string | null>(null);
const [renameValue, setRenameValue]=useState("");
const clipboard = useFsClipboard();
const longPressTimer=useRef<number|null>(null);
const touchPidRef=useRef<number|null>(null);
const [startOpen, setStartOpen] = useState(false);
const [programsOpen, setProgramsOpen] = useState(false);
const [documentsOpen, setDocumentsOpen] = useState(false);
const [settingsOpen, setSettingsOpen] = useState(false);
const [findOpen, setFindOpen] = useState(false);
  const [openSub, setOpenSub] = useState<string | null>(null);
const [showBsod, setShowBsod] = useState(false);
  // XP-style boot -> login -> desktop phases. Reload always restarts from "boot" (no persistence by design).
  const [phase, setPhase] = useState<"boot" | "login" | "desktop">("boot");
  const [desktopBg, setDesktopBg] = useState(() => {
    try { return localStorage.getItem("wenge_bg") ?? "#008080"; } catch { return "#008080"; }
  });
  useEffect(() => {
    const onBg = (e: Event) => setDesktopBg((e as CustomEvent<string>).detail);
    window.addEventListener("wenge:bg", onBg);
    return () => window.removeEventListener("wenge:bg", onBg);
  }, []);

// --- Display settings (仮想解像度 + UIスケール) ---
// viewW/viewH: レイアウト上の論理px。UIスケール分で割ることで拡大時も画面内に収まる。
// viewScale: 論理px→画面pxの描画倍率 (fit × ui)。マウス座標の換算に使う。
const [resolution, setResolution] = useState<ResolutionId>(() => getResolution());
const [uiScale, setUiScale] = useState<UiScale>(() => getUiScale());
const [winSize, setWinSize] = useState(() => ({
  w: typeof window !== "undefined" ? window.innerWidth : 1024,
  h: typeof window !== "undefined" ? window.innerHeight : 768,
}));
useEffect(() => {
  const onRes = (e: Event) => setResolution((e as CustomEvent<ResolutionId>).detail);
  const onScale = (e: Event) => setUiScale((e as CustomEvent<UiScale>).detail);
  const onResize = () => setWinSize({ w: window.innerWidth, h: window.innerHeight });
  window.addEventListener(RESOLUTION_EVENT, onRes);
  window.addEventListener(UI_SCALE_EVENT, onScale);
  window.addEventListener("resize", onResize);
  return () => {
    window.removeEventListener(RESOLUTION_EVENT, onRes);
    window.removeEventListener(UI_SCALE_EVENT, onScale);
    window.removeEventListener("resize", onResize);
  };
}, []);
const virtRes = resolution === "native" ? null : RESOLUTIONS[resolution];
const virtW = virtRes ? virtRes.w : winSize.w;
const virtH = virtRes ? virtRes.h : winSize.h;
const uiFactor = uiScale / 100;
const fitScale = Math.min(winSize.w / virtW, winSize.h / virtH);
const viewScale = fitScale * uiFactor;
const viewW = virtW / uiFactor;
const viewH = virtH / uiFactor;
const isVirtualScreen = resolution !== "native" || uiScale !== 100;
// client座標(画面px)→仮想論理px。Native等倍時はそのまま返す。
const toVirtual = (clientX: number, clientY: number) => {
  const rect = desktopRef.current?.getBoundingClientRect();
  if (!rect || viewScale <= 0) return { x: clientX, y: clientY };
  return { x: (clientX - rect.left) / viewScale, y: (clientY - rect.top) / viewScale };
};
// WindowFrame外の部品(IE右クリックメニュー・スクロールバー等)が座標換算に使う
useEffect(() => {
  setViewMetrics({ scale: viewScale, w: viewW, h: viewH });
}, [viewScale, viewW, viewH]);
const maxZ = useRef(20);
const [startupPlayed, setStartupPlayed] = useState(false);
const [desktopIcons, setDesktopIcons] = useState<{ id: AppId; label: string; icon: string; iconSrc: string }[]>(()=>{
  const chatEntry = { id: "chat", label: "Wenge Chat", icon: ICON_FALLBACK.chat, iconSrc: ICONS.chat };
  const fallback=[
    { id: "my-computer", label: "My Computer", icon: ICON_FALLBACK.myComputer, iconSrc: ICONS.myComputer },
    { id: "recycle", label: "Recycle Bin", icon: ICON_FALLBACK.recycle, iconSrc: ICONS.recycle },
    { id: "explorer", label: "Explorer", icon: ICON_FALLBACK.explorer, iconSrc: ICONS.explorer },
    { id: "ie", label: "Internet Explorer", icon: ICON_FALLBACK.ie, iconSrc: ICONS.ie },
    { id: "chat", label: "Wenge Chat", icon: ICON_FALLBACK.chat, iconSrc: ICONS.chat },
    { id: "help", label: "Help", icon: ICON_FALLBACK.help, iconSrc: ICONS.help },
  ] as { id: AppId; label: string; icon: string; iconSrc: string }[];
  try{
    const saved=localStorage.getItem("wenge_desktop_icons");
    if(saved){
      const parsed=JSON.parse(saved);
      if(Array.isArray(parsed)){
        const valid=parsed.filter((ic:any)=> ic && typeof ic.id==="string" && (APP_DEFS as Record<string,any>)[ic.id]);
        if(valid.length>0){
          const mapped=valid.map((ic:any)=>{
            const def=(APP_DEFS as Record<string,any>)[ic.id];
            return { id: ic.id as AppId, label: typeof ic.label==="string"?ic.label:def.title, icon: def.icon, iconSrc: typeof ic.iconSrc==="string"?ic.iconSrc:def.iconSrc };
          });
          // 既存ユーザーへの移行: Wenge Chat がなければデスクトップに追加
          if(!mapped.some((ic:any)=> ic.id==="chat")){
            mapped.push(chatEntry as { id: AppId; label: string; icon: string; iconSrc: string });
          }
          return mapped;
        }
      }
    }
  }catch{}
  return fallback;
});
const [draggingFromStart, setDraggingFromStart] = useState<{id: AppId; label: string; iconSrc: string; x: number; y: number; dx: number; dy: number} | null>(null);
// VFS実体ファイル (IndexedDB永続・C:/Desktopと同期。位置はiconPosの `doc:<id>` で管理)
const [desktopDocs, setDesktopDocs] = useState<DesktopDoc[]>([]);
const [docDropBusy, setDocDropBusy] = useState<string | null>(null);
// デスクトップショートカット (Explorerの静的エントリ等から作成。キーは `shortcut:<uid>`)
// vfsId 付きは Documents/Downloads/Desktop 実体への参照 (Alt+ドロップで作成・ダブルクリックで元ファイルを開く)
// r2Key / r2Prefix 付きは R2実体への参照 (右クリック Create Shortcut / Alt+ドロップで作成)
type DesktopShortcut = { key: string; label: string; iconSrc: string; appId?: string; explorerPath?: string; vfsId?: string; r2Key?: string; r2Prefix?: string; r2Mime?: string; r2Size?: number };
const [desktopShortcuts, setDesktopShortcuts] = useState<DesktopShortcut[]>(()=>{
  try{
    const raw=localStorage.getItem("wenge_desktop_shortcuts");
    if(raw){
      const parsed=JSON.parse(raw);
      if(Array.isArray(parsed)) return parsed.filter((s:any)=> s && typeof s.key==="string" && typeof s.label==="string");
    }
  }catch{}
  return [];
});
useEffect(()=>{
  try{ localStorage.setItem("wenge_desktop_shortcuts", JSON.stringify(desktopShortcuts)); }catch{}
},[desktopShortcuts]);
// フォルダショートカットからExplorerを開く際の初期パス (キー変更で再マウントさせる)
const [explorerInitPath, setExplorerInitPath] = useState<string | null>(null);
const [explorerOpenKey, setExplorerOpenKey] = useState(0);
// ダブルクリックで開くVFSファイル (appId -> file)。keyにfile.idを使い再マウントさせる
const [vfsFileByApp, setVfsFileByApp] = useState<Record<string, DesktopDoc>>({});
const ieFile = useMemo<VfsFile | null>(() => {
  const f = vfsFileByApp["ie"];
  if (!f) return null;
  return {
    id: f.id,
    path: `C:/Desktop/${f.name}`,
    name: f.name,
    dir: "C:/Desktop",
    mime: f.mime,
    size: f.size,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    blob: f.blob,
    sourceUrl: f.sourceUrl,
    sourceR2Key: f.sourceR2Key,
  };
}, [vfsFileByApp]);

// VFSファイルpropはidentityを安定させる (毎秒の時計再レンダーで別objectになると
// 各アプリの [file] effect が再発火し、MediaPlayerが勝手に再生再開・Notepadが編集中内容を破棄する)
const toVfsFileProp = (f: DesktopDoc | undefined): VfsFile | null => {
  if (!f) return null;
  return {
    id: f.id,
    path: `C:/Desktop/${f.name}`,
    name: f.name,
    dir: "C:/Desktop",
    mime: f.mime,
    size: f.size,
    createdAt: f.createdAt,
    updatedAt: f.createdAt,
    blob: f.blob,
  } as VfsFile;
};
const notepadFile = useMemo(() => toVfsFileProp(vfsFileByApp["notepad"]), [vfsFileByApp]);
const mediaPlayerFile = useMemo(() => toVfsFileProp(vfsFileByApp["media-player"]), [vfsFileByApp]);
const imageViewerFile = useMemo(() => toVfsFileProp(vfsFileByApp["image-viewer"]), [vfsFileByApp]);
const exeRunnerFile = useMemo(() => toVfsFileProp(vfsFileByApp["exe-runner"]), [vfsFileByApp]);

// グリッドにスナップ
const snapPos=(x:number,y:number,deskW:number,deskH:number)=>{
  let nx=Math.max(0, Math.min(x, deskW - ICON_W));
  let ny=Math.max(0, Math.min(y, deskH - ICON_H));
  nx=Math.round((nx - 12)/GRID_W)*GRID_W + 12;
  ny=Math.round((ny - 12)/GRID_H)*GRID_H + 12;
  nx=Math.max(12, Math.min(nx, deskW - ICON_W - 12));
  ny=Math.max(12, Math.min(ny, deskH - ICON_H - 12));
  return {x:nx,y:ny};
};
const isSpotFree=(x:number,y:number,occupied:Record<string,{x:number,y:number}>)=>{
  return !Object.values(occupied).some(p=> Math.abs(p.x-x)<ICON_W && Math.abs(p.y-y)<ICON_H);
};
// 新規アイコンの配置先を探す（ドロップ位置優先、重なり回避）
const findSpotForNew=(wantX:number|undefined,wantY:number|undefined,deskW:number,deskH:number,occupied:Record<string,{x:number,y:number}>)=>{
  if(wantX!==undefined && wantY!==undefined){
    const s=snapPos(wantX,wantY,deskW,deskH);
    if(isSpotFree(s.x,s.y,occupied)) return s;
    for(let radius=1;radius<=8;radius++){
      for(let dx=-radius;dx<=radius;dx++){
        for(let dy=-radius;dy<=radius;dy++){
          if(Math.abs(dx)!==radius && Math.abs(dy)!==radius) continue;
          const tx=s.x+dx*GRID_W, ty=s.y+dy*GRID_H;
          if(tx<12||ty<12||tx>deskW-ICON_W-12||ty>deskH-ICON_H-12) continue;
          if(isSpotFree(tx,ty,occupied)) return {x:tx,y:ty};
        }
      }
    }
  }
  for(let i=0;i<200;i++){
    const p=getDefaultPos(i,deskW,deskH);
    if(p.x>deskW-ICON_W-12) break;
    if(isSpotFree(p.x,p.y,occupied)) return p;
  }
  return snapPos(wantX??12,wantY??12,deskW,deskH);
};
const desktopSize=()=>{
  // Desktop自体がviewW×viewHの論理pxで描画されるため、そのまま返す。
  return { w: viewW, h: viewH - 30 };
};
// スタートメニューからのドロップでショートカット作成（既存アイコンの配置は保持する）
const addToDesktop = (id: AppId, opts?: {label?:string; iconSrc?:string; x?:number; y?:number}) => {
  if(!APP_DEFS[id]) return;
  if(desktopIcons.some(ic=>ic.id===id)) return;
  const def = APP_DEFS[id];
  const {w,h}=desktopSize();
  const pos=findSpotForNew(opts?.x,opts?.y,w,h,iconPos);
  setDesktopIcons(prev=> prev.some(ic=>ic.id===id)?prev:[...prev,{id,label:opts?.label??def.title,icon:def.icon,iconSrc:opts?.iconSrc??def.iconSrc}]);
  setIconPos(prev=>({...prev,[id]:pos}));
};
const removeFromDesktop = (id: AppId | string) => {
  // デスクトップショートカットの削除
  if (typeof id === "string" && id.startsWith("shortcut:")) {
    setDesktopShortcuts((prev) => prev.filter((s) => s.key !== id));
    setIconPos((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setSelectedIds((prev) => { if (!prev.has(id as AppId)) return prev; const n = new Set(prev); n.delete(id as AppId); return n; });
    playRecycle();
    return;
  };
  // IndexedDBに複製された実体ファイルの削除
  if (typeof id === "string" && isDocIconKey(id)) {
    const docId = docIdFromKey(id);
    deleteDesktopDoc(docId).catch(() => {});
    setDesktopDocs((prev) => prev.filter((d) => d.id !== docId));
    setIconPos((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setSelectedIds((prev) => { if (!prev.has(id as AppId)) return prev; const n = new Set(prev); n.delete(id as AppId); return n; });
    playRecycle();
    return;
  }
  // ごみ箱・Run自体は削除不可
  if(id==="recycle"||id==="run"){ playError(); return; }
  const appId = id as AppId;
  if(!desktopIcons.some(ic=>ic.id===appId)) return;
  setDesktopIcons(prev=>prev.filter(ic=>ic.id!==appId));
  setIconPos(prev=>{ const n={...prev}; delete n[appId]; return n; });
  setSelectedIds(prev=>{ if(!prev.has(appId)) return prev; const n=new Set(prev); n.delete(appId); return n; });
  playRecycle();
};
// カーソル位置がごみ箱アイコン上かどうか (仮想論理pxで受け取る)
const isOverRecycleAt=(vx:number,vy:number)=>{
  const rp=iconPos["recycle"];
  if(!rp) return false;
  return vx>=rp.x && vx<=rp.x+ICON_W && vy>=rp.y && vy<=rp.y+ICON_H;
};

  // Initialize icon positions
  useEffect(()=>{
    const key="wenge_icon_pos";
    const saved=localStorage.getItem(key);
    if(saved){
      try{ const p=JSON.parse(saved); setIconPos(p); return; }catch{}
    }
    const w=viewW, h=viewH-30;
    const pos:Record<string,{x:number,y:number}>={};
    desktopIcons.forEach((ic,i)=> pos[ic.id]=getDefaultPos(i,w,h));
    // Run icon separate
    pos["run"]=getDefaultPos(desktopIcons.length,w,h);
    setIconPos(pos);
  },[]);

  // Persist
  useEffect(()=>{
    if(Object.keys(iconPos).length===0) return;
    localStorage.setItem("wenge_icon_pos", JSON.stringify(iconPos));
  },[iconPos]);

  // 移行で追加されたアイコン等、位置が未割当のデスクトップアイコンに配置を与える
  useEffect(()=>{
    setIconPos((prev)=>{
      if(Object.keys(prev).length===0) return prev;
      const next={ ...prev };
      let changed=false;
      const { w, h } = desktopSize();
      const occupied={ ...next } as Record<string,{x:number;y:number}>;
      const baseCount=desktopIcons.length+desktopDocs.length+desktopShortcuts.length+1;
      desktopIcons.forEach((ic)=>{
        if(!next[ic.id]){
          const idx=Object.keys(next).length % Math.max(baseCount, 1);
          const spot=getDefaultPos(idx,w,h-30);
          next[ic.id]=spot;
          occupied[ic.id]=spot;
          changed=true;
        }
      });
      if(!next["run"]){
        next["run"]=getDefaultPos(desktopIcons.length,w,h-30);
        changed=true;
      }
      return changed?next:prev;
    });
  },[desktopIcons]);

  // デスクトップ構成（ショートカット追加／削除）を永続化
  useEffect(()=>{
    try{ localStorage.setItem("wenge_desktop_icons", JSON.stringify(desktopIcons)); }catch{}
  },[desktopIcons]);
  useEffect(()=>{
    try{ localStorage.setItem("wenge_desktop_shortcuts", JSON.stringify(desktopShortcuts)); }catch{}
  },[desktopShortcuts]);

  const autoArrange=()=>{
    const w=viewW, h=viewH-30;
    const pos:Record<string,{x:number,y:number}>={};
    const sorted=[...desktopIcons].sort((a,b)=> a.label.localeCompare(b.label));
    sorted.forEach((ic,i)=> pos[ic.id]=getDefaultPos(i,w,h));
    const sortedDocs=[...desktopDocs].sort((a,b)=> a.name.localeCompare(b.name));
    sortedDocs.forEach((d,i)=> { pos[docIconKey(d.id)]=getDefaultPos(sorted.length+1+i,w,h); });
    const sortedSc=[...desktopShortcuts].sort((a,b)=> a.label.localeCompare(b.label));
    sortedSc.forEach((s,i)=> { pos[s.key]=getDefaultPos(sorted.length+1+sortedDocs.length+i,w,h); });
    pos["run"]=getDefaultPos(sorted.length+1+sortedDocs.length+sortedSc.length,w,h);
    setIconPos(pos);
    localStorage.setItem("wenge_icon_pos", JSON.stringify(pos));
  };

  // Line up Icons: 並べ替えはせず、現在の位置をグリッドにスナップする
  const lineUpIcons=()=>{
    const { w, h }=desktopSize();
    setIconPos((prev)=>{
      const next:Record<string,{x:number,y:number}>={};
      Object.entries(prev).forEach(([k,p])=>{ next[k]=snapPos(p.x,p.y,w,h-30); });
      try{ localStorage.setItem("wenge_icon_pos", JSON.stringify(next)); }catch{}
      return next;
    });
  };

  // Refresh: 再起動せず、保存済みアイコン位置を再読み込み + VFS実体ファイルを再読込する
  const refreshDesktop=()=>{
    // 1. 保存済みアイコン位置 (wenge_icon_pos) を再読み込み
    try{
      const saved=localStorage.getItem("wenge_icon_pos");
      if(saved){
        const p=JSON.parse(saved);
        if(p && typeof p==="object"){
          const stored=p as Record<string,{x:number;y:number}>;
          setIconPos(()=>{
            const next:Record<string,{x:number,y:number}>={ ...stored };
            const { w, h }=desktopSize();
            const occupied={ ...next };
            desktopIcons.forEach((ic)=>{
              if(!next[ic.id]){
                const spot=findSpotForNew(undefined,undefined,w,h,occupied);
                next[ic.id]=spot; occupied[ic.id]=spot;
              }
            });
            desktopShortcuts.forEach((s)=>{
              if(!next[s.key]){
                const spot=findSpotForNew(undefined,undefined,w,h,occupied);
                next[s.key]=spot; occupied[s.key]=spot;
              }
            });
            if(!next["run"]){
              const spot=findSpotForNew(undefined,undefined,w,h,occupied);
              next["run"]=spot;
            }
            return next;
          });
        }
      }
    }catch{}
    // 2. VFS内のデスクトップ実体ファイルを再読み込み (位置がなければ割り当て)
    listDesktopDocs().then((docs)=>{
      setDesktopDocs(docs);
      setIconPos((prev)=>{
        const next={...prev};
        let changed=false;
        const { w, h }=desktopSize();
        const occupied={...next};
        docs.forEach((d)=>{
          const k=docIconKey(d.id);
          if(!next[k]){
            const spot=findSpotForNew(undefined,undefined,w,h,occupied);
            next[k]=spot;
            occupied[k]=spot;
            changed=true;
          }
        });
        return changed?next:prev;
      });
    }).catch(()=>{});
    // 3. 開いているExplorer等のVFS表示にも再読込を通知
    try{ window.dispatchEvent(new CustomEvent(VFS_CHANGED_EVENT)); }catch{}
  };

  // ExplorerからのHTML5 DnDが途中で終わっても move_hand カーソルが残らないよう保険で外す
  useEffect(()=>{
    const clear=()=>{ markWengeDragEnd(); cancelFileDragSession(); };
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    return ()=>{ window.removeEventListener("dragend", clear); window.removeEventListener("drop", clear); };
  },[]);

  // VFS内のデスクトップ実体ファイルを読み込み、位置がなければ割り当て。
  // VFS変更イベントでも再読込するので、IE/Explorerからの保存が自動でアイコン化される。
  useEffect(()=>{
    let cancelled=false;
    const load=()=>{
      listDesktopDocs().then((docs)=>{
        if(cancelled) return;
        setDesktopDocs(docs);
        setIconPos((prev)=>{
          const next={...prev};
          let changed=false;
          const { w, h } = desktopSize();
          const occupied={...next};
          docs.forEach((d)=>{
            const k=docIconKey(d.id);
            if(!next[k]){
              const spot=findSpotForNew(undefined,undefined,w,h,occupied);
              next[k]=spot;
              occupied[k]=spot;
              changed=true;
            }
          });
          return changed?next:prev;
        });
      }).catch(()=>{});
    };
    load();
    const onVfs=()=>load();
    window.addEventListener(VFS_CHANGED_EVENT, onVfs);
    return ()=>{ cancelled=true; window.removeEventListener(VFS_CHANGED_EVENT, onVfs); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Explorer(R2) / OSからのドラッグ受け入れ → IndexedDBに複製してアイコン化
  const handleDesktopDragOver=(e: React.DragEvent)=>{
    const types=Array.from(e.dataTransfer.types || []);
    if(types.includes(R2_DRAG_MIME) || types.includes("Files")){ e.preventDefault(); e.dataTransfer.dropEffect="copy"; }
  };
  const placeShortcutAt=(key: string, clientX: number, clientY: number)=>{
    const v = toVirtual(clientX, clientY);
    const { w, h }=desktopSize();
    const wantX=v.x-40;
    const wantY=v.y-30;
    setIconPos((prev)=>{
      const spot=findSpotForNew(wantX,wantY,w,h,prev);
      return {...prev,[key]:spot};
    });
  };
  const placeDocAt=(docId: string, clientX: number, clientY: number)=>{
    const v = toVirtual(clientX, clientY);
    const { w, h }=desktopSize();
    const wantX=v.x-40;
    const wantY=v.y-30;
    setIconPos((prev)=>{
      const spot=findSpotForNew(wantX,wantY,w,h,prev);
      return {...prev,[docIconKey(docId)]:spot};
    });
  };
  // Pointer DnD用: ペイロードをデスクトップへ配置 (Win準拠: 無修飾=移動 / Ctrl=コピー / Alt=ショートカット)
  // VFS実体 (Documents/Downloads/Desktop相互) は無修飾で移動、システム仮想・R2は従来どおり。
  const dropWengeFileToDesktop=async (item: R2DragItem, clientX: number, clientY: number, action: WengeDropAction = "move")=>{
    setDocDropBusy(action === "copy" ? "Copying..." : action === "shortcut" ? "Creating shortcut..." : "Moving...");
    try{
      if(item.kind==="shortcut"){
        // 実体のないエントリはショートカットアイコンとして配置する (修飾キーによらず)
        const key=`shortcut:${Date.now().toString(36)}${Math.floor(Math.random()*1e6).toString(36)}`;
        const iconSrc=item.iconSrc ?? (item.explorerPath ? ICONS.folderClosed : ICONS.fileWindows);
        setDesktopShortcuts((prev)=>[...prev, { key, label: item.label, iconSrc, appId: item.appId, explorerPath: item.explorerPath, vfsId: item.vfsId, r2Key: item.r2Key, r2Prefix: item.r2Prefix, r2Mime: item.r2Mime, r2Size: item.r2Size }]);
        placeShortcutAt(key,clientX,clientY);
        playRestore();
        return;
      }
      // R2実体への Alt+ドロップ / 右クリック Create Shortcut は参照ショートカットを作成 (コピーしない)
      if(action==="shortcut"){
        if(item.kind==="file"){
          const key=`shortcut:${Date.now().toString(36)}${Math.floor(Math.random()*1e6).toString(36)}`;
          const parentPrefix = item.key.includes("/") ? normalizePrefix(item.key.slice(0, item.key.lastIndexOf("/") + 1)) : "";
          setDesktopShortcuts((prev)=>[...prev, { key, label: item.name, iconSrc: ICONS.fileWindows, explorerPath: formatR2Path(parentPrefix), r2Key: item.key, r2Mime: item.mime, r2Size: item.size }]);
          placeShortcutAt(key,clientX,clientY);
          playRestore();
          return;
        }
        if(item.kind==="folder"){
          const key=`shortcut:${Date.now().toString(36)}${Math.floor(Math.random()*1e6).toString(36)}`;
          setDesktopShortcuts((prev)=>[...prev, { key, label: item.name, iconSrc: ICONS.folderClosed, explorerPath: formatR2Path(item.prefix), r2Prefix: item.prefix }]);
          placeShortcutAt(key,clientX,clientY);
          playRestore();
          return;
        }
      }
      if(item.kind==="vfs-file"){
        // Explorer(VFS表示)からのドラッグ。実体はIndexedDBにある。
        // すでにDesktopにあるものは複製せずドロップ位置へ移動するだけ。
        const src=await getVfsFile(item.id);
        if(!src) throw new Error("Source file not found.");
        if(normalizeVfsDir(src.dir)===normalizeVfsDir(VFS_DESKTOP)){
          placeDocAt(src.id,clientX,clientY);
          playRestore();
          return;
        }
        if(action==="shortcut"){
          // Alt+ドロップ: 実体を作らず参照ショートカットを作成 (元ファイルは残る)
          const key=`shortcut:${Date.now().toString(36)}${Math.floor(Math.random()*1e6).toString(36)}`;
          const isImg=/\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(src.name) || src.mime.startsWith("image/");
          const isMedia=/\.(mp3|wav|ogg|m4a|mp4|webm)$/i.test(src.name) || src.mime.startsWith("audio/") || src.mime.startsWith("video/");
          const iconSrc=(isImg?ICONS.paint:isMedia?ICONS.mediaPlayer:(src.mime.startsWith("text/")||/\.(txt|md|json|js|css|html)$/i.test(src.name))?ICONS.notepad:ICONS.fileWindows);
          setDesktopShortcuts((prev)=>[...prev, { key, label: src.name, iconSrc, vfsId: src.id }]);
          placeShortcutAt(key,clientX,clientY);
          playRestore();
          return;
        }
        if(action==="copy"){
          const doc=await saveDocFromBlob({ name: src.name, mime: src.mime || item.mime || guessMime(src.name), blob: src.blob, sourceR2Key: src.sourceR2Key });
          setDesktopDocs((prev)=>[doc,...prev]);
          placeDocAt(doc.id,clientX,clientY);
          playRestore();
          return;
        }
        // 無修飾 = 移動: C:/Desktop へ move し元フォルダから消す
        const moved=await moveVfsFile(item.id, VFS_DESKTOP);
        setDesktopDocs((prev)=>{
          const doc={ id: moved.id, name: moved.name, mime: moved.mime, size: moved.size, createdAt: moved.createdAt, updatedAt: moved.updatedAt, sourceR2Key: moved.sourceR2Key, sourceUrl: moved.sourceUrl, blob: moved.blob };
          return prev.some((d)=>d.id===doc.id) ? prev.map((d)=>d.id===doc.id?doc:d) : [doc,...prev];
        });
        placeDocAt(moved.id,clientX,clientY);
        playRestore();
      }else if(item.kind==="file"){
        const res=await fetch(item.url);
        if(!res.ok) throw new Error(`download failed: ${res.status}`);
        const blob=await res.blob();
        // Keys synthesized by the Downloads folder ("downloads/<id>/<name>") are
        // not R2 keys — don't record them as such.
        const sourceR2Key = item.key.startsWith("downloads/") ? undefined : item.key;
        const doc=await saveDocFromBlob({ name: item.name, mime: blob.type || item.mime || guessMime(item.name), blob, sourceR2Key });
        setDesktopDocs((prev)=>[doc,...prev]);
        placeDocAt(doc.id,clientX,clientY);
        playRestore();
      }else{
        const files=await listR2Flat(item.prefix);
        if(files.length===0){ showInfo("Desktop",`Folder '${item.name}' is empty.\nNothing to copy.`); return; }
        if(files.length>50){
          const ok=await showConfirm("Desktop",`Copy ${files.length} files from '${item.name}' to the Desktop?\nThis may take a while.`,"Copy","Cancel");
          if(!ok) return;
        }
        let first=true;
        for(const f of files){
          try{
            const rel=f.key.slice(item.prefix.length) || r2NameOfKey(f.key);
            const name=`${item.name}/${rel}`;
            const res=await fetch(f.url);
            if(!res.ok) continue;
            const blob=await res.blob();
            const doc=await saveDocFromBlob({ name, mime: blob.type || guessMime(name), blob, sourceR2Key: f.key });
            setDesktopDocs((prev)=>[doc,...prev]);
            if(first){ placeDocAt(doc.id,clientX,clientY); first=false; }
            else{
              setIconPos((prev)=>{
                const { w, h }=desktopSize();
                const spot=findSpotForNew(undefined,undefined,w,h,prev);
                return {...prev,[docIconKey(doc.id)]:spot};
              });
            }
          }catch{ /* 1ファイルの失敗では全体を止めない */ }
        }
        playRestore();
      }
    }catch(err:any){
      playError();
      const label = action==="shortcut" ? "Could not create shortcut." : action==="copy" ? "Copy failed.\n" : "Move failed.\n";
      showError("Desktop",label+(err?.message || "Could not download from R2."));
    }finally{
      setDocDropBusy(null);
    }
  };
  // 最新のドロップ処理を登録用に保持する
  const desktopFileDropRef=useRef(dropWengeFileToDesktop);
  desktopFileDropRef.current=dropWengeFileToDesktop;
  useEffect(()=>{
    // boot/login時はDesktop要素自体が未マウントのため、desktopフェーズで登録し直す
    if(phase!=="desktop") return;
    const el=desktopRef.current;
    if(!el) return;
    const cleanupSession=initPointerDragCleanup();
    const unregister=registerWengeDrop(el, { onDrop:(payload,pos,action)=>{ desktopFileDropRef.current(payload,pos.clientX,pos.clientY,action ?? "move"); } });
    return ()=>{ unregister(); cleanupSession(); };
  },[phase]);
  // Explorer の右クリック「ショートカット作成/Desktopへコピー・移動」を受け取って、
  // デスクトップのドロップ処理(実体複製/ショートカット配置)へそのまま委譲する。
  useEffect(()=>{
    return onSendToDesktop((payload)=>{
      void desktopFileDropRef.current(payload.item, payload.clientX, payload.clientY, payload.action ?? "move");
    });
  },[]);
  // ネイティブDnDはOS外からの実ファイル受け入れ専用に残す。
  // (内部移動はPointer DnD、OSカーソルが出るのは外部ドロップ時のみ)
  const handleDesktopDrop=async (e: React.DragEvent)=>{
    if(!e.dataTransfer.files || e.dataTransfer.files.length===0) return;
    e.preventDefault();
    e.stopPropagation();
    setDocDropBusy("Copying...");
    try{
      for(const f of Array.from(e.dataTransfer.files)){
        const doc=await saveDocFromBlob({ name: f.name, mime: f.type || guessMime(f.name), blob: f });
        setDesktopDocs((prev)=>[doc,...prev]);
        placeDocAt(doc.id,e.clientX,e.clientY);
      }
      playRestore();
    }catch(err:any){
      playError();
      showError("Desktop","Copy failed.\n"+(err?.message || "Could not copy files."));
    }finally{
      setDocDropBusy(null);
    }
  };

  // Startup sound plays once the desktop unlocks (login click counts as the user gesture)
  useEffect(() => {
    if (phase !== "desktop" || startupPlayed) return;
    const t = setTimeout(() => { playStartup(); setStartupPlayed(true); }, 400);
    return () => clearTimeout(t);
  }, [playStartup, startupPlayed, phase]);

  useEffect(() => {
    const clampWindows = () => {
      const vw = viewW;
      const vh = viewH;
      const taskbarH = 30;
      setWindows((prev) =>
        prev.map((w) => {
          if (w.isMaximized) return w;
          const maxW = Math.min(w.w, vw - 16);
          const maxH = Math.min(w.h, vh - taskbarH - 16);
          const nx = Math.min(Math.max(0, w.x), Math.max(0, vw - maxW - 4));
          const ny = Math.min(Math.max(0, w.y), Math.max(0, vh - taskbarH - maxH - 4));
          if (nx !== w.x || ny !== w.y || maxW !== w.w || maxH !== w.h) {
            return { ...w, x: nx, y: ny, w: maxW, h: maxH };
          }
          return w;
        })
      );
    };
    window.addEventListener("resize", clampWindows);
    clampWindows();
    return () => window.removeEventListener("resize", clampWindows);
  }, [viewW, viewH]);

  // 解像度・UIスケール切替時はみ出したアイコンも画面内に収める
  useEffect(() => {
    setIconPos((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const n = { ...prev };
      let changed = false;
      for (const k of Object.keys(n)) {
        const p = n[k];
        const nx = Math.max(0, Math.min(p.x, Math.max(0, viewW - ICON_W - 4)));
        const ny = Math.max(0, Math.min(p.y, Math.max(0, viewH - 30 - ICON_H - 4)));
        if (nx !== p.x || ny !== p.y) { n[k] = { x: nx, y: ny }; changed = true; }
      }
      return changed ? n : prev;
    });
  }, [viewW, viewH]);

  const focusedId = useMemo(() => {
    const open = windows.filter((w) => w.isOpen && !w.isMinimized);
    if (open.length === 0) return null;
    return open.reduce((a, b) => (a.z > b.z ? a : b)).id;
  }, [windows]);

  const openWindow = (id: AppId, _opts?: { silent?: boolean }) => {
    // サウンド無効化: アプリ起動時の Navigation / busy カーソル音を鳴らさない
    // if (!opts?.silent) { triggerBusy(600); playNav(); }
    setWindows((prev) => {
      const exists = prev.find((w) => w.id === id);
      if (exists) {
        maxZ.current += 1;
        return prev.map((w) => (w.id === id ? { ...w, isOpen: true, isMinimized: false, z: maxZ.current } : w));
      }
      maxZ.current += 1;
      const def = APP_DEFS[id];
      const vw = viewW;
      const vh = viewH;
      const cw = Math.min(def.w, vw - 16);
      const ch = Math.min(def.h, vh - 30 - 16);
      const cx = Math.max(4, Math.min(60 + Math.random() * 80, vw - cw - 4));
      const cy = Math.max(4, Math.min(40 + Math.random() * 60, vh - 30 - ch - 4));
      return [
        ...prev,
        { id, title: def.title, icon: def.icon, iconSrc: def.iconSrc, isOpen: true, isMinimized: false, isMaximized: false, x: cx, y: cy, w: cw, h: ch, z: maxZ.current },
      ];
    });
  };

  const focusWindow = (id: AppId) => {
    maxZ.current += 1;
    setWindows((p) => p.map((w) => (w.id === id ? { ...w, z: maxZ.current, isMinimized: false } : w)));
  };

  // VFSファイルを対応アプリで開く (デスクトップ/Explorerのダブルクリック用)
  const openVfsDoc = (doc: DesktopDoc) => {
    const vfsFile = {
      id: doc.id, path: `C:/Desktop/${doc.name}`, name: doc.name.split("/").pop() || doc.name,
      dir: "C:/Desktop", mime: doc.mime, size: doc.size,
      createdAt: doc.createdAt, updatedAt: doc.createdAt, blob: doc.blob,
    };
    const target = vfsOpenTarget(vfsFile as never);
    if (target === "preview" || target === "explorer") {
      const url = URL.createObjectURL(doc.blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    if (target === "exe") {
      // For known internal programs (notepad.exe etc.) we still open via ExeRunner
      // which will offer to launch the mapped app. Direct alias jump would bypass the runner UI.
      const exeDoc: DesktopDoc = { ...doc, name: vfsFile.name };
      setPendingVfsFile(vfsFile as never);
      setVfsFileByApp((prev) => ({ ...prev, ["exe-runner"]: exeDoc }));
      setWindows((prev) => prev.map((w) => w.id === "exe-runner" ? { ...w, title: vfsFile.name } : w));
      openWindow("exe-runner" as AppId, { silent: true });
      return;
    }
    const appId = (target === "notepad" ? "notepad" : target === "wordpad" ? "wordpad" : target === "image-viewer" ? "image-viewer" : target === "media-player" ? "media-player" : target === "ie" ? "ie" : target === "msdos" ? "msdos" : "explorer") as AppId;
    // mount時に各アプリがconsumeできるようpendingにも積む + propで確実に渡す
    setPendingVfsFile(vfsFile as never);
    setVfsFileByApp((prev) => ({ ...prev, [appId]: doc }));
    openWindow(appId, { silent: true });
  };

  // ショートカットアイコンのダブルクリックで開く
  const openDesktopShortcut = async (sc: DesktopShortcut) => {
    if (sc.appId && (APP_DEFS as Record<string, any>)[sc.appId]) {
      openWindow(sc.appId as AppId, { silent: true });
      return;
    }
    if (sc.vfsId) {
      // Alt+ドロップで作ったVFS参照: 元ファイルを開く (元が消えていたら通知)
      try {
        const f = await getVfsFile(sc.vfsId);
        if (!f) { showInfo("Shortcut", `${sc.label}\nThe original file could not be found.\nIt may have been moved or deleted.`); return; }
        const doc: DesktopDoc = { id: f.id, name: f.name, mime: f.mime, size: f.size, createdAt: f.createdAt, updatedAt: f.updatedAt, sourceR2Key: f.sourceR2Key, sourceUrl: f.sourceUrl, blob: f.blob };
        openVfsDoc(doc);
        return;
      } catch (e: any) {
        showError("Shortcut", e?.message || "Could not open the original file.");
        return;
      }
    }
    if (sc.r2Key) {
      // R2ファイルへの参照ショートカット: 新鮮なURLを取得して対応アプリで開く
      try {
        setDocDropBusy("Opening...");
        const parentPrefix = sc.r2Key.includes("/") ? normalizePrefix(sc.r2Key.slice(0, sc.r2Key.lastIndexOf("/") + 1)) : "";
        const listed = await listR2(parentPrefix);
        const found = listed.files.find((f) => f.key === sc.r2Key);
        const url = found?.url;
        if (!url) throw new Error("The original file could not be found.\nIt may have been moved or deleted.");
        const name = r2NameOfKey(sc.r2Key);
        const mime = sc.r2Mime || guessMime(name);
        const target = vfsOpenTarget({ id: `r2:${sc.r2Key}`, name, mime } as VfsFile);
        if (target === "preview" || target === "explorer") {
          window.open(url, "_blank", "noopener");
          return;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        const blob = await res.blob();
        const vfsFile = {
          id: `r2:${sc.r2Key}`,
          path: `R2:/${sc.r2Key}`,
          name,
          dir: "R2:/",
          mime: blob.type || mime,
          size: blob.size || sc.r2Size || 0,
          createdAt: found?.uploadedAt ?? new Date().toISOString(),
          updatedAt: found?.uploadedAt ?? new Date().toISOString(),
          sourceUrl: url,
          sourceR2Key: sc.r2Key,
          blob,
        } as VfsFile;
        if (target === "exe") {
          const exeDoc = { id: vfsFile.id, name: vfsFile.name, mime: vfsFile.mime, size: vfsFile.size, createdAt: vfsFile.createdAt, updatedAt: vfsFile.updatedAt, sourceR2Key: vfsFile.sourceR2Key, sourceUrl: vfsFile.sourceUrl, blob: vfsFile.blob } as DesktopDoc;
          setPendingVfsFile(vfsFile);
          try { (window as any).__wengePendingVfs = vfsFile; } catch {}
          setVfsFileByApp((prev) => ({ ...prev, ["exe-runner"]: exeDoc }));
          setWindows((prev) => prev.map((w) => w.id === "exe-runner" ? { ...w, title: vfsFile.name } : w));
          openWindow("exe-runner" as AppId, { silent: true });
          return;
        }
        const appId = target === "notepad" ? "notepad" : target === "wordpad" ? "wordpad" : target === "image-viewer" ? "image-viewer" : target === "ie" ? "ie" : "media-player";
        setPendingVfsFile(vfsFile);
        try { (window as any).__wengePendingVfs = vfsFile; } catch {}
        setVfsFileByApp((prev) => ({ ...prev, [appId]: { id: vfsFile.id, name: vfsFile.name, mime: vfsFile.mime, size: vfsFile.size, createdAt: vfsFile.createdAt, updatedAt: vfsFile.updatedAt, sourceR2Key: vfsFile.sourceR2Key, sourceUrl: vfsFile.sourceUrl, blob: vfsFile.blob } as DesktopDoc }));
        openWindow(appId as AppId, { silent: true });
        return;
      } catch (e: any) {
        showError("Shortcut", e?.message || "Could not open the original file.");
        return;
      } finally {
        setDocDropBusy(null);
      }
    }
    if (sc.r2Prefix !== undefined || (sc.explorerPath && /^R2\s*:/i.test(sc.explorerPath))) {
      // R2フォルダへの参照ショートカット: ExplorerをR2パスで開く
      const r2path = sc.r2Prefix ?? "";
      setExplorerInitPath(formatR2Path(r2path));
      setExplorerOpenKey((k) => k + 1);
      openWindow("explorer", { silent: true });
      return;
    }
    if (sc.explorerPath) {
      setExplorerInitPath(sc.explorerPath);
      setExplorerOpenKey((k) => k + 1);
      openWindow("explorer", { silent: true });
      return;
    }
    showInfo("Shortcut", `${sc.label}\nNo associated application.`);
  };

  const closeWindow = (id: AppId) => {
    if (id === "explorer") setExplorerInitPath(null);
    playDing();
    setWindows((p) => p.map((w) => (w.id === id ? { ...w, isOpen: false, isMinimized: false } : w)));
  };

  const minimizeWindow = (id: AppId) => {
    playMinimize();
    setWindows((p) => p.map((w) => (w.id === id ? { ...w, isMinimized: true } : w)));
  };

  const maximizeWindow = (id: AppId) => {
    playRestore();
    setWindows((p) => p.map((w) => (w.id === id ? { ...w, isMaximized: !w.isMaximized } : w)));
  };

  const updatePos = (id: AppId, x: number, y: number) =>
    setWindows((p) => p.map((w) => {
      if (w.id !== id) return w;
      const vw = viewW;
      const vh = viewH;
      const maxX = Math.max(0, vw - w.w - 4);
      const maxY = Math.max(0, vh - 30 - w.h - 4);
      return { ...w, x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) };
    }));

  const updateSize = (id: AppId, nw: number, nh: number) =>
    setWindows((p) => p.map((win) => {
      if (win.id !== id) return win;
      const vw = viewW;
      const vh = viewH;
      const cw = Math.min(nw, vw - win.x - 4);
      const ch = Math.min(nh, vh - 30 - win.y - 4);
      return { ...win, w: cw, h: ch };
    }));

  // Icon drag handlers (Pointer Eventsベースの自作ドラッグ。
  // ネイティブDnDを使わないためカスタムカーソルが維持される)
  // デスクトップVFS実体アイコンは: 近距離ドラッグ=既存のアイコン移動 / ウィンドウ上への遠距離ドラッグ=ファイルDnDセッション (Explorer等へ移動/コピー可能)
  const desktopFileDragRef = useRef<{ id: string; pid: number; startX: number; startY: number; off: () => void } | null>(null);
  const cancelDesktopFileDragListeners = () => {
    try { desktopFileDragRef.current?.off(); } catch {}
    desktopFileDragRef.current = null;
  };
  useEffect(() => () => { cancelDesktopFileDragListeners(); }, []);
  const iconForDesktopDoc = (doc: DesktopDoc): string => {
    const label = doc.name.split("/").pop() || doc.name;
    const isImg = /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(label) || doc.mime.startsWith("image/");
    const isMedia = /\.(mp3|wav|ogg|m4a|mp4|webm)$/i.test(label) || doc.mime.startsWith("audio/") || doc.mime.startsWith("video/");
    return isImg ? ICONS.paint : isMedia ? ICONS.mediaPlayer : (doc.mime.startsWith("text/") || /\.(txt|md|json|js|css|html)$/i.test(label)) ? ICONS.notepad : ICONS.fileWindows;
  };
  const isOverExplorerWindowAt = (clientX: number, clientY: number): boolean => {
    let el: Element | null = null;
    try { el = document.elementFromPoint(clientX, clientY); } catch { return false; }
    while (el) {
      if (el instanceof HTMLElement) {
        const wid = el.getAttribute?.("data-window-id");
        if (wid === "explorer") return true;
        // Explorerウィンドウ内のドロップ先 (一覧ペイン/左ナビ) を直接踏んでいれば即対象
        if (el.hasAttribute?.("data-wenge-drop") && /explorer/.test(el.getAttribute("data-wenge-drop") || "")) return true;
      }
      el = el.parentElement;
    }
    return false;
  };
  const onDesktopDocIconPointerDown = (e: React.PointerEvent, doc: DesktopDoc, iconId: AppId) => {
    // まず既存のアイコン移動/選択ハンドラを通す (近距離ドラッグ・クリック・ごみ箱DnDは従来どおり)
    handleIconPointerDown(e, iconId);
    if (e.pointerType === "touch") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    cancelDesktopFileDragListeners();
    const startX = e.clientX, startY = e.clientY, pid = e.pointerId, docId = doc.id;
    const payload: R2DragItem = { kind: "vfs-file", id: docId, name: doc.name, mime: doc.mime, size: doc.size };
    const ghostIcon = iconForDesktopDoc(doc);
    const label = doc.name.split("/").pop() || doc.name;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pid || !desktopFileDragRef.current) return;
      const mod = { ctrlKey: ev.ctrlKey, altKey: ev.altKey, shiftKey: ev.shiftKey };
      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (!isFileDragging()) {
        // Explorerウィンドウ上に十分運んだらファイルDnDセッションへ昇格 (アイコン移動側は据え置き)
        if (dist <= DRAG_THRESHOLD_PX || !isOverExplorerWindowAt(ev.clientX, ev.clientY)) return;
        setDragging((prev) => {
          if (!prev) return prev;
          // アイコンがゴーストに吸着しないよう開始位置へ戻す
          const orig = multiDrag?.[iconId as string] ?? iconPos[iconId as string];
          if (orig && prev.id === iconId) {
            setIconPos((pp) => ({ ...pp, [iconId as string]: orig }));
          }
          return { ...prev, hasMoved: false };
        });
        setHoverPos(null);
        beginFileDragSession(payload, createFileDragGhost(label, ghostIcon), ev.clientX, ev.clientY, mod);
      } else {
        moveFileDragSession(ev.clientX, ev.clientY, mod);
      }
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      cancelDesktopFileDragListeners();
      if (isFileDragging()) {
        // Explorerへ落ちれば移動/コピー実行。デスクトップ上なら何もせず (アイコン移動側が配置を担う)
        const dropped = finishFileDragSession(ev.clientX, ev.clientY, { ctrlKey: ev.ctrlKey, altKey: ev.altKey, shiftKey: ev.shiftKey });
        if (dropped) {
          // ファイルDnDが処理した場合はアイコン移動の後処理を抑止
          setDragging(null);
          setMultiDrag(null);
          setHoverPos(null);
          suppressDesktopClick.current = true;
        }
      }
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      cancelDesktopFileDragListeners();
      cancelFileDragSession();
    };
    const off = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    desktopFileDragRef.current = { id: docId, pid, startX, startY, off };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };
  const ensureDesktopCapture = (e: React.PointerEvent) => {
    try {
      const el = desktopRef.current;
      if (el && !el.hasPointerCapture?.(e.pointerId)) el.setPointerCapture(e.pointerId);
    } catch {}
  };
  const releaseDesktopCapture = (e: React.PointerEvent) => {
    try {
      const el = desktopRef.current;
      if (el && el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    } catch {}
  };
  const handleIconPointerDown = (e: React.PointerEvent, id: AppId) => {
    const isTouch = e.pointerType === "touch";
    const clientX = e.clientX;
    const clientY = e.clientY;
    const pos = iconPos[id] || {x:0,y:0};
    const v = toVirtual(clientX, clientY);
    const offsetX = v.x - pos.x;
    const offsetY = v.y - pos.y;

    // Selection logic
    const isSelected = selectedIds.has(id);
    const isMulti = !isTouch && (e.ctrlKey || e.metaKey);
    if(!isMulti && !isSelected){
      setSelectedIds(new Set([id]));
    } else if(isMulti){
      setSelectedIds(prev=>{ const n=new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; });
    } else {
      // already selected, keep set
      if(!isSelected) setSelectedIds(new Set([id]));
    }
    // アプリクリック時のサウンドは無効化（要望により）
    // playChord();

    if(isTouch){
      // long press required (発火時にキャプチャして追跡を継続)
      touchPidRef.current = e.pointerId;
      if(longPressTimer.current) window.clearTimeout(longPressTimer.current);
      longPressTimer.current = window.setTimeout(()=>{
        try { desktopRef.current?.setPointerCapture(touchPidRef.current as number); } catch {}
        setDragging({id, offsetX, offsetY, startX: clientX, startY: clientY, hasMoved:false});
        if(selectedIds.has(id)){
          const md:Record<string,{x:number,y:number}>={};
          selectedIds.forEach(sid=>{ if(iconPos[sid]) md[sid]={...iconPos[sid]}; });
          md[id]={...pos};
          setMultiDrag(md);
        } else {
          setMultiDrag({[id]:{...pos}});
        }
      }, 400) as any;
      e.stopPropagation();
      return;
    }

    setDragging({id, offsetX, offsetY, startX: clientX, startY: clientY, hasMoved:false});
    if(selectedIds.has(id)){
      const md:Record<string,{x:number,y:number}>={};
      selectedIds.forEach(sid=>{ if(iconPos[sid]) md[sid]={...iconPos[sid]}; });
      // ensure current
      md[id]={...pos};
      setMultiDrag(md);
    } else {
      setMultiDrag({[id]:{...pos}});
    }
    e.stopPropagation();
  };

  const handleStartMenuItemPointerDown = (e: React.PointerEvent, id: AppId, label: string, iconSrc: string) => {
    e.preventDefault();
    e.stopPropagation();
    const v = toVirtual(e.clientX, e.clientY);
    setStartOpen(false);
    setProgramsOpen(false); setDocumentsOpen(false); setSettingsOpen(false); setFindOpen(false);
    // つかんでいるアイコンがカーソルの真ん中に来るようオフセットを取る (仮想論理pxで保持)
    setDraggingFromStart({id, label, iconSrc, x: v.x, y: v.y, dx: 40, dy: 30});
    setDragging({id, offsetX: 40, offsetY: 30, startX: e.clientX, startY: e.clientY, hasMoved:false});
  };

  const handleDesktopPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    // コンテキストメニュー内の操作はメニューに任せる。
    // ここで setContextMenu(null) すると pointerdown 時点でメニューが
    // アンマウントされ、後続の click が MenuListItem に届かなくなる。
    if(target.closest("[data-context-menu]")) return;
    if(target.closest("[data-icon]")) return;
    if(target.closest("[data-start-menu]")) return;
    if(target.closest("[data-taskbar]")){
      setSelectedIds(new Set());
      setContextMenu(null);
      // Startボタン以外でのタスクバーClickはStartメニューを閉じる
      if(!target.closest("[data-start-button]")){
        setStartOpen(false);
        setProgramsOpen(false); setDocumentsOpen(false); setSettingsOpen(false); setFindOpen(false);
      }
      return;
    }
    // Window上での操作はアイコン選択をクリアするだけで範囲選択は開始しない
    // (モーダルダイアログ・BSOD上も同様。背景ハンドラがキャプチャを奪うと
    //  OKボタン等のclickが届かなくなるため、ここで早期リターンする)
    if(target.closest("[data-window]") || target.closest("[data-context-menu]") || target.closest("[data-system-dialog]") || target.closest("[data-bsod]")){
      setSelectedIds(new Set());
      setContextMenu(null);
      setStartOpen(false);
      setProgramsOpen(false); setDocumentsOpen(false); setSettingsOpen(false); setFindOpen(false);
      return;
    }
    setSelectedIds(new Set());
    setStartOpen(false);
    setProgramsOpen(false); setDocumentsOpen(false); setSettingsOpen(false); setFindOpen(false);
    setContextMenu(null);
    if((e.pointerType === "mouse" || e.pointerType === "pen") && e.button!==0) return;
    // 背景上での操作はキャプチャして追跡を継続 (クリック/ダブルクリックには影響しない)
    ensureDesktopCapture(e);
    const v=toVirtual(e.clientX, e.clientY);
    setSelectionRect({x0:v.x,y0:v.y,x1:v.x,y1:v.y});
  };

  const handleDesktopPointerMove = (e: React.PointerEvent) => {
    // ファイルDnDセッション中はアイコン移動側を動かさない (Explorer等へのドロップ用ゴーストが主役)
    if (isFileDragging()) {
      return;
    }
    const v = toVirtual(e.clientX, e.clientY);
    setHoverPos({x:v.x,y:v.y});
    // スタートメニューからのドラッグゴーストを追従 (仮想論理pxで保持)
    if(draggingFromStart){
      setDraggingFromStart(prev=> prev?{...prev, x: v.x, y: v.y}:prev);
      if(dragging){
        const dx=e.clientX - dragging.startX;
        const dy=e.clientY - dragging.startY;
        if(Math.abs(dx)>3 || Math.abs(dy)>3) dragging.hasMoved=true;
        if(dragging.hasMoved) { ensureDesktopCapture(e); markWengeDragStart(); }
      }
      return;
    }
    if(dragging){
      const rect=desktopRef.current?.getBoundingClientRect();
      if(!rect) return;
      // 論理px換算 (transform scale下ではrectが画面pxを返す)
      const rw = rect.width / viewScale, rh = rect.height / viewScale;
      const dx=e.clientX - dragging.startX;
      const dy=e.clientY - dragging.startY;
      if(Math.abs(dx)>3 || Math.abs(dy)>3) dragging.hasMoved=true;
      if(dragging.hasMoved) { ensureDesktopCapture(e); markWengeDragStart(); }
      const baseX = (e.clientX - rect.left) / viewScale - dragging.offsetX;
      const baseY = (e.clientY - rect.top) / viewScale - dragging.offsetY;
      const deltaX = baseX - (multiDrag?.[dragging.id]?.x ?? iconPos[dragging.id]?.x ?? 0);
      const deltaY = baseY - (multiDrag?.[dragging.id]?.y ?? iconPos[dragging.id]?.y ?? 0);
      setIconPos(prev=>{
        const n={...prev};
        if(multiDrag){
          Object.keys(multiDrag).forEach(k=>{
            const orig=multiDrag[k];
            let nx=orig.x + deltaX;
            let ny=orig.y + deltaY;
            // clamp
            nx=Math.max(0, Math.min(nx, rw - ICON_W));
            ny=Math.max(0, Math.min(ny, rh - ICON_H));
            // snap to grid (origin 12 to match getDefaultPos)
            nx=Math.round((nx - 12)/GRID_W)*GRID_W + 12;
            ny=Math.round((ny - 12)/GRID_H)*GRID_H + 12;
            // second clamp after snap
            nx=Math.max(12, Math.min(nx, rw - ICON_W -12));
            ny=Math.max(12, Math.min(ny, rh - ICON_H -12));
            // collision detection: check if this position overlaps with any other icon
            const otherIcons = Object.keys(n).filter(id => id !== k);
            for (const otherId of otherIcons) {
              const otherPos = n[otherId];
              if (otherPos && Math.abs(otherPos.x - nx) < ICON_W && Math.abs(otherPos.y - ny) < ICON_H) {
                // Find nearest available grid position
                let found = false;
                for (let radius = 1; radius <= 5 && !found; radius++) {
                  for (let dx = -radius; dx <= radius && !found; dx++) {
                    for (let dy = -radius; dy <= radius && !found; dy++) {
                      if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                      const tryX = nx + dx * GRID_W;
                      const tryY = ny + dy * GRID_H;
                      if (tryX < 12 || tryY < 12 || tryX > rw - ICON_W - 12 || tryY > rh - ICON_H - 12) continue;
                      let collision = false;
                      for (const checkId of otherIcons) {
                        const checkPos = n[checkId];
                        if (checkPos && Math.abs(checkPos.x - tryX) < ICON_W && Math.abs(checkPos.y - tryY) < ICON_H) {
                          collision = true;
                          break;
                        }
                      }
                      if (!collision) {
                        nx = tryX;
                        ny = tryY;
                        found = true;
                      }
                    }
                  }
                }
                if (!found) {
                  // If no free position found, keep original position
                  nx = orig.x;
                  ny = orig.y;
                }
                break;
              }
            }
            n[k]={x:nx,y:ny};
          });
        }
        return n;
      });
    }
    if(selectionRect){
      const v1=toVirtual(e.clientX, e.clientY);
      const newRect={...selectionRect, x1:v1.x,y1:v1.y};
      setSelectionRect(newRect);
      // compute selection
      const left=Math.min(newRect.x0,newRect.x1), right=Math.max(newRect.x0,newRect.x1), top=Math.min(newRect.y0,newRect.y1), bottom=Math.max(newRect.y0,newRect.y1);
      const sel=new Set<AppId>();
      Object.entries(iconPos).forEach(([id,pos])=>{
        const ix=pos.x, iy=pos.y, iw=ICON_W, ih=ICON_H;
        if(ix < right && ix+iw > left && iy < bottom && iy+ih > top) sel.add(id as AppId);
      });
      // also check run
      if(iconPos["run"]){
        const p=iconPos["run"];
        if(p.x < right && p.x+ICON_W > left && p.y < bottom && p.y+ICON_H > top) sel.add("run" as AppId);
      }
      setSelectedIds(sel);
    }
  };

  // ホバー中のカーソル位置（ゴミ箱ハイライト用。デスクトップドラッグ＋スタートメニュードラッグ両対応）
  const [hoverPos,setHoverPos]=useState<{x:number;y:number}|null>(null);
  // ゴミ箱アイコン上へドラッグ中はハイライトする
  const draggingOverRecycle = draggingFromStart
    ? (hoverPos ? isOverRecycleAt(hoverPos.x, hoverPos.y) : isOverRecycleAt(draggingFromStart.x, draggingFromStart.y))
    : !!(dragging && dragging.hasMoved && hoverPos && iconPos[dragging.id] && isOverRecycleAt(hoverPos.x, hoverPos.y));

  const handleDesktopPointerUp = (e: React.PointerEvent) => {
    markWengeDragEnd();
    releaseDesktopCapture(e);
    touchPidRef.current = null;
    if(longPressTimer.current){ clearTimeout(longPressTimer.current); longPressTimer.current=null; }
    // キャプチャ中はup後のclickがコンテナに向くため、ドラッグ後は抑止する
    if((dragging && dragging.hasMoved) || (draggingFromStart && dragging?.hasMoved)){
      suppressDesktopClick.current=true;
    }
    if(dragging && !dragging.hasMoved){
      // click without move already handled selection
    }

    // スタートメニューからドラッグ中のドロップ → デスクトップにショートカット作成
    if(draggingFromStart && dragging?.hasMoved){
      const rect=desktopRef.current?.getBoundingClientRect();
      // タスクバー帯（下端30px相当）を除外
      const inDesktop=!!rect && e.clientX>=rect.left && e.clientX<=rect.right && e.clientY>=rect.top && e.clientY<=rect.bottom-30*viewScale;
      const v=toVirtual(e.clientX,e.clientY);
      const overRecycle=isOverRecycleAt(v.x,v.y);
      const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
      const dropWin = dropTarget?.closest('[data-window-id]');
      const dropWinId = dropWin?.getAttribute('data-window-id');
      const onStartMenu = !!dropTarget?.closest('[data-start-menu]');
      if(inDesktop && !overRecycle && dropWinId!=='recycle' && !onStartMenu && rect){
        if(desktopIcons.some(ic=>ic.id===draggingFromStart.id)) playError();
        else addToDesktop(draggingFromStart.id, { label:draggingFromStart.label, iconSrc:draggingFromStart.iconSrc, x:v.x-40, y:v.y-30 });
      }
      setDraggingFromStart(null);
      setDragging(null);
      setMultiDrag(null);
      setHoverPos(null);
      setSelectionRect(null);
      return;
    }
    if(draggingFromStart){
      // 移動なし（ただのクリック）→ 従来どおりアプリを開く
      const id=draggingFromStart.id;
      setDraggingFromStart(null);
      setDragging(null);
      setMultiDrag(null);
      setHoverPos(null);
      setSelectionRect(null);
      openWindow(id, { silent: true });
      return;
    }

    // デスクトップアイコンのドラッグ → ゴミ箱アイコン上ならデスクトップから削除
    if(dragging && dragging.hasMoved){
      const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
      const dropWin = dropTarget?.closest('[data-window-id]');
      const dropWinId = dropWin?.getAttribute('data-window-id');
      const vd=toVirtual(e.clientX, e.clientY);
      if(dropWinId === 'recycle' || isOverRecycleAt(vd.x, vd.y)){
        // ドラッグしたアイコン＋範囲選択されたアイコンをまとめて削除
        const ids=new Set<AppId>([dragging.id as AppId, ...selectedIds]);
        setDragging(null);
        setMultiDrag(null);
        setHoverPos(null);
        setSelectionRect(null);
        ids.forEach(id=>removeFromDesktop(id));
        return;
      }
    }
    
    setDragging(null);
    setMultiDrag(null);
    setHoverPos(null);
    if(selectionRect){
      // ラバーバンド選択直後の Desktop onClick で選択がクリアされるのを防ぐ
      suppressDesktopClick.current=true;
    }
    setSelectionRect(null);
  };

  const handleDesktopContextMenu=(e: React.MouseEvent)=>{
    const target = e.target as HTMLElement;
    // Window内(IE含む)は各窓に任せ、デスクトップメニューを出さない
    if(target.closest("[data-window]") || target.closest("[data-context-menu]")){ e.preventDefault(); return; }
    e.preventDefault();
    const v=toVirtual(e.clientX, e.clientY);
    // アイコン上の右クリック → Win95風アイコンメニュー
    const iconEl = target.closest("[data-icon-id]") as HTMLElement | null;
    if(iconEl){
      const iconId = iconEl.getAttribute("data-icon-id") || "";
      let ctxTarget: IconCtxTarget | undefined;
      if(iconId === "run"){
        ctxTarget = { kind: "run" };
        setSelectedIds(new Set(["run" as AppId]));
      } else if(isDocIconKey(iconId)){
        const docId = docIdFromKey(iconId);
        const doc = desktopDocs.find((d)=> d.id===docId);
        const label = doc ? (doc.name.split("/").pop() || doc.name) : docId;
        ctxTarget = { kind: "doc", key: iconId, docId, label };
        if(!selectedIds.has(iconId as AppId)) setSelectedIds(new Set([iconId as AppId]));
      } else if(iconId.startsWith("shortcut:")){
        const sc = desktopShortcuts.find((s)=> s.key===iconId);
        ctxTarget = { kind: "shortcut", key: iconId, label: sc?.label ?? iconId };
        if(!selectedIds.has(iconId as AppId)) setSelectedIds(new Set([iconId as AppId]));
      } else if((APP_DEFS as Record<string,any>)[iconId]){
        const ic = desktopIcons.find((c)=> c.id===iconId);
        const def = (APP_DEFS as Record<string,any>)[iconId];
        ctxTarget = { kind: "app", id: iconId as AppId, label: ic?.label ?? def.title };
        if(!selectedIds.has(iconId as AppId)) setSelectedIds(new Set([iconId as AppId]));
      }
      if(ctxTarget){
        setContextMenu({x:v.x, y:v.y, target: ctxTarget});
        return;
      }
    }
    setContextMenu({x:v.x, y:v.y});
  };

  // --- Win95風アイコンメニューのアクション群 ---
  const openCtxTarget=(t: IconCtxTarget)=>{
    if(t.kind==="app"){ openWindow(t.id, { silent: true }); return; }
    if(t.kind==="doc"){
      const doc=desktopDocs.find((d)=> d.id===t.docId);
      if(doc) openVfsDoc(doc);
      else showError("Open", `Cannot find '${t.label}'.\nThe file may have been moved or deleted.`);
      return;
    }
    if(t.kind==="shortcut"){
      const sc=desktopShortcuts.find((s)=> s.key===t.key);
      if(sc) void openDesktopShortcut(sc);
      else showError("Open", `Cannot find shortcut '${t.label}'.`);
      return;
    }
    openWindow("run", { silent: true });
  };
  const exploreCtxTarget=(t: IconCtxTarget)=>{
    // Win95の Explore = Explorerで場所を開く。Wengeの仮想FS上の対応パスへ誘導する。
    if(t.kind==="doc"){ setExplorerInitPath("C:\\Desktop"); }
    else if(t.kind==="shortcut"){
      const sc=desktopShortcuts.find((s)=> s.key===t.key);
      if(sc?.explorerPath) setExplorerInitPath(sc.explorerPath);
      else setExplorerInitPath("C:\\Desktop");
    }
    else { setExplorerInitPath(null); }
    setExplorerOpenKey((k)=> k+1);
    openWindow("explorer", { silent: true });
  };
  const createShortcutOf=(t: IconCtxTarget)=>{
    const { w, h }=desktopSize();
    const occupied={ ...iconPos };
    const spot=findSpotForNew(undefined,undefined,w,h,occupied);
    const key=`shortcut:${Date.now().toString(36)}${Math.floor(Math.random()*1e6).toString(36)}`;
    if(t.kind==="app"){
      const def=(APP_DEFS as Record<string,any>)[t.id];
      setDesktopShortcuts((prev)=>[...prev,{ key, label: `${t.label} Shortcut`, iconSrc: def.iconSrc, appId: t.id }]);
    } else if(t.kind==="doc"){
      const doc=desktopDocs.find((d)=> d.id===t.docId);
      const label=doc ? (doc.name.split("/").pop() || doc.name) : t.label;
      const ll=label.toLowerCase();
      const iconSrc=/\.(png|jpe?g|gif|bmp|webp|svg)$/.test(ll)?ICONS.paint:/\.(mp3|wav|ogg|m4a|mp4|webm)$/.test(ll)?ICONS.mediaPlayer:/\.(txt|md|json|js|css|html)$/.test(ll)?ICONS.notepad:ICONS.fileWindows;
      setDesktopShortcuts((prev)=>[...prev,{ key, label: `Shortcut to ${label}`, iconSrc, vfsId: t.docId }]);
    } else if(t.kind==="shortcut"){
      const sc=desktopShortcuts.find((s)=> s.key===t.key);
      if(!sc) return;
      setDesktopShortcuts((prev)=>[...prev,{ key, label: sc.label, iconSrc: sc.iconSrc, appId: sc.appId, explorerPath: sc.explorerPath, vfsId: sc.vfsId, r2Key: sc.r2Key, r2Prefix: sc.r2Prefix, r2Mime: sc.r2Mime, r2Size: sc.r2Size }]);
    } else {
      return;
    }
    setIconPos((prev)=>({ ...prev, [key]: spot }));
  };
  const deleteCtxTarget=async (t: IconCtxTarget)=>{
    if(t.kind==="run" || (t.kind==="app" && t.id==="recycle")){ playError(); return; }
    const label = t.label;
    const ok = await showConfirm("Confirm Delete", `Are you sure you want to delete '${label}'?\nThis cannot be undone.`, "Delete", "Cancel");
    if(!ok) return;
    if(t.kind==="app") removeFromDesktop(t.id);
    else removeFromDesktop(t.key);
  };
  const startRename=(t: IconCtxTarget)=>{
    if(t.kind==="run" || (t.kind==="app" && t.id==="recycle")){ playError(); return; }
    const id = t.kind==="app" ? t.id : t.key;
    setRenamingId(id);
    setRenameValue(t.label);
  };
  const commitRename=async ()=>{
    if(!renamingId) return;
    const v=renameValue.trim();
    const id=renamingId;
    setRenamingId(null);
    if(!v) return;
    try{
      if(isDocIconKey(id)){
        const docId=docIdFromKey(id);
        const renamed=await renameVfsFile(docId, v);
        setDesktopDocs((prev)=> prev.map((d)=> d.id===docId ? { ...d, name: renamed.name, updatedAt: renamed.updatedAt } : d));
      } else if(id.startsWith("shortcut:")){
        setDesktopShortcuts((prev)=> prev.map((s)=> s.key===id ? { ...s, label: v } : s));
      } else {
        setDesktopIcons((prev)=> prev.map((ic)=> ic.id===id ? { ...ic, label: v } : ic));
      }
    }catch(e:any){
      showError("Rename", e?.message || "Rename failed.");
    }
  };
  const copyCtxTarget=(t: IconCtxTarget, op: "cut" | "copy")=>{
    if(t.kind==="run" || (t.kind==="app" && t.id==="recycle")){ playError(); return; }
    if(t.kind==="app"){
      const def=(APP_DEFS as Record<string,any>)[t.id];
      setFsClipboard({ op, kind: "app", id: t.id, label: t.label, iconSrc: def.iconSrc });
    } else if(t.kind==="doc"){
      const ll=t.label.toLowerCase();
      const iconSrc=/\.(png|jpe?g|gif|bmp|webp|svg)$/.test(ll)?ICONS.paint:/\.(mp3|wav|ogg|m4a|mp4|webm)$/.test(ll)?ICONS.mediaPlayer:/\.(txt|md|json|js|css|html)$/.test(ll)?ICONS.notepad:ICONS.fileWindows;
      setFsClipboard({ op, kind: "doc", id: t.docId, label: t.label, iconSrc });
    } else if(t.kind==="shortcut"){
      const sc=desktopShortcuts.find((s)=> s.key===t.key);
      if(!sc) return;
      setFsClipboard({ op, kind: "shortcut", id: t.key, label: sc.label, iconSrc: sc.iconSrc });
    }
  };
  const pasteClipboardAt=async (at?: {x:number;y:number})=>{
    if(!clipboard) return;
    const { w, h }=desktopSize();
    const occupied={ ...iconPos };
    const spot= at ? findSpotForNew(at.x, at.y, w, h, occupied) : findSpotForNew(undefined,undefined,w,h,occupied);
    const cb=clipboard;
    if(cb.kind==="app"){
      if(cb.op==="cut"){
        setIconPos((prev)=>({ ...prev, [cb.id]: spot }));
      } else {
        const def=(APP_DEFS as Record<string,any>)[cb.id];
        if(!def) return;
        const key=`shortcut:${Date.now().toString(36)}${Math.floor(Math.random()*1e6).toString(36)}`;
        setDesktopShortcuts((prev)=>[...prev,{ key, label: cb.label, iconSrc: def.iconSrc, appId: cb.id }]);
        setIconPos((prev)=>({ ...prev, [key]: spot }));
      }
    } else if(cb.kind==="shortcut"){
      const sc=desktopShortcuts.find((s)=> s.key===cb.id);
      if(!sc) return;
      if(cb.op==="cut"){
        setIconPos((prev)=>({ ...prev, [cb.id]: spot }));
      } else {
        const key=`shortcut:${Date.now().toString(36)}${Math.floor(Math.random()*1e6).toString(36)}`;
        setDesktopShortcuts((prev)=>[...prev,{ key, label: sc.label, iconSrc: sc.iconSrc, appId: sc.appId, explorerPath: sc.explorerPath, vfsId: sc.vfsId, r2Key: sc.r2Key, r2Prefix: sc.r2Prefix, r2Mime: sc.r2Mime, r2Size: sc.r2Size }]);
        setIconPos((prev)=>({ ...prev, [key]: spot }));
      }
    } else if(cb.kind==="doc"){
      try{
        if(cb.op==="cut"){
          setIconPos((prev)=>({ ...prev, [docIconKey(cb.id)]: spot }));
        } else {
          const copied=await copyVfsFile(cb.id, VFS_DESKTOP);
          const doc={ id: copied.id, name: copied.name, mime: copied.mime, size: copied.size, createdAt: copied.createdAt, updatedAt: copied.updatedAt, sourceR2Key: copied.sourceR2Key, sourceUrl: copied.sourceUrl, blob: copied.blob };
          setDesktopDocs((prev)=>[...prev, doc]);
          setIconPos((prev)=>({ ...prev, [docIconKey(copied.id)]: spot }));
        }
      }catch(e:any){
        showError("Paste", e?.message || "Paste failed.");
        return;
      }
    }
    if(cb.op==="cut") setFsClipboard(null);
  };
  const propertiesOf=(t: IconCtxTarget)=>{
    if(t.kind==="app"){
      const def=(APP_DEFS as Record<string,any>)[t.id];
      showInfo(`${t.label} Properties`, `Type: Application\nTitle: ${def.title}\nLocation: Desktop`);
    } else if(t.kind==="doc"){
      const doc=desktopDocs.find((d)=> d.id===t.docId);
      if(!doc) return;
      showInfo(`${t.label} Properties`, `Type: ${doc.mime || "File"}\nLocation: C:\\Desktop\nSize: ${(doc.size/1024).toFixed(1)} KB\nCreated: ${new Date(doc.createdAt).toLocaleString()}\nModified: ${new Date(doc.updatedAt).toLocaleString()}`);
    } else if(t.kind==="shortcut"){
      const sc=desktopShortcuts.find((s)=> s.key===t.key);
      const target = sc?.appId ? `Application: ${sc.appId}` : sc?.vfsId ? `File ID: ${sc.vfsId}` : sc?.r2Key ? `R2: ${sc.r2Key}` : sc?.r2Prefix !== undefined ? `R2: ${formatR2Path(sc.r2Prefix ?? "")}` : sc?.explorerPath ? `Path: ${sc.explorerPath}` : "(unknown)";
      showInfo(`${t.label} Properties`, `Type: Shortcut\nLocation: Desktop\nTarget: ${target}`);
    } else {
      showInfo("Run Properties", `Type: System command\nTarget: Run dialog`);
    }
  };
  // カスケード遷移時の角切り (Programs行→サブメニューへ斜め移動で一瞬枠外を
  // かすめる) で即閉じしないよう、閉鎖は遅延・再入場で取り消す。
  const closeTimer = useRef<number | null>(null);
  const cancelMenuClose = () => {
    if (closeTimer.current != null) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const scheduleMenuClose = () => {
    cancelMenuClose();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setProgramsOpen(false); setDocumentsOpen(false); setSettingsOpen(false); setFindOpen(false);
      setOpenSub(null);
    }, 300);
  };
  const closeMenus = () => { cancelMenuClose(); setStartOpen(false); setProgramsOpen(false); setDocumentsOpen(false); setSettingsOpen(false); setFindOpen(false); setOpenSub(null); };
  const renderProgramItem = (id: AppId) => {
    const def = APP_DEFS[id];
    if (!def) return null;
    return (
      <MenuListItem
        key={id}
        onClick={() => { openWindow(id, { silent: true }); closeMenus(); }}
        style={{ fontSize: 11, height:26, display:"flex", alignItems:"center", justifyContent:"flex-start" }}
        onPointerDown={(e) => handleStartMenuItemPointerDown(e, id, def.title, def.iconSrc as any)}
      >
        <img src={def.iconSrc} alt="" width={20} height={20} style={{ marginRight: 5 }} /> <span style={{ flex:1, textAlign:"left" }}>{def.title}</span>
      </MenuListItem>
    );
  };
  const renderDocumentsItem = (doc: DocumentsItem) => (
    <MenuListItem
      key={doc.label}
      onClick={() => { openWindow(doc.appId, { silent: true }); closeMenus(); }}
      style={{ fontSize: 11, height:26, display:"flex", alignItems:"center", justifyContent:"flex-start" }}
      onPointerDown={(e) => handleStartMenuItemPointerDown(e, doc.appId, doc.label, doc.iconSrc as any)}
    >
      <img src={doc.iconSrc} alt="" width={20} height={20} style={{ marginRight: 5, imageRendering:"pixelated" as const }} /> <span style={{ flex:1, textAlign:"left" }}>{doc.label}</span>
    </MenuListItem>
  );

  // --- XP boot / login gate (spec: show XP startup screen on open, password 4747 to enter) ---
  // Shutdown / Log off keeps the reload behavior, so a reload always restarts from boot.
  if (phase === "boot") {
    return <XpBoot onDone={() => setPhase("login")} />;
  }
  if (phase === "login") {
    return <XpLogin onSuccess={() => setPhase("desktop")} />;
  }

  return (
    <ScreenStage $virtual={isVirtualScreen} $bg={desktopBg}>
      <div
        id="wenge-virtual-screen"
        style={{
          width: viewW,
          height: viewH,
          transform: `scale(${viewScale})`,
          transformOrigin: "center center",
          flexShrink: 0,
          // WindowFrameの最大サイズ制約を仮想画面に合わせる
          ["--wenge-max-w" as any]: `${viewW}px`,
          ["--wenge-max-h" as any]: `${viewH - 30}px`,
        }}
      >
    <Desktop
      $bg={desktopBg}
      $w={viewW}
      $h={viewH}
      ref={desktopRef}
      data-wenge-drop="desktop"
      onClick={() => { if(suppressDesktopClick.current){ suppressDesktopClick.current=false; return; } setSelectedIds(new Set()); setStartOpen(false); setProgramsOpen(false); setDocumentsOpen(false); setSettingsOpen(false); setFindOpen(false); setContextMenu(null); }}
      onPointerDown={handleDesktopPointerDown}
      onPointerMove={handleDesktopPointerMove}
      onPointerUp={handleDesktopPointerUp}
      onPointerCancel={handleDesktopPointerUp}
      onPointerLeave={handleDesktopPointerUp}
      onContextMenu={handleDesktopContextMenu}
      onDragOver={handleDesktopDragOver}
      onDrop={handleDesktopDrop}
    >
      <IconsLayer>
        {desktopIcons.map((ic) => {
          const pos=iconPos[ic.id] || getDefaultPos(0, viewW, viewH);
          const selected=selectedIds.has(ic.id);
          // ゴミ箱へドラッグ中のハイライト（選択色を反転気味に）
          const recycleHL = ic.id==="recycle" && draggingOverRecycle;
          const hlSelected = selected || recycleHL;
          return (
            <Icon
              key={ic.id}
              data-icon
              data-icon-id={ic.id}
              $selected={hlSelected}
              $x={pos.x}
              $y={pos.y}
              onPointerDown={(e)=> handleIconPointerDown(e, ic.id)}
              onClick={(e) => { e.stopPropagation(); setContextMenu(null); setStartOpen(false); setProgramsOpen(false); setDocumentsOpen(false); setSettingsOpen(false); setFindOpen(false); }}
              onDoubleClick={(e) => { e.stopPropagation(); openWindow(ic.id, { silent: true }); }}
              title={recycleHL ? "ここにドロップで削除" : undefined}
            >
              <div style={{ width: 32, height: 32, position: "relative", display: "grid", placeItems: "center" }}>
                <IconImg
                  src={ic.iconSrc}
                  alt={ic.label}
                  draggable={false}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                    const fb = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null;
                    if (fb) fb.style.display = "grid";
                  }}
                />
                <IconFallback style={{ display: "none" }}>{ic.icon}</IconFallback>
              </div>
              <IconLabel>{renamingId===ic.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e)=> setRenameValue(e.target.value)}
                  onClick={(e)=> e.stopPropagation()}
                  onPointerDown={(e)=> e.stopPropagation()}
                  onDoubleClick={(e)=> e.stopPropagation()}
                  onKeyDown={(e)=>{ if(e.key==="Enter") void commitRename(); if(e.key==="Escape"){ setRenamingId(null); } e.stopPropagation(); }}
                  onBlur={()=> void commitRename()}
                  style={{ width: 72, fontSize: 11, textAlign: "center" }}
                />
              ) : ic.label}</IconLabel>
            </Icon>
          );
        })}
        {/* VFS実体ファイル (C:/Desktop・IndexedDB永続)。ダブルクリックで対応アプリに開く、ごみ箱DnDで削除 */}
        {desktopDocs.map((doc) => {
          const k=docIconKey(doc.id);
          const pos=iconPos[k] || getDefaultPos(0, viewW, viewH);
          const selected=selectedIds.has(k as AppId);
          const recycleHL=false;
          const hlSelected = selected || recycleHL;
          const label=doc.name.split("/").pop() || doc.name;
          const isImg=/\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(label) || doc.mime.startsWith("image/");
          const isMedia=/\.(mp3|wav|ogg|m4a|mp4|webm)$/i.test(label) || doc.mime.startsWith("audio/") || doc.mime.startsWith("video/");
          const iconSrc=isImg?ICONS.paint:isMedia?ICONS.mediaPlayer:(doc.mime.startsWith("text/")||/\.(txt|md|json|js|css|html)$/i.test(label))?ICONS.notepad:ICONS.fileWindows;
          return (
            <Icon
              key={k}
              data-icon
              data-icon-id={k}
              $selected={hlSelected}
              $x={pos.x}
              $y={pos.y}
              onPointerDown={(e)=> onDesktopDocIconPointerDown(e, doc, k as AppId)}
              onClick={(e) => { e.stopPropagation(); setContextMenu(null); setStartOpen(false); setProgramsOpen(false); setDocumentsOpen(false); setSettingsOpen(false); setFindOpen(false); }}
              onDoubleClick={(e) => { e.stopPropagation(); openVfsDoc(doc); }}
              title={`${doc.name}\n${(doc.size/1024).toFixed(1)} KB · double-click to open, drag to Recycle Bin to delete, drag to Explorer window to move (Ctrl=copy)`}
            >
              <div style={{ width: 32, height: 32, position: "relative", display: "grid", placeItems: "center" }}>
                <IconImg
                  src={iconSrc}
                  alt={label}
                  draggable={false}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                    const fb = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null;
                    if (fb) fb.style.display = "grid";
                  }}
                />
                <IconFallback style={{ display: "none" }}>{ICON_FALLBACK.fileWindows}</IconFallback>
              </div>
              <IconLabel>{renamingId===k ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e)=> setRenameValue(e.target.value)}
                  onClick={(e)=> e.stopPropagation()}
                  onPointerDown={(e)=> e.stopPropagation()}
                  onDoubleClick={(e)=> e.stopPropagation()}
                  onKeyDown={(e)=>{ if(e.key==="Enter") void commitRename(); if(e.key==="Escape"){ setRenamingId(null); } e.stopPropagation(); }}
                  onBlur={()=> void commitRename()}
                  style={{ width: 72, fontSize: 11, textAlign: "center" }}
                />
              ) : label}</IconLabel>
            </Icon>
          );
        })}
        {/* ショートカット (Explorerの静的エントリ等)。ダブルクリックでアプリ/フォルダを開く */}
        {desktopShortcuts.map((sc) => {
          const pos=iconPos[sc.key] || getDefaultPos(0, viewW, viewH);
          const selected=selectedIds.has(sc.key as AppId);
          return (
            <Icon
              key={sc.key}
              data-icon
              data-icon-id={sc.key}
              $selected={selected}
              $x={pos.x}
              $y={pos.y}
              onPointerDown={(e)=> handleIconPointerDown(e, sc.key as AppId)}
              onClick={(e) => { e.stopPropagation(); setContextMenu(null); setStartOpen(false); setProgramsOpen(false); setDocumentsOpen(false); setSettingsOpen(false); setFindOpen(false); }}
              onDoubleClick={(e) => { e.stopPropagation(); openDesktopShortcut(sc); }}
              title={sc.vfsId ? `${sc.label}\nShortcut to original file` : sc.explorerPath ? `${sc.label}\nShortcut to ${sc.explorerPath}` : `${sc.label}\nShortcut`}
            >
              <div style={{ width: 32, height: 32, position: "relative", display: "grid", placeItems: "center" }}>
                <IconImg
                  src={sc.iconSrc}
                  alt={sc.label}
                  draggable={false}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                    const fb = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null;
                    if (fb) fb.style.display = "grid";
                  }}
                />
                <IconFallback style={{ display: "none" }}>{ICON_FALLBACK.fileWindows}</IconFallback>
              </div>
              <IconLabel>{renamingId===sc.key ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e)=> setRenameValue(e.target.value)}
                  onClick={(e)=> e.stopPropagation()}
                  onPointerDown={(e)=> e.stopPropagation()}
                  onDoubleClick={(e)=> e.stopPropagation()}
                  onKeyDown={(e)=>{ if(e.key==="Enter") void commitRename(); if(e.key==="Escape"){ setRenamingId(null); } e.stopPropagation(); }}
                  onBlur={()=> void commitRename()}
                  style={{ width: 72, fontSize: 11, textAlign: "center" }}
                />
              ) : sc.label}</IconLabel>
            </Icon>
          );
        })}
        {/* Run icon */}
        {(()=>{
          const pos=iconPos["run"] || {x:12,y:12};
          const sel=selectedIds.has("run" as AppId);
          return (
            <Icon $selected={sel} $x={pos.x} $y={pos.y} data-icon data-icon-id="run"
              onPointerDown={(e)=> handleIconPointerDown(e, "run" as AppId)}
              onClick={e=>e.stopPropagation()}
              onDoubleClick={(e)=>{ e.stopPropagation(); openWindow("run", { silent: true }); }}
            >
              <div style={{ width: 32, height: 32, position: "relative", display: "grid", placeItems: "center" }}>
                <IconImg src={ICONS.run} alt="run" draggable={false} onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display="none"; const fb=(e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement|null; if(fb) fb.style.display="grid"; }} />
                <IconFallback style={{ display: "none" }}>{ICON_FALLBACK.run}</IconFallback>
              </div>
              <IconLabel>Run</IconLabel>
            </Icon>
          );
        })()}
        {selectionRect && (
          <SelectionRect $x={Math.min(selectionRect.x0,selectionRect.x1)} $y={Math.min(selectionRect.y0,selectionRect.y1)} $w={Math.abs(selectionRect.x1-selectionRect.x0)} $h={Math.abs(selectionRect.y1-selectionRect.y0)} />
        )}
        {/* スタートメニューからのドラッグゴースト */}
        {draggingFromStart && dragging?.hasMoved && (
          <div style={{ position:"absolute", left:draggingFromStart.x-40, top:draggingFromStart.y-30, width:ICON_W, pointerEvents:"none", opacity:0.8, zIndex:9999 }}>
            <div style={{ width:80, height:84, display:"flex", flexDirection:"column", alignItems:"center" }}>
              <div style={{ width:32, height:32, display:"grid", placeItems:"center" }}>
                <img src={draggingFromStart.iconSrc} alt="" width={32} height={32} style={{ imageRendering:"pixelated" as const }} draggable={false} />
              </div>
              <div style={{ marginTop:4, color:"#fff", fontSize:11, textAlign:"center", lineHeight:1.2, maxHeight:40, overflow:"hidden", background:"#000080", padding:"1px 3px" }}>{draggingFromStart.label}</div>
            </div>
          </div>
        )}
      </IconsLayer>

      {/* R2→Desktop copy progress */}
      {docDropBusy && (
        <div style={{ position: "absolute", right: 8, bottom: 38, zIndex: 9998, background: "#c0c0c0", border: "2px outset #fff", padding: "6px 10px", fontSize: 11 }}>
          {docDropBusy}
        </div>
      )}
      {/* Context menu */}      {contextMenu && contextMenu.target && (()=>{
        const t=contextMenu.target as IconCtxTarget;
        const isProtected = t.kind==="run" || (t.kind==="app" && t.id==="recycle");
        return (
        <ContextMenu data-context-menu $x={contextMenu.x} $y={contextMenu.y} onClick={(e)=>{ e.stopPropagation(); if(!(e.target as HTMLElement).closest('[role="menuitem"]')) setContextMenu(null); }} onPointerDown={e=>e.stopPropagation()} onContextMenu={e=>{ e.preventDefault(); e.stopPropagation(); }}>
          <MenuList style={{ width:"100%" }}>
            <MenuListItem primary onClick={()=>{ openCtxTarget(t); setContextMenu(null); }}><b>Open</b></MenuListItem>
            <MenuListItem onClick={()=>{ exploreCtxTarget(t); setContextMenu(null); }}>Explore</MenuListItem>
            <Separator />
            <MenuListItem disabled={isProtected} onClick={()=>{ if(isProtected) return; copyCtxTarget(t, "cut"); setContextMenu(null); }}>Cut</MenuListItem>
            <MenuListItem disabled={isProtected} onClick={()=>{ if(isProtected) return; copyCtxTarget(t, "copy"); setContextMenu(null); }}>Copy</MenuListItem>
            <MenuListItem disabled={!clipboard} onClick={()=>{ void pasteClipboardAt({x: contextMenu.x, y: contextMenu.y}); setContextMenu(null); }}>Paste{clipboard ? ` (${clipboard.op==="cut" ? "Move" : "Copy"}: ${clipboard.label})` : ""}</MenuListItem>
            <Separator />
            <MenuListItem disabled={t.kind==="run"} onClick={()=>{ createShortcutOf(t); setContextMenu(null); }}>Create Shortcut</MenuListItem>
            <MenuListItem disabled={isProtected} onClick={()=>{ void deleteCtxTarget(t); setContextMenu(null); }}>Delete</MenuListItem>
            <MenuListItem disabled={isProtected} onClick={()=>{ startRename(t); setContextMenu(null); }}>Rename</MenuListItem>
            <Separator />
            <MenuListItem onClick={()=>{ propertiesOf(t); setContextMenu(null); }}>Properties</MenuListItem>
          </MenuList>
        </ContextMenu>
        );
      })()}
      {contextMenu && !contextMenu.target && (
        <ContextMenu data-context-menu $x={contextMenu.x} $y={contextMenu.y} onClick={(e)=>{ e.stopPropagation(); if(!(e.target as HTMLElement).closest('[role="menuitem"]')) setContextMenu(null); }} onPointerDown={e=>e.stopPropagation()} onContextMenu={e=>{ e.preventDefault(); e.stopPropagation(); }}>
          <MenuList style={{ width:"100%" }}>
            <MenuListItem onClick={()=>{ autoArrange(); setContextMenu(null); }}>Auto Arrange</MenuListItem>
            <MenuListItem onClick={()=>{ lineUpIcons(); setContextMenu(null); }}>Line up Icons</MenuListItem>
            <Separator />
            <MenuListItem disabled={!clipboard} onClick={()=>{ void pasteClipboardAt({x: contextMenu.x, y: contextMenu.y}); setContextMenu(null); }}>Paste{clipboard ? ` (${clipboard.op==="cut" ? "Move" : "Copy"}: ${clipboard.label})` : ""}</MenuListItem>
            <MenuListItem onClick={()=>{ refreshDesktop(); setContextMenu(null); }}>Refresh</MenuListItem>
            <MenuListItem onClick={()=>{ setContextMenu(null); showInfo("Wenge 95", "Wenge 95\nProperties: 800x600, 256 colors"); }}>Properties</MenuListItem>
          </MenuList>
        </ContextMenu>
      )}

      {/* Windows (最小化してもアンマウントせず display:none で隠す。MediaPlayer等の再生・状態を維持するため) */}
      {windows.filter((w) => w.isOpen).map((w) => {
        const def = APP_DEFS[w.id];
        let comp: React.ReactNode = def.component;
        if (w.id === "recycle") comp = <RecycleBinApp playSound={playDing} />;
        if (w.id === "explorer") comp = <ExplorerApp key={explorerOpenKey === 0 ? "explorer" : `explorer-${explorerOpenKey}`} initialPath={explorerInitPath} onOpenApp={(id, file) => { if (file) { const doc: DesktopDoc = { id: file.id, name: file.name, mime: file.mime || "", size: file.size, createdAt: file.createdAt, updatedAt: file.updatedAt, blob: file.blob, sourceUrl: file.sourceUrl, sourceR2Key: file.sourceR2Key }; setVfsFileByApp((prev) => ({ ...prev, [id]: doc })); if (id === "exe-runner") setWindows((prev) => prev.map((w) => w.id === "exe-runner" ? { ...w, title: file.name } : w)); } openWindow(id as AppId, { silent: true }); }} />;
        if (w.id === "run") comp = <RunDialog onClose={() => closeWindow("run")} onRun={(id: any, file?: any) => { if (file) { const doc = { id: file.id, name: file.name, mime: file.mime || "", size: file.size ?? 0, createdAt: file.createdAt, updatedAt: file.updatedAt, blob: file.blob } as DesktopDoc; setVfsFileByApp((prev) => ({ ...prev, [id]: doc })); if (id === "exe-runner") setWindows((prev) => prev.map((w) => w.id === "exe-runner" ? { ...w, title: file.name } : w)); } openWindow(id as AppId, { silent: true }); }} />;
        if (w.id === "notepad") {
          const f = vfsFileByApp["notepad"];
          comp = (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <NotepadApp key={f ? `vfs-${f.id}` : "blank"} file={notepadFile as never} />
              <Separator />
              <DemoControls />
            </div>
          );
        }
        if (w.id === "media-player") {
          const f = vfsFileByApp["media-player"];
          comp = <MediaPlayerApp key={f ? `vfs-${f.id}` : "blank"} file={mediaPlayerFile as never} />;
        }
        if (w.id === "wordpad") {
          const f = vfsFileByApp["wordpad"];
          void f;
        }
        if (w.id === "image-viewer") {
          const f = vfsFileByApp["image-viewer"];
          comp = <ImageViewerApp key={f ? `vfs-${f.id}` : "blank"} file={imageViewerFile as never} />;
        }
        if (w.id === "ie") {
          comp = <InternetExplorerApp key={ieFile ? `vfs-${ieFile.id}` : "blank"} file={ieFile} />;
        }
        if (w.id === "exe-runner") {
          comp = <ExeRunnerApp key={exeRunnerFile ? `vfs-${exeRunnerFile.id}` : "blank"} file={exeRunnerFile as never} onLaunchApp={(id) => openWindow(id as AppId, { silent: true })} />;
        }
        return (
          <div key={w.id} style={{ display: w.isMinimized ? "none" : "contents" }}>
          <WindowFrame
            id={w.id}
            title={w.title}
            icon={w.icon}
            iconSrc={w.iconSrc}
            x={w.x}
            y={w.y}
            width={w.w}
            height={w.h}
            zIndex={w.z}
            maximized={w.isMaximized}
            active={focusedId === w.id}
            scale={viewScale}
            onFocus={() => focusWindow(w.id)}
            onClose={() => closeWindow(w.id)}
            onMinimize={() => minimizeWindow(w.id)}
            onMaximize={() => maximizeWindow(w.id)}
            onMove={(x, y) => updatePos(w.id, x, y)}
            onResize={(nw, nh) => updateSize(w.id, nw, nh)}
          >
            {comp}
          </WindowFrame>
          </div>
        );
      })}

      {/* In-OS modal dialogs (Win95 style) — always on top of windows */}
      <SystemDialogs />

      {/* BSOD */}
      {showBsod && (
        <div
          data-bsod
          onClick={() => setShowBsod(false)}
          style={{
            position: "absolute", inset: 0, background: "#0000aa", color: "#fff", zIndex: 10000,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            fontFamily: "monospace", padding: 40, cursor: "url('/cursors/hand.png') 12 0, pointer"
          }}
        >
          <div style={{ background: "#c0c0c0", color: "#0000aa", padding: "2px 8px", fontWeight: "bold" }}>Wenge</div>
          <div style={{ marginTop: 20, maxWidth: 600, lineHeight: 1.6, fontSize: 14 }}>
            An error has occurred. To continue:<br /><br />
            Press Enter to return to Wenge, or<br /><br />
            Press CTRL+ALT+DEL to restart your computer. If you do this,<br />
            you will lose any unsaved information in all open applications.<br /><br />
            Error: 0E : 016F : BFF9B3D4<br /><br />
            Press any key to continue <span style={{ animation: "blink 1s step-end infinite" }}>_</span>
          </div>
        </div>
      )}

      {/* Start Menu — Win95準拠 実機7項目 + Programs配下 */}
      {startOpen && (
        <StartMenuWrap data-start-menu onClick={(e) => e.stopPropagation()} style={{ cursor: "url('/cursors/arrow.png') 0 0, default" }}>
          <Frame variant="outside" style={{ padding: 2, background: "#c0c0c0" }}>
            <MenuList style={{ width: "100%" }}>
              <div style={{ display: "flex" }}>
                {/* 左帯 Wenge95 実機フォント準拠 */}
                <div style={{
                  width: 21, background: "#000080", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: "8px 0 10px", gap: 2, flexShrink:0
                }}>
                  <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: "'MS Sans Serif', 'Microsoft Sans Serif', sans-serif", fontWeight: 900, fontSize: 11, color: "#fff", letterSpacing: 0.5, lineHeight: 1 }}>Wenge</div>
                  <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: "Arial, sans-serif", fontWeight: 400, fontSize: 11, color: "#c0c0c0", lineHeight: 1 }}>95</div>
                </div>
                <div style={{ flex: 1, position:"relative" }}>
                  {/* Programs with cascading submenu */}
                  <div onMouseEnter={()=>{ cancelMenuClose(); setProgramsOpen(true); setDocumentsOpen(false); setSettingsOpen(false); setFindOpen(false); setOpenSub(null); }} onMouseLeave={()=>scheduleMenuClose()} style={{ position:"relative" }}>
                    <MenuListItem onClick={() => { cancelMenuClose(); setProgramsOpen(true); setDocumentsOpen(false); setSettingsOpen(false); setFindOpen(false); }} style={{ height:32, display:"flex", alignItems:"center", justifyContent:"flex-start", cursor: "url('/cursors/arrow.png') 0 0, default" }}>
                      <img src={ICONS.folderClosed} alt="" width={20} height={20} style={{ marginRight: 5, imageRendering: "pixelated" as const }} />
                      <span style={{ flex:1, textAlign:"left" }}>Programs</span> <span style={{ marginLeft:"auto", fontSize:8 }}>►</span>
                    </MenuListItem>
                    {programsOpen && (
                      <ProgramsSubmenu scale={viewScale} viewH={viewH}>
                        {/* トップ階層は10行・約245pxで確定しスクロール不要のため
                            Win95Scrollを挟まない (5px程度の誤差オーバーフローによる
                            誤スクロールバー/ヒットテスト不安定化を構造的に排除)。
                            万一の極小画面向け位置補正はProgramsSubmenuが担う。 */}
                        <Frame variant="outside" style={{ padding:2, background:"#c0c0c0", cursor: "url('/cursors/arrow.png') 0 0, default" }}>
                          <MenuList style={{ width:"100%" }}>
                            {PROGRAMS_GROUPS.map((g) => (
                              <div key={g.label} onMouseEnter={()=>{ cancelMenuClose(); setOpenSub(g.label); }} onMouseLeave={()=>setOpenSub(null)} style={{ position:"relative" }}>
                                <MenuListItem style={{ fontSize:11, height:26, display:"flex", alignItems:"center", justifyContent:"flex-start" }}>
                                  <img src={ICONS.folderClosed} alt="" width={20} height={20} style={{ marginRight:5, imageRendering:"pixelated" as const }} /> <span style={{ flex:1, textAlign:"left" }}>{g.label}</span> <span style={{ marginLeft:"auto", fontSize:8 }}>►</span>
                                </MenuListItem>
                                {openSub===g.label && (
                                  <ProgramsSubmenu scale={viewScale} viewH={viewH}>
                                    <Frame variant="outside" style={{ padding:2, background:"#c0c0c0", display:"flex", flexDirection:"column", flex:1, minHeight:0, minWidth:0, maxHeight:"inherit", overflow:"hidden", cursor: "url('/cursors/arrow.png') 0 0, default" }}>
                                      <Win95Scroll style={{ flex:1, minHeight:0, minWidth:0, width:"100%" }} maxHeight={isVirtualScreen ? `${viewH - 88}px` : "calc(100dvh - 88px)"}>
                                        <MenuList style={{ width:"100%" }}>
                                          {g.ids.map(renderProgramItem)}
                                        </MenuList>
                                      </Win95Scroll>
                                    </Frame>
                                  </ProgramsSubmenu>
                                )}
                              </div>
                            ))}
                            <Separator />
                            {PROGRAMS_TOP.map(renderProgramItem)}
                          </MenuList>
                        </Frame>
                      </ProgramsSubmenu>
                    )}
                  </div>
{/* 実機7項目 */}
                   {/* Documents with cascading submenu (Programs同様: hoverで展開、Explorer直開きしない) */}
                   <div onMouseEnter={()=>{ cancelMenuClose(); setDocumentsOpen(true); setProgramsOpen(false); setSettingsOpen(false); setFindOpen(false); setOpenSub(null); }} onMouseLeave={()=>scheduleMenuClose()} style={{ position:"relative" }}>
                     <MenuListItem onClick={() => { cancelMenuClose(); setDocumentsOpen(true); setProgramsOpen(false); setSettingsOpen(false); setFindOpen(false); }} style={{ height:32, display:"flex", alignItems:"center", justifyContent:"flex-start", cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.explorer} alt="" width={20} height={20} style={{ marginRight: 5, imageRendering: "pixelated" as const }} /> <span style={{ flex:1, textAlign:"left" }}>Documents</span> <span style={{ marginLeft:"auto", fontSize:8 }}>►</span></MenuListItem>
                     {documentsOpen && (
                       <ProgramsSubmenu scale={viewScale} viewH={viewH}>
                         <Frame variant="outside" style={{ padding:2, background:"#c0c0c0", cursor: "url('/cursors/arrow.png') 0 0, default" }}>
                           <MenuList style={{ width:"100%" }}>
                             {DOCUMENTS_ITEMS.map(renderDocumentsItem)}
                           </MenuList>
                         </Frame>
                       </ProgramsSubmenu>
                     )}
                   </div>
                   {/* Settings with cascading submenu (Programs同様: hoverで展開、直開きしない) */}
                   <div onMouseEnter={()=>{ cancelMenuClose(); setSettingsOpen(true); setProgramsOpen(false); setDocumentsOpen(false); setFindOpen(false); setOpenSub(null); }} onMouseLeave={()=>scheduleMenuClose()} style={{ position:"relative" }}>
                     <MenuListItem onClick={() => { cancelMenuClose(); setSettingsOpen(true); setProgramsOpen(false); setDocumentsOpen(false); setFindOpen(false); }} style={{ height:32, display:"flex", alignItems:"center", justifyContent:"flex-start", cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.controlPanel} alt="" width={20} height={20} style={{ marginRight: 5 }} /> <span style={{ flex:1, textAlign:"left" }}>Settings</span> <span style={{ marginLeft:"auto", fontSize:8 }}>►</span></MenuListItem>
                     {settingsOpen && (
                       <ProgramsSubmenu scale={viewScale} viewH={viewH}>
                         <Frame variant="outside" style={{ padding:2, background:"#c0c0c0", cursor: "url('/cursors/arrow.png') 0 0, default" }}>
                           <MenuList style={{ width:"100%" }}>
                             {SETTINGS_ITEMS.map(renderDocumentsItem)}
                           </MenuList>
                         </Frame>
                       </ProgramsSubmenu>
                     )}
                   </div>
                   {/* Find with cascading submenu (Programs同様: hoverで展開、直開きしない) */}
                   <div onMouseEnter={()=>{ cancelMenuClose(); setFindOpen(true); setProgramsOpen(false); setDocumentsOpen(false); setSettingsOpen(false); setOpenSub(null); }} onMouseLeave={()=>scheduleMenuClose()} style={{ position:"relative" }}>
                     <MenuListItem onClick={() => { cancelMenuClose(); setFindOpen(true); setProgramsOpen(false); setDocumentsOpen(false); setSettingsOpen(false); }} style={{ height:32, display:"flex", alignItems:"center", justifyContent:"flex-start", cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.find} alt="" width={20} height={20} style={{ marginRight: 5 }} /> <span style={{ flex:1, textAlign:"left" }}>Find</span> <span style={{ marginLeft:"auto", fontSize:8 }}>►</span></MenuListItem>
                     {findOpen && (
                       <ProgramsSubmenu scale={viewScale} viewH={viewH}>
                         <Frame variant="outside" style={{ padding:2, background:"#c0c0c0", cursor: "url('/cursors/arrow.png') 0 0, default" }}>
                           <MenuList style={{ width:"100%" }}>
                             {FIND_ITEMS.map(renderDocumentsItem)}
                           </MenuList>
                         </Frame>
                       </ProgramsSubmenu>
                     )}
                   </div>
                   <MenuListItem onClick={() => { openWindow("help", { silent: true }); setStartOpen(false); }} style={{ height:32, display:"flex", alignItems:"center", justifyContent:"flex-start", cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.help} alt="" width={20} height={20} style={{ marginRight: 5 }} /> <span style={{ flex:1, textAlign:"left" }}>Help</span></MenuListItem>
                   <MenuListItem onClick={() => { openWindow("run", { silent: true }); setStartOpen(false); }} style={{ height:32, display:"flex", alignItems:"center", justifyContent:"flex-start", cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.run} alt="" width={20} height={20} style={{ marginRight: 5 }} /> <span style={{ flex:1, textAlign:"left" }}>Run...</span></MenuListItem>
                   <Separator />
                   <MenuListItem onClick={() => { playError(); setShowBsod(true); }} style={{ height:26, display:"flex", alignItems:"center", justifyContent:"flex-start", cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.bsod} alt="" width={20} height={20} style={{ marginRight: 5, imageRendering: "pixelated" as const }} /><span style={{ flex:1, textAlign:"left" }}>Blue Screen</span></MenuListItem>
                   <MenuListItem onClick={() => { showConfirm("Shut Down Wenge", "Are you sure you want to shut down?").then((ok) => { if (!ok) return; const a = new Audio(SOUNDS.shutdown); applyMasterVolume(a, 0.5); a.play().catch(()=>{}); setTimeout(()=>location.reload(), 1500); }); }} style={{ height:26, display:"flex", alignItems:"center", justifyContent:"flex-start", cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.shutdown} alt="" width={20} height={20} style={{ marginRight: 5, imageRendering: "pixelated" as const }} /><span style={{ flex:1, textAlign:"left" }}>Shut Down...</span></MenuListItem>
                </div>
              </div>
            </MenuList>
          </Frame>
        </StartMenuWrap>
      )}

      {/* Taskbar */}
      <Taskbar data-taskbar>
        <Toolbar style={{ justifyContent: "space-between", alignItems: "center", padding: "2px 4px", height: "100%", boxSizing: "border-box", flexWrap: "nowrap", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, height: "100%", minHeight: 0 }}>
            <StartButton
              data-start-menu
              data-start-button
              $active={startOpen}
              onClick={(e) => { e.stopPropagation(); setStartOpen(v=>!v); setProgramsOpen(false); setDocumentsOpen(false); setSettingsOpen(false); setFindOpen(false); playChord(); }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <img src={ICONS.start} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e)=>((e.currentTarget as HTMLImageElement).style.display="none")} /> Start
            </StartButton>
            <Separator orientation="vertical" size="20px" style={{ margin: "0 4px", alignSelf: "center" }} />
            <div style={{ display: "flex", gap: 2, flexWrap: "nowrap", overflow: "hidden", alignItems: "center" }}>
              {windows.filter(w => w.isOpen).map(w => (
                <Button
                  key={w.id}
                  active={focusedId === w.id && !w.isMinimized}
                  onClick={() => {
                    if (w.isMinimized || focusedId !== w.id) focusWindow(w.id);
                    else minimizeWindow(w.id);
                  }}
                  style={{ height: 22, minHeight: 22, maxHeight: 22, paddingTop: 0, paddingBottom: 0, minWidth: 90, maxWidth: 130, justifyContent: "flex-start", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  <img
                    src={w.iconSrc}
                    alt=""
                    width={16}
                    height={16}
                    style={{ marginRight: 6, imageRendering: "pixelated" as const, flexShrink: 0 }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                      const fb = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null;
                      if (fb) fb.style.display = "inline";
                    }}
                  />
                  <span style={{ display: "none", marginRight: 6 }}>{w.icon}</span>
                  {w.title}
                </Button>
              ))}
            </div>
          </div>
          <Frame variant="well" style={{ padding: "2px 6px", display: "flex", alignItems: "center", gap: 8, minWidth: 90, justifyContent: "flex-end", position: "relative" }}>
            <TrayVolume />
            <span style={{ fontSize: 11 }}>{clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
          </Frame>
        </Toolbar>
      </Taskbar>
      </Desktop>
      </div>
    </ScreenStage>
  );
}
