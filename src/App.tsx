import { useEffect, useMemo, useRef, useState } from "react";
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
import { useClock } from "./hooks/useClock";
import { SOUNDS, useSound } from "./hooks/useSound";
import { useAnimatedCursor } from "./hooks/useAnimatedCursor";
import { NotepadApp } from "./apps/Notepad";
import { MyComputerApp } from "./apps/MyComputer";
import { RecycleBinApp } from "./apps/RecycleBin";
import { InternetExplorerApp } from "./apps/InternetExplorer";
import { AboutWengeApp } from "./apps/AboutWenge";
import { FileShareApp } from "./apps/FileShare";
import { ChatApp } from "./apps/ChatApp";
import { ControlPanelApp } from "./apps/ControlPanel";
import { MinesweeperApp } from "./apps/Minesweeper";
import { MediaPlayerApp } from "./apps/MediaPlayer";
import { WordPadApp } from "./apps/WordPad";
import { MsDosApp } from "./apps/MsDos";
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
import { ICONS, ICON_FALLBACK } from "./assets/icons";

// --- Types ---
type AppId =
  | "my-computer"
  | "recycle"
  | "notepad"
  | "wordpad"
  | "msdos"
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
const Desktop = styled.div`
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: #008080;
  position: relative;
  overflow: hidden;
  padding-bottom: 30px;
  box-sizing: border-box;
  min-width: 320px;
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
  position: fixed;
  left: ${(p)=>p.$x}px;
  top: ${(p)=>p.$y}px;
  z-index: 9998;
  min-width: 180px;
  background: #c0c0c0;
  border: 2px outset #fff;
  padding: 2px;
  font-size: 11px;
`;

const Taskbar = styled(AppBar)`
  position: fixed !important;
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
  align-self: flex-start;
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
  position: fixed;
  left: 2px;
  bottom: 32px;
  z-index: 9998;
  width: 210px;
  max-height: calc(100vh - 40px);
  overflow: visible;
  cursor: url('/cursors/arrow.png') 0 0, default;
`;

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
  control: { title: "Control Panel", icon: ICON_FALLBACK.controlPanel, iconSrc: ICONS.controlPanel, w: 460, h: 380, component: <ControlPanelApp /> },
  minesweeper: { title: "Minesweeper", icon: ICON_FALLBACK.minesweeper, iconSrc: ICONS.minesweeper, w: 340, h: 380, component: <MinesweeperApp /> },
  "media-player": { title: "Media Player", icon: ICON_FALLBACK.mediaPlayer, iconSrc: ICONS.mediaPlayer, w: 520, h: 460, component: <MediaPlayerApp /> },
  paint: { title: "Paint", icon: ICON_FALLBACK.paint, iconSrc: ICONS.paint, w: 500, h: 380, component: <PaintApp /> },
  calc: { title: "Calculator", icon: ICON_FALLBACK.calc, iconSrc: ICONS.calc, w: 220, h: 300, component: <CalcApp /> },
  explorer: { title: "Explorer", icon: ICON_FALLBACK.explorer, iconSrc: ICONS.explorer, w: 520, h: 360, component: <ExplorerApp /> },
  run: { title: "Run", icon: ICON_FALLBACK.run, iconSrc: ICONS.run, w: 360, h: 180, component: <RunApp /> },
};

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
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <span style={{ fontSize: 11 }}>Width: {size}px</span>
        <div style={{ width: 80 }}><Slider value={size} min={1} max={12} onChange={(e: any) => setSize(Number(e.target.value))} /></div>
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

