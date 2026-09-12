import { useState } from "react";
import { Button, Frame, ProgressBar, TextInput } from "react95";
import { showError, showInfo } from "../components/SystemDialog";
import { ICONS } from "../assets/icons";

export type ExplorerOpenId = "notepad"|"wordpad"|"paint"|"calc"|"clock"|"msdos"|"minesweeper"|"solitaire"|"freecell"|"hearts"|"media-player"|"cd-player"|"sound-recorder"|"volume"|"control"|"help"|"find"|"recycle"|"network"|"my-computer"|string;

type FEntry = { name: string; size: string; type: string; app?: string };

const FS: Record<string, { folders: string[]; files: FEntry[] }> = {
  "C:\\": { folders: ["Wenge","Windows","Program Files"], files: [{name:"AUTOEXEC.BAT",size:"1 KB",type:"Batch"},{name:"CONFIG.SYS",size:"1 KB",type:"System"}] },
  "C:\\Wenge": { folders: ["Documents","Media","Games"], files: [{name:"README.txt",size:"2 KB",type:"Text",app:"notepad"},{name:"Wenge.bmp",size:"256 KB",type:"Bitmap",app:"paint"},{name:"Setup.exe",size:"1.2 MB",type:"Application"}] },
  "C:\\Wenge\\Documents": { folders: [], files: [{name:"README.txt",size:"2 KB",type:"Text",app:"notepad"},{name:"Report.doc",size:"45 KB",type:"Document",app:"wordpad"},{name:"Budget.xls",size:"32 KB",type:"Sheet"}] },
  "C:\\Wenge\\Media": { folders: [], files: [{name:"chimes.wav",size:"120 KB",type:"Sound",app:"media-player"},{name:"tada.wav",size:"80 KB",type:"Sound",app:"media-player"},{name:"Wenge.bmp",size:"256 KB",type:"Bitmap",app:"paint"}] },
  "C:\\Wenge\\Games": { folders: [], files: [{name:"Solitaire",size:"",type:"Game",app:"solitaire"},{name:"Minesweeper",size:"",type:"Game",app:"minesweeper"}] },
  "C:\\Windows": { folders: ["System","Fonts","Help"], files: [{name:"WIN.COM",size:"45 KB",type:"Application"},{name:"NOTEPAD.EXE",size:"32 KB",type:"Application",app:"notepad"},{name:"CALC.EXE",size:"18 KB",type:"Application",app:"calc"}] },
  "C:\\Windows\\System": { folders: [], files: [{name:"SHELL.DLL",size:"120 KB",type:"System"}] },
  "C:\\Windows\\Fonts": { folders: [], files: [{name:"MS Sans Serif",size:"",type:"Font"}] },
  "C:\\Windows\\Help": { folders: [], files: [{name:"WENGE.HLP",size:"60 KB",type:"Help",app:"help"}] },
  "C:\\Program Files": { folders: ["Internet Explorer","Media Player"], files: [{name:"README.txt",size:"1 KB",type:"Text",app:"notepad"}] },
};

