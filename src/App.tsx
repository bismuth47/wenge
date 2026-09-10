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
import { NotepadApp } from "./apps/Notepad";
import { MyComputerApp } from "./apps/MyComputer";
import { RecycleBinApp } from "./apps/RecycleBin";
import { InternetExplorerApp } from "./apps/InternetExplorer";
import { AboutWengeApp } from "./apps/AboutWenge";
import { FileShareApp } from "./apps/FileShare";
import { ChatApp } from "./apps/ChatApp";
import { ControlPanelApp } from "./apps/ControlPanel";
import { MinesweeperApp } from "./apps/Minesweeper";
import { ICONS, ICON_FALLBACK } from "./assets/icons";

// --- Types ---
type AppId =
  | "my-computer"
  | "recycle"
  | "notepad"
  | "ie"
  | "file-share"
  | "chat"
  | "about"
  | "control"
  | "minesweeper"
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
  background: #008080;
  position: relative;
  overflow: hidden;
  padding-bottom: 30px;
  box-sizing: border-box;
`;

const Icons = styled.div`
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 12px;
  padding: 12px;
  height: calc(100% - 30px);
  width: 100%;
  box-sizing: border-box;
`;

const Icon = styled.div<{ $selected?: boolean }>`
  width: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px;
  background: ${(p) => (p.$selected ? "#000080" : "transparent")};
  color: ${(p) => (p.$selected ? "#fff" : "#fff")};
  border: 1px dotted ${(p) => (p.$selected ? "#fff" : "transparent")};
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
  word-break: break-all;
`;

const Taskbar = styled(AppBar)`
  position: fixed !important;
  bottom: 0;
  top: auto !important;
  height: 30px;
  z-index: 9999;
`;

const StartMenuWrap = styled.div`
  position: fixed;
  left: 2px;
  bottom: 32px;
  z-index: 9998;
  width: 220px;