function ExplorerApp() {
  const [path, setPath] = useState("C:\\Wenge\\Documents");
  const files = [
    { name: "README.txt", size: "2 KB", type: "Text" },
    { name: "Wenge.bmp", size: "256 KB", type: "Bitmap" },
    { name: "Setup.exe", size: "1.2 MB", type: "Application" },
    { name: "Documents", size: "", type: "Folder" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: 11 }}>Location:</span>
        <TextInput value={path} onChange={(e) => setPath(e.target.value)} style={{ flex: 1 }} />
        <Button size="sm">Go</Button>
      </div>
      <div style={{ display: "flex", gap: 6, height: 200 }}>
        <Frame variant="well" style={{ width: 120, padding: 6, background: "#fff", fontSize: 11, overflow: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> Desktop</div>
          <div style={{ paddingLeft: 12, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.myComputer} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> My Computer</div>
          <div style={{ paddingLeft: 12, background: "#000080", color: "#fff", display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderOpen} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {path.split("\\").pop()}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.recycle} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> Recycle Bin</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.fileShare} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> Network</div>
        </Frame>
        <Frame variant="well" style={{ flex: 1, background: "#fff", padding: 0, overflow: "auto" }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#c0c0c0" }}><th style={{ textAlign: "left", padding: 3 }}>Name</th><th>Size</th><th>Type</th></tr></thead>
            <tbody>
              {files.map(f => <tr key={f.name} style={{ borderTop: "1px solid #c0c0c0" }}><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.fileWindows} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {f.name}</td><td style={{ textAlign: "center" }}>{f.size}</td><td style={{ textAlign: "center" }}>{f.type}</td></tr>)}
            </tbody>
          </table>
        </Frame>
      </div>
      <ProgressBar value={34} style={{ height: 10 }} />
    </div>
  );
}

function RunApp({ onClose }: { onClose?: () => void }) {
  const [cmd, setCmd] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <img src={ICONS.run} alt="" width={32} height={32} style={{ imageRendering: "pixelated" as const, flexShrink: 0 }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
        <div style={{ fontSize: 11, lineHeight: 1.5 }}>
          Type the name of a program, folder, document, or Internet resource,<br />
          and Wenge will open it for you.
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, width: 70 }}>Name:</span>
        <TextInput value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="e.g.: notepad, calc, mspaint" style={{ flex: 1 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <Button onClick={() => { alert(`Run: ${cmd || "(empty)"}`); onClose?.(); }}>OK</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button>Browse...</Button>
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
          <Button>Default</Button>
          <Button disabled>Disabled</Button>
          <Button active>Pressed</Button>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          <Checkbox checked={checked} onChange={() => setChecked(!checked)} value="cb1" label="Checkbox" />
          <Radio checked={radio === "a"} onChange={() => setRadio("a")} value="a" label="Option A" name="demo" />
          <Radio checked={radio === "b"} onChange={() => setRadio("b")} value="b" label="Option B" name="demo" />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Text input" width={140} />
          <div style={{ width: 100 }}><Slider value={slider} onChange={(e: any) => setSlider(Number(e.target.value))} min={0} max={100} /></div>
          <span style={{ fontSize: 11 }}>{slider}%</span>
        </div>
        <ProgressBar value={slider} style={{ marginTop: 8 }} />
      </Fieldset>
      <GroupBox label="Additional">
        <div style={{ fontSize: 11 }}>Demonstrates GroupBox / Fieldset / Frame / Separator</div>
        <Separator style={{ margin: "8px 0" }} />
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="sm">Small</Button>
          <Button size="sm">Medium</Button>
          <Button size="sm">Large</Button>
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
  const [contextMenu,setContextMenu]=useState<{x:number,y:number}|null>(null);
  const longPressTimer=useRef<number|null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [showBsod, setShowBsod] = useState(false);
  const maxZ = useRef(20);
  const [startupPlayed, setStartupPlayed] = useState(false);

  const desktopIcons: { id: AppId; label: string; icon: string; iconSrc: string }[] = [
    { id: "my-computer", label: "My Computer", icon: ICON_FALLBACK.myComputer, iconSrc: ICONS.myComputer },
    { id: "recycle", label: "Recycle Bin", icon: ICON_FALLBACK.recycle, iconSrc: ICONS.recycle },
    { id: "explorer", label: "Explorer", icon: ICON_FALLBACK.explorer, iconSrc: ICONS.explorer },
    { id: "ie", label: "Internet Explorer", icon: ICON_FALLBACK.ie, iconSrc: ICONS.ie },
    { id: "help", label: "Help", icon: ICON_FALLBACK.help, iconSrc: ICONS.help },
  ];

  // Initialize icon positions
  useEffect(()=>{
    const key="wenge_icon_pos";
    const saved=localStorage.getItem(key);
    if(saved){
      try{ const p=JSON.parse(saved); setIconPos(p); return; }catch{}
    }
    const w=window.innerWidth, h=window.innerHeight-30;
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

  const autoArrange=()=>{
    const w=window.innerWidth, h=window.innerHeight-30;
    const pos:Record<string,{x:number,y:number}>={};
    const sorted=[...desktopIcons].sort((a,b)=> a.label.localeCompare(b.label));
    sorted.forEach((ic,i)=> pos[ic.id]=getDefaultPos(i,w,h));
    pos["run"]=getDefaultPos(sorted.length,w,h);
    setIconPos(pos);
    localStorage.setItem("wenge_icon_pos", JSON.stringify(pos));
  };

  useEffect(() => {
    if (!startupPlayed) {
      const t = setTimeout(() => { playStartup(); setStartupPlayed(true); }, 400);
      return () => clearTimeout(t);
    }
  }, [playStartup, startupPlayed]);

  useEffect(() => {
    const clampWindows = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
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
  }, []);

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
      const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
      const vh = typeof window !== "undefined" ? window.innerHeight : 768;
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

  const closeWindow = (id: AppId) => {
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
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxX = Math.max(0, vw - w.w - 4);
      const maxY = Math.max(0, vh - 30 - w.h - 4);
      return { ...w, x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) };
    }));

  const updateSize = (id: AppId, nw: number, nh: number) =>
    setWindows((p) => p.map((win) => {
      if (win.id !== id) return win;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cw = Math.min(nw, vw - win.x - 4);
      const ch = Math.min(nh, vh - 30 - win.y - 4);
      return { ...win, w: cw, h: ch };
    }));

  // Icon drag handlers
  const handleIconPointerDown = (e: React.MouseEvent | React.TouchEvent, id: AppId) => {
    const isTouch = "touches" in e;
    const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    const pos = iconPos[id] || {x:0,y:0};
    const rect = desktopRef.current?.getBoundingClientRect();
    const offsetX = clientX - (rect?rect.left:0) - pos.x;
    const offsetY = clientY - (rect?rect.top:0) - pos.y;

    // Selection logic
    const isSelected = selectedIds.has(id);
    const isMulti = isTouch ? false : ((e as React.MouseEvent).ctrlKey || (e as React.MouseEvent).metaKey);
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
      // long press required
      if(longPressTimer.current) window.clearTimeout(longPressTimer.current);
      longPressTimer.current = window.setTimeout(()=>{
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

  const handleDesktopMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if(target.closest("[data-icon]")) return;
    if(target.closest("[data-start-menu]")) return;
    if(target.closest("[data-taskbar]")){
      setSelectedIds(new Set());
      setContextMenu(null);
      // Startボタン以外でのタスクバーClickはStartメニューを閉じる
      if(!target.closest("[data-start-button]")){
        setStartOpen(false);
        setProgramsOpen(false);
      }
      return;
    }
    // Window上での操作はアイコン選択をクリアするだけで範囲選択は開始しない
    if(target.closest("[data-window]") || target.closest("[data-context-menu]")){
      setSelectedIds(new Set());
      setContextMenu(null);
      setStartOpen(false);
      setProgramsOpen(false);
      return;
    }
    setSelectedIds(new Set());
    setStartOpen(false);
    setProgramsOpen(false);
    setContextMenu(null);
    if(e.button!==0) return;
    const rect=desktopRef.current?.getBoundingClientRect();
    if(!rect) return;
    const x0=e.clientX - rect.left;
    const y0=e.clientY - rect.top;
    setSelectionRect({x0,y0,x1:x0,y1:y0});
  };

  const handleDesktopMouseMove = (e: React.MouseEvent) => {
    if(dragging){
      const rect=desktopRef.current?.getBoundingClientRect();
      if(!rect) return;
      const dx=e.clientX - dragging.startX;
      const dy=e.clientY - dragging.startY;
      if(Math.abs(dx)>3 || Math.abs(dy)>3) dragging.hasMoved=true;
      const baseX = e.clientX - rect.left - dragging.offsetX;
      const baseY = e.clientY - rect.top - dragging.offsetY;
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
            nx=Math.max(0, Math.min(nx, rect.width - ICON_W));
            ny=Math.max(0, Math.min(ny, rect.height - ICON_H));
            // snap to grid (origin 12 to match getDefaultPos)
            nx=Math.round((nx - 12)/GRID_W)*GRID_W + 12;
            ny=Math.round((ny - 12)/GRID_H)*GRID_H + 12;
            // second clamp after snap
            nx=Math.max(12, Math.min(nx, rect.width - ICON_W -12));
            ny=Math.max(12, Math.min(ny, rect.height - ICON_H -12));
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
                      if (tryX < 12 || tryY < 12 || tryX > rect.width - ICON_W - 12 || tryY > rect.height - ICON_H - 12) continue;
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
      const rect=desktopRef.current?.getBoundingClientRect();
      if(!rect) return;
      const x1=e.clientX - rect.left;
      const y1=e.clientY - rect.top;
      const newRect={...selectionRect, x1,y1};
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
      if(sel.size>0) setSelectedIds(sel);
    }
  };

  const handleDesktopMouseUp = () => {
    if(longPressTimer.current){ clearTimeout(longPressTimer.current); longPressTimer.current=null; }
    if(dragging && !dragging.hasMoved){
      // click without move already handled selection
    }
    setDragging(null);
    setMultiDrag(null);
    setSelectionRect(null);
  };

  const handleTouchMove=(e: React.TouchEvent)=>{
    if(dragging){
      const rect=desktopRef.current?.getBoundingClientRect();
      if(!rect) return;
      const t=e.touches[0];
      const baseX=t.clientX - rect.left - dragging.offsetX;
      const baseY=t.clientY - rect.top - dragging.offsetY;
      const deltaX = baseX - (multiDrag?.[dragging.id]?.x ?? 0);
      const deltaY = baseY - (multiDrag?.[dragging.id]?.y ?? 0);
      setIconPos(prev=>{
        const n={...prev};
        if(multiDrag){
          Object.keys(multiDrag).forEach(k=>{
            const orig=multiDrag[k];
            let nx=orig.x + deltaX;
            let ny=orig.y + deltaY;
            nx=Math.max(0, Math.min(nx, rect.width - ICON_W));
            ny=Math.max(0, Math.min(ny, rect.height - ICON_H));
            nx=Math.round((nx - 12)/GRID_W)*GRID_W + 12;
            ny=Math.round((ny - 12)/GRID_H)*GRID_H + 12;
            nx=Math.max(12, Math.min(nx, rect.width - ICON_W -12));
            ny=Math.max(12, Math.min(ny, rect.height - ICON_H -12));
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
                      if (tryX < 12 || tryY < 12 || tryX > rect.width - ICON_W - 12 || tryY > rect.height - ICON_H - 12) continue;
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
      e.preventDefault();
    }
  };
  const handleTouchEnd=()=>{
    if(longPressTimer.current){ clearTimeout(longPressTimer.current); longPressTimer.current=null; }
    setDragging(null); setMultiDrag(null);
  };

  const handleDesktopContextMenu=(e: React.MouseEvent)=>{
    e.preventDefault();
    setContextMenu({x:e.clientX, y:e.clientY});
  };

  return (
    <Desktop
      ref={desktopRef}
      onClick={() => { setSelectedIds(new Set()); setStartOpen(false); setProgramsOpen(false); setContextMenu(null); }}
      onMouseDown={handleDesktopMouseDown}
      onMouseMove={handleDesktopMouseMove}
      onMouseUp={handleDesktopMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleDesktopContextMenu}
    >
      <IconsLayer>
        {desktopIcons.map((ic) => {
          const pos=iconPos[ic.id] || getDefaultPos(0, window.innerWidth, window.innerHeight);
          const selected=selectedIds.has(ic.id);
          return (
            <Icon
              key={ic.id}
              data-icon
              $selected={selected}
              $x={pos.x}
              $y={pos.y}
              onMouseDown={(e)=> handleIconPointerDown(e, ic.id)}
              onTouchStart={(e)=> handleIconPointerDown(e, ic.id)}
              onClick={(e) => { e.stopPropagation(); }}
              onDoubleClick={(e) => { e.stopPropagation(); openWindow(ic.id, { silent: true }); }}
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
              <IconLabel>{ic.label}</IconLabel>
            </Icon>
          );
        })}
        {/* Run icon */}
        {(()=>{
          const pos=iconPos["run"] || {x:12,y:12};
          const sel=selectedIds.has("run" as AppId);
          return (
            <Icon $selected={sel} $x={pos.x} $y={pos.y} data-icon
              onMouseDown={(e)=> handleIconPointerDown(e, "run" as AppId)}
              onTouchStart={(e)=> handleIconPointerDown(e, "run" as AppId)}
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
      </IconsLayer>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu data-context-menu $x={contextMenu.x} $y={contextMenu.y} onClick={e=>e.stopPropagation()}>
          <MenuList style={{ width:"100%" }}>
            <MenuListItem onClick={()=>{ autoArrange(); setContextMenu(null); }}>Auto Arrange</MenuListItem>
            <MenuListItem onClick={()=>{ autoArrange(); setContextMenu(null); }}>Line up Icons</MenuListItem>
            <Separator />
            <MenuListItem onClick={()=>{ setContextMenu(null); location.reload(); }}>Refresh</MenuListItem>
            <MenuListItem onClick={()=>{ setContextMenu(null); alert("Wenge 95\nProperties: 800x600, 256 colors"); }}>Properties</MenuListItem>
          </MenuList>
        </ContextMenu>
      )}

      {/* Windows */}
      {windows.filter((w) => w.isOpen && !w.isMinimized).map((w) => {
        const def = APP_DEFS[w.id];
        let comp: React.ReactNode = def.component;
        if (w.id === "recycle") comp = <RecycleBinApp playSound={playDing} />;
        if (w.id === "run") comp = <RunApp onClose={() => closeWindow("run")} />;
        if (w.id === "notepad") {
          comp = (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <NotepadApp />
              <Separator />
              <DemoControls />
            </div>
          );
        }
        return (
          <WindowFrame
            key={w.id}
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
            onFocus={() => focusWindow(w.id)}
            onClose={() => closeWindow(w.id)}
            onMinimize={() => minimizeWindow(w.id)}
            onMaximize={() => maximizeWindow(w.id)}
            onMove={(x, y) => updatePos(w.id, x, y)}
            onResize={(nw, nh) => updateSize(w.id, nw, nh)}
          >
            {comp}
          </WindowFrame>
        );
      })}

      {/* BSOD */}
      {showBsod && (
        <div
          onClick={() => setShowBsod(false)}
          style={{
            position: "fixed", inset: 0, background: "#0000aa", color: "#fff", zIndex: 10000,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            fontFamily: "monospace", padding: 40, cursor: "pointer"
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
        <StartMenuWrap data-start-menu onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
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
                  <div onMouseEnter={()=>setProgramsOpen(true)} onMouseLeave={()=>setProgramsOpen(false)} style={{ position:"relative" }}>
                    <MenuListItem onClick={() => { openWindow("explorer", { silent: true }); setStartOpen(false); }} style={{ height:32, display:"flex", alignItems:"center", fontSize:11, cursor: "url('/cursors/arrow.png') 0 0, default" }}>
                      <img src={ICONS.myComputer} alt="" width={16} height={16} style={{ marginRight: 8, imageRendering: "pixelated" as const }} />
                      Programs <span style={{ marginLeft:"auto", fontSize:8 }}>►</span>
                    </MenuListItem>
                    {programsOpen && (
                      <div style={{ position:"absolute", left:"100%", top:-4, width:200, zIndex:9999, cursor: "url('/cursors/arrow.png') 0 0, default" }}>
                        <Frame variant="outside" style={{ padding:2, background:"#c0c0c0", cursor: "url('/cursors/arrow.png') 0 0, default" }}>
                          <MenuList style={{ width:"100%" }}>
                            <div style={{ fontSize:9, color:"#808080", padding:"2px 6px", background:"#c0c0c0", fontWeight:"bold" }}>Accessories</div>
                            <MenuListItem onClick={() => { openWindow("wordpad", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.wordpad} alt="" width={16} height={16} style={{ marginRight: 8 }} /> WordPad</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("notepad", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.notepad} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Notepad</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("paint", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.paint} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Paint</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("calc", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.calc} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Calculator</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("clock", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.clock} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Clock</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("charmap", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.charmap} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Character Map</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("msdos", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.msdos} alt="" width={16} height={16} style={{ marginRight: 8 }} /> MS-DOS Prompt</MenuListItem>
                            <Separator />
                            <div style={{ fontSize:9, color:"#808080", padding:"2px 6px", fontWeight:"bold" }}>Multimedia</div>
                            <MenuListItem onClick={() => { openWindow("media-player", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.mediaPlayer} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Media Player</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("cd-player", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.cdPlayer} alt="" width={16} height={16} style={{ marginRight: 8 }} /> CD Player</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("sound-recorder", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.soundRecorder} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Sound Recorder</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("volume", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.volume} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Volume Control</MenuListItem>
                            <Separator />
                            <div style={{ fontSize:9, color:"#808080", padding:"2px 6px", fontWeight:"bold" }}>Games</div>
                            <MenuListItem onClick={() => { openWindow("minesweeper", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.minesweeper} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Minesweeper</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("solitaire", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.solitaire} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Solitaire</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("freecell", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.freecell} alt="" width={16} height={16} style={{ marginRight: 8 }} /> FreeCell</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("hearts", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.hearts} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Hearts</MenuListItem>
                            <Separator />
                            <div style={{ fontSize:9, color:"#808080", padding:"2px 6px", fontWeight:"bold" }}>System Tools</div>
                            <MenuListItem onClick={() => { openWindow("scandisk", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.scandisk} alt="" width={16} height={16} style={{ marginRight: 8 }} /> ScanDisk</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("backup", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.backup} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Backup</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("sysmon", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.sysmon} alt="" width={16} height={16} style={{ marginRight: 8 }} /> System Monitor</MenuListItem>
                            <Separator />
                            <MenuListItem onClick={() => { openWindow("explorer", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.explorer} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Explorer</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("file-share", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.fileShare} alt="" width={16} height={16} style={{ marginRight: 8 }} /> File Share</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("chat", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.chat} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Wenge Chat</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("briefcase", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.briefcase} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Briefcase</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("dialer", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.dialer} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Phone Dialer</MenuListItem>
                            <MenuListItem onClick={() => { openWindow("network", { silent: true }); setStartOpen(false); setProgramsOpen(false); }} style={{ fontSize: 11, height:22 }}><img src={ICONS.network} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Network Neighborhood</MenuListItem>
                          </MenuList>
                        </Frame>
                      </div>
                    )}
                  </div>
{/* 実機7項目 */}
                   <MenuListItem onClick={() => { openWindow("explorer", { silent: true }); setStartOpen(false); }} style={{ height:32, cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.explorer} alt="" width={16} height={16} style={{ marginRight: 8, imageRendering: "pixelated" as const }} /> Documents <span style={{ marginLeft:"auto", fontSize:8 }}>►</span></MenuListItem>
                   <MenuListItem onClick={() => { openWindow("control", { silent: true }); setStartOpen(false); }} style={{ height:32, cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.controlPanel} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Settings <span style={{ marginLeft:"auto", fontSize:8 }}>►</span></MenuListItem>
                   <MenuListItem onClick={() => { openWindow("find", { silent: true }); setStartOpen(false); }} style={{ height:32, cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.find} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Find <span style={{ marginLeft:"auto", fontSize:8 }}>►</span></MenuListItem>
                   <MenuListItem onClick={() => { openWindow("help", { silent: true }); setStartOpen(false); }} style={{ height:32, cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.help} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Help</MenuListItem>
                   <MenuListItem onClick={() => { openWindow("run", { silent: true }); setStartOpen(false); }} style={{ height:32, cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.run} alt="" width={16} height={16} style={{ marginRight: 8 }} /> Run...</MenuListItem>
                   <Separator />
                   <MenuListItem onClick={() => { playError(); setShowBsod(true); }} style={{ height:26, cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.bsod} alt="" width={16} height={16} style={{ marginRight: 8, imageRendering: "pixelated" as const }} />Blue Screen</MenuListItem>
                   <MenuListItem onClick={() => { if (confirm("Shut down Wenge?")) { const a = new Audio(SOUNDS.shutdown); a.volume = 0.5; a.play().catch(()=>{}); setTimeout(()=>location.reload(), 1500); } }} style={{ height:26, cursor: "url('/cursors/arrow.png') 0 0, default" }}><img src={ICONS.shutdown} alt="" width={16} height={16} style={{ marginRight: 8, imageRendering: "pixelated" as const }} />Shut Down...</MenuListItem>
                </div>
              </div>
            </MenuList>
          </Frame>
        </StartMenuWrap>
      )}

      {/* Taskbar */}
      <Taskbar data-taskbar>
        <Toolbar style={{ justifyContent: "space-between", alignItems: "flex-start", padding: "2px 4px 0 4px", height: "100%", boxSizing: "border-box", flexWrap: "nowrap", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 4, height: "100%", minHeight: 0, paddingTop: 1 }}>
            <StartButton
              data-start-menu
              data-start-button
              $active={startOpen}
              onClick={(e) => { e.stopPropagation(); setStartOpen(v=>!v); setProgramsOpen(false); playChord(); }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <img src={ICONS.start} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e)=>((e.currentTarget as HTMLImageElement).style.display="none")} /> Start
            </StartButton>
            <Separator orientation="vertical" size="24px" style={{ margin: "0 4px" }} />
            <div style={{ display: "flex", gap: 2, flexWrap: "nowrap", overflow: "hidden" }}>
              {windows.filter(w => w.isOpen).map(w => (
                <Button
                  key={w.id}
                  active={focusedId === w.id && !w.isMinimized}
                  onClick={() => {
                    if (w.isMinimized || focusedId !== w.id) focusWindow(w.id);
                    else minimizeWindow(w.id);
                  }}
                  style={{ minWidth: 90, maxWidth: 130, justifyContent: "flex-start", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
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
          <Frame variant="well" style={{ padding: "2px 6px", display: "flex", alignItems: "center", gap: 8, minWidth: 90, justifyContent: "flex-end" }}>
            <img src={ICONS.volume} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e)=>((e.currentTarget as HTMLImageElement).style.display="none")} />
            <span style={{ fontSize: 11 }}>{clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
          </Frame>
        </Toolbar>
      </Taskbar>
    </Desktop>
  );
}