export function normExplorerKey(p: string): string {
  let s = p.trim().replace(/\//g, "\\");
  s = s.replace(/\\+$/, "");
  if (!s) return "C:\\";
  if (/^c:$/i.test(s)) return "C:\\";
  const hit = Object.keys(FS).find((k) => k.toLowerCase() === s.toLowerCase());
  return hit ?? s;
}

export function ExplorerApp({ onOpenApp }: { onOpenApp?: (id: any) => void }) {
  const [path, setPath] = useState("C:\\Wenge\\Documents");
  const [input, setInput] = useState("C:\\Wenge\\Documents");
  const [selected, setSelected] = useState<string | null>(null);
  const key = normExplorerKey(path);
  const dir = FS[key];
  const folders = dir?.folders ?? [];
  const files = dir?.files ?? [];
  const goTo = (p: string) => {
    const k = normExplorerKey(p);
    if ((FS as any)[k]) { setPath(k); setInput(k); setSelected(null); }
    else { showError("Explorer", "Cannot find '" + p + "'.\nCheck the spelling and try again."); setInput(path); }
  };
  const goUp = () => {
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
  const crumbs = key === "C:\\" ? ["C:\\"] : key.split("\\");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <Button size="sm" onClick={goUp} disabled={key === "C:\\"} title="Up one level">Up</Button>
        <span style={{ fontSize: 11 }}>Location:</span>
        <TextInput value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") goTo(input); }} style={{ flex: 1 }} />
        <Button size="sm" onClick={() => goTo(input)}>Go</Button>
      </div>
      <div style={{ fontSize: 11, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        {crumbs.map((c, i) => {
          const p = i === 0 ? "C:\\" : crumbs.slice(0, i + 1).join("\\");
          return (<span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>{i > 0 && <span style={{ color: "#808080" }}>›</span>}<a href="#" onClick={(e) => { e.preventDefault(); goTo(p); }} style={{ color: "#000080" }}>{i === 0 ? "C:\\" : c}</a></span>);
        })}
      </div>
      <div style={{ display: "flex", gap: 6, height: 200 }}>
        <Frame variant="well" style={{ width: 130, padding: 6, background: "#fff", fontSize: 11, overflow: "auto" }}>
          {[ { label: "My Computer", icon: ICONS.myComputer, target: "C:\\" }, { label: "C: (Wenge)", icon: ICONS.hardDrive, target: "C:\\" }, { label: "Wenge", icon: ICONS.folderClosed, target: "C:\\Wenge" }, { label: "Windows", icon: ICONS.folderClosed, target: "C:\\Windows" }, { label: "Recycle Bin", icon: ICONS.recycle, target: "__recycle" }, { label: "Network", icon: ICONS.fileShare, target: "__network" } ].map((n) => {
            const active = n.target !== "__recycle" && n.target !== "__network" && normExplorerKey(n.target) === key;
            return (<div key={n.label} onClick={() => { if (n.target === "__recycle") onOpenApp?.("recycle"); else if (n.target === "__network") onOpenApp?.("network"); else goTo(n.target); }} style={{ paddingLeft: (n.label === "Wenge" || n.label === "Windows") ? 12 : 0, background: active ? "#000080" : "transparent", color: active ? "#fff" : "#000", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", paddingTop: 2, paddingBottom: 2 }}><img src={n.icon} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {n.label}</div>);
          })}
        </Frame>
        <Frame variant="well" style={{ flex: 1, background: "#fff", padding: 0, overflow: "auto" }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#c0c0c0" }}><th style={{ textAlign: "left", padding: 3 }}>Name</th><th>Size</th><th>Type</th></tr></thead>
            <tbody>
              {key !== "C:\\" && (<tr onClick={goUp} onDoubleClick={goUp} style={{ cursor: "pointer" }} title="Up to parent folder"><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> ..</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Parent Folder</td></tr>)}
              {folders.map((fd) => (<tr key={fd} onClick={() => setSelected(fd)} onDoubleClick={() => goTo(key === "C:\\" ? ("C:\\" + fd) : (key + "\\" + fd))} style={{ borderTop: "1px solid #c0c0c0", background: selected === fd ? "#000080" : "transparent", color: selected === fd ? "#fff" : "#000", cursor: "pointer" }}><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.folderClosed} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {fd}</td><td style={{ textAlign: "center" }}></td><td style={{ textAlign: "center" }}>Folder</td></tr>))}
              {files.map((f) => (<tr key={f.name} onClick={() => setSelected(f.name)} onDoubleClick={() => openEntry(f)} style={{ borderTop: "1px solid #c0c0c0", background: selected === f.name ? "#000080" : "transparent", color: selected === f.name ? "#fff" : "#000", cursor: "pointer" }}><td style={{ padding: 3, display: "flex", alignItems: "center", gap: 4 }}><img src={ICONS.fileWindows} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} /> {f.name}</td><td style={{ textAlign: "center" }}>{f.size}</td><td style={{ textAlign: "center" }}>{f.type}</td></tr>))}
            </tbody>
          </table>
          {!dir && <div style={{ padding: 16, fontSize: 11 }}>Folder not found. <a href="#" onClick={(e) => { e.preventDefault(); goTo("C:\\"); }}>Back to C:\</a></div>}
        </Frame>
      </div>
      <div style={{ fontSize: 11 }}>{dir ? (folders.length + files.length) + " object(s)" : "0 object(s)"} · {key}</div>
      <ProgressBar value={dir ? 100 : 0} style={{ height: 10 }} />
    </div>
  );
}