`;

// --- App definitions ---
const APP_DEFS: Record<AppId, { title: string; icon: string; iconSrc: string; w: number; h: number; component: React.ReactNode }> = {
  "my-computer": { title: "My Computer", icon: ICON_FALLBACK.myComputer, iconSrc: ICONS.myComputer, w: 420, h: 340, component: <MyComputerApp /> },
  recycle: { title: "Recycle Bin", icon: ICON_FALLBACK.recycle, iconSrc: ICONS.recycle, w: 400, h: 300, component: <RecycleBinApp /> },
  notepad: { title: "Notepad", icon: ICON_FALLBACK.notepad, iconSrc: ICONS.notepad, w: 480, h: 360, component: <NotepadApp /> },
  ie: { title: "Internet Explorer", icon: ICON_FALLBACK.ie, iconSrc: ICONS.ie, w: 540, h: 420, component: <InternetExplorerApp /> },
  "file-share": { title: "File Share", icon: ICON_FALLBACK.fileShare, iconSrc: ICONS.fileShare, w: 520, h: 400, component: <FileShareApp /> },
  chat: { title: "Wenge Chat", icon: ICON_FALLBACK.chat, iconSrc: ICONS.chat, w: 420, h: 440, component: <ChatApp /> },
  about: { title: "About Wenge", icon: ICON_FALLBACK.about, iconSrc: ICONS.about, w: 380, h: 340, component: <AboutWengeApp /> },
  control: { title: "Control Panel", icon: ICON_FALLBACK.controlPanel, iconSrc: ICONS.controlPanel, w: 460, h: 380, component: <ControlPanelApp /> },
  minesweeper: { title: "Minesweeper", icon: ICON_FALLBACK.minesweeper, iconSrc: ICONS.minesweeper, w: 340, h: 380, component: <MinesweeperApp /> },
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

export default function App() {
  const clock = useClock();
  const playStartup = useSound(SOUNDS.startup, 0.4);
  const playChord = useSound(SOUNDS.chord, 0.5);
  const playDing = useSound(SOUNDS.ding, 0.5);
  const playMinimize = useSound(SOUNDS.minimize, 0.5);
  const playRestore = useSound(SOUNDS.restore, 0.5);
  const playNav = useSound(SOUNDS.navigation, 0.4);
  const playError = useSound(SOUNDS.error, 0.5);

  const [windows, setWindows] = useState<WinState[]>(() =>
    (Object.keys(APP_DEFS) as AppId[]).map((id, idx) => ({
      id,
      title: APP_DEFS[id].title,
      icon: APP_DEFS[id].icon,
      iconSrc: APP_DEFS[id].iconSrc,
      isOpen: id === "about" || id === "notepad", // initial open for demo
      isMinimized: false,
      isMaximized: false,
      x: 80 + (idx % 4) * 28,
      y: 24 + (idx % 4) * 28,
      w: APP_DEFS[id].w,
      h: APP_DEFS[id].h,
      z: idx + 1,
    }))
  );
  const [selectedIcon, setSelectedIcon] = useState<AppId | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [showBsod, setShowBsod] = useState(false);
  const maxZ = useRef(20);
  const [startupPlayed, setStartupPlayed] = useState(false);

  useEffect(() => {
    if (!startupPlayed) {
      const t = setTimeout(() => { playStartup(); setStartupPlayed(true); }, 400);
      return () => clearTimeout(t);
    }
  }, [playStartup, startupPlayed]);

  const focusedId = useMemo(() => {
    const open = windows.filter((w) => w.isOpen && !w.isMinimized);
    if (open.length === 0) return null;
    return open.reduce((a, b) => (a.z > b.z ? a : b)).id;
  }, [windows]);

  const openWindow = (id: AppId) => {
    playNav();
    setWindows((prev) => {
      const exists = prev.find((w) => w.id === id);
      if (exists) {
        maxZ.current += 1;
        return prev.map((w) => (w.id === id ? { ...w, isOpen: true, isMinimized: false, z: maxZ.current } : w));
      }
      maxZ.current += 1;
      const def = APP_DEFS[id];
      return [
        ...prev,
        { id, title: def.title, icon: def.icon, iconSrc: def.iconSrc, isOpen: true, isMinimized: false, isMaximized: false, x: 60 + Math.random() * 80, y: 40 + Math.random() * 60, w: def.w, h: def.h, z: maxZ.current },
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
    setWindows((p) => p.map((w) => (w.id === id ? { ...w, x: Math.max(0, x), y: Math.max(0, y) } : w)));

  const updateSize = (id: AppId, nw: number, nh: number) =>
    setWindows((p) => p.map((win) => (win.id === id ? { ...win, w: nw, h: nh } : win)));

  const desktopIcons: { id: AppId; label: string; icon: string; iconSrc: string }[] = [
    { id: "my-computer", label: "My Computer", icon: ICON_FALLBACK.myComputer, iconSrc: ICONS.myComputer },
    { id: "explorer", label: "Explorer", icon: ICON_FALLBACK.explorer, iconSrc: ICONS.explorer },
    { id: "recycle", label: "Recycle Bin", icon: ICON_FALLBACK.recycle, iconSrc: ICONS.recycle },
    { id: "notepad", label: "Notepad", icon: ICON_FALLBACK.notepad, iconSrc: ICONS.notepad },
    { id: "paint", label: "Paint", icon: ICON_FALLBACK.paint, iconSrc: ICONS.paint },
    { id: "calc", label: "Calculator", icon: ICON_FALLBACK.calc, iconSrc: ICONS.calc },
    { id: "ie", label: "Internet Explorer", icon: ICON_FALLBACK.ie, iconSrc: ICONS.ie },
    { id: "file-share", label: "File Share", icon: ICON_FALLBACK.fileShare, iconSrc: ICONS.fileShare },
    { id: "chat", label: "Wenge Chat", icon: ICON_FALLBACK.chat, iconSrc: ICONS.chat },
    { id: "control", label: "Control Panel", icon: ICON_FALLBACK.controlPanel, iconSrc: ICONS.controlPanel },
    { id: "minesweeper", label: "Minesweeper", icon: ICON_FALLBACK.minesweeper, iconSrc: ICONS.minesweeper },
    { id: "about", label: "About Wenge", icon: ICON_FALLBACK.about, iconSrc: ICONS.about },
  ];

  return (
    <Desktop onClick={() => { setSelectedIcon(null); setStartOpen(false); }}>
      {/* Icons */}
      <Icons>
        {desktopIcons.map((ic) => (
          <Icon
            key={ic.id}
            $selected={selectedIcon === ic.id}
            onClick={(e) => { e.stopPropagation(); setSelectedIcon(ic.id); playChord(); }}
            onDoubleClick={(e) => { e.stopPropagation(); openWindow(ic.id); }}
          >
            <div style={{ width: 32, height: 32, position: "relative", display: "grid", placeItems: "center" }}>
              <IconImg
                src={ic.iconSrc}
                alt={ic.label}
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
        ))}
        {/* Demo controls standalone icon */}
        <Icon
          $selected={selectedIcon === "run"}
          onClick={(e) => { e.stopPropagation(); setSelectedIcon("run"); }}
          onDoubleClick={(e) => { e.stopPropagation(); openWindow("run"); }}
        >
          <div style={{ width: 32, height: 32, position: "relative", display: "grid", placeItems: "center" }}>
            <IconImg
              src={ICONS.run}
              alt="run"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                const fb = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null;
                if (fb) fb.style.display = "grid";
              }}
            />
            <IconFallback style={{ display: "none" }}>{ICON_FALLBACK.run}</IconFallback>
          </div>
          <IconLabel>Run</IconLabel>
        </Icon>
      </Icons>

      {/* Windows */}
      {windows.filter((w) => w.isOpen && !w.isMinimized).map((w) => {
        const def = APP_DEFS[w.id];
        // Inject props for RunApp to close
        let comp: React.ReactNode = def.component;
        if (w.id === "recycle") comp = <RecycleBinApp playSound={playDing} />;
        if (w.id === "run") comp = <RunApp onClose={() => closeWindow("run")} />;
        // For demo purposes, add DemoControls tab inside paint? not needed
        // Wrap notepad with extra controls demo if needed
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

      {/* BSOD easter egg */}
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

      {/* Start Menu */}
      {startOpen && (
        <StartMenuWrap onClick={(e) => e.stopPropagation()}>
          <Frame variant="outside" style={{ padding: 2, background: "#c0c0c0" }}>
            <MenuList style={{ width: "100%" }}>
              <div style={{ display: "flex" }}>
                <div style={{
                  width: 22, background: "#000080", color: "#fff", writingMode: "vertical-rl",
                  textOrientation: "mixed", fontWeight: "bold", fontSize: 13, display: "grid", placeItems: "center", padding: "6px 0"
                }}>
                  Wenge95
                </div>
                <div style={{ flex: 1 }}>
                  <MenuListItem onClick={() => { openWindow("my-computer"); setStartOpen(false); }}>
                    <img src={ICONS.myComputer} alt="" width={16} height={16} style={{ marginRight: 8, imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                    Programs
                  </MenuListItem>
                  <MenuListItem onClick={() => { openWindow("explorer"); setStartOpen(false); }}>
                    <img src={ICONS.explorer} alt="" width={16} height={16} style={{ marginRight: 8, imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                    Documents
                  </MenuListItem>
                  <MenuListItem onClick={() => { openWindow("control"); setStartOpen(false); }}>
                    <img src={ICONS.controlPanel} alt="" width={16} height={16} style={{ marginRight: 8, imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                    Settings
                  </MenuListItem>
                  <MenuListItem onClick={() => { openWindow("file-share"); setStartOpen(false); }}>
                    <img src={ICONS.fileShare} alt="" width={16} height={16} style={{ marginRight: 8, imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                    Find
                  </MenuListItem>
                  <MenuListItem onClick={() => { openWindow("chat"); setStartOpen(false); }}>
                    <img src={ICONS.chat} alt="" width={16} height={16} style={{ marginRight: 8, imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                    Help
                  </MenuListItem>
                  <MenuListItem onClick={() => { openWindow("run"); setStartOpen(false); }}>
                    <img src={ICONS.run} alt="" width={16} height={16} style={{ marginRight: 8, imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                    Run...
                  </MenuListItem>
                  <Separator />
                  <MenuListItem onClick={() => { playError(); setShowBsod(true); }}><span style={{ marginRight: 8 }}>💥</span>Blue Screen</MenuListItem>
                  <MenuListItem onClick={() => { if (confirm("Shut down Wenge?")) { const a = new Audio(SOUNDS.shutdown); a.volume = 0.5; a.play().catch(()=>{}); setTimeout(()=>location.reload(), 1500); } }}><span style={{ marginRight: 8 }}>⏻</span>Shut Down...</MenuListItem>
                </div>
              </div>
            </MenuList>
          </Frame>
        </StartMenuWrap>
      )}

      {/* Taskbar */}
      <Taskbar>
        <Toolbar style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Button
              onClick={(e) => { e.stopPropagation(); setStartOpen(!startOpen); playChord(); }}
              active={startOpen}
              style={{ fontWeight: "bold", display: "flex", alignItems: "center", gap: 4 }}
            >
              <span style={{ fontSize: 14 }}>▦</span> Start
            </Button>
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
                  style={{ minWidth: 120, maxWidth: 150, justifyContent: "flex-start", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
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
            <span style={{ fontSize: 10 }}>🔊</span>
            <span style={{ fontSize: 11 }}>{clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
          </Frame>
        </Toolbar>
      </Taskbar>
    </Desktop>
  );
}
