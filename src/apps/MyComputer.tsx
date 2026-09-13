import { Button, Fieldset, ProgressBar, Select, TextInput } from "react95";
import { useState } from "react";
import { ICONS } from "../assets/icons";
import { showInfo } from "../components/SystemDialog";

export function MyComputerApp() {
  const [view, setView] = useState("Details");
  const [filter, setFilter] = useState("");
  const drives = [
    { label: "C: (Wenge)", iconSrc: ICONS.hardDrive, fallback: "💾", free: 78, total: "1.2 GB", fs: "FAT16" },
    { label: "A: Floppy", iconSrc: ICONS.floppy, fallback: "💿", free: 32, total: "1.44 MB", fs: "FAT12" },
    { label: "D: CD-ROM", iconSrc: ICONS.cd, fallback: "📀", free: 0, total: "650 MB", fs: "CDFS" },
  ];
  const shown = drives.filter((d) => d.label.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11 }}>Find drive:</span>
        <TextInput value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="e.g. C:" style={{ flex: 1 }} />
      </div>
      <Fieldset label="Drives">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {shown.map((d) => (
            <div key={d.label} style={{ textAlign: "center", width: 90 }} onDoubleClick={() => showInfo(d.label, `${d.label}\nFile system: ${d.fs}\nCapacity: ${d.total}\nFree: ${d.free}%`)}>
              <img
                src={d.iconSrc}
                alt={d.label}
                width={32}
                height={32}
                style={{ imageRendering: "pixelated" as const, cursor: "url('/cursors/hand.png') 12 0, pointer" }}
                onClick={() => showInfo(d.label, `${d.label}\nFile system: ${d.fs}\nCapacity: ${d.total}\nFree: ${d.free}%`)}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const fb = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null;
                  if (fb) fb.style.display = "block";
                }}
              />
              <div style={{ display: "none", fontSize: 32 }}>{d.fallback}</div>
              <div style={{ fontSize: 11 }}>{d.label}</div>
              <ProgressBar value={d.free} style={{ height: 8, marginTop: 4 }} />
              <div style={{ fontSize: 10 }}>{d.free}% free</div>
            </div>
          ))}
          {shown.length === 0 && <div style={{ fontSize: 11, color: "#808080" }}>No drives match "{filter}".</div>}
        </div>
      </Fieldset>
      <Fieldset label="System Info">
        <div style={{ fontSize: 12, lineHeight: "1.6" }}>
          <div>OS: Wenge 95 ver 4.0.950</div>
          <div>CPU: WengeChip 133MHz</div>
          <div>Memory: 32MB RAM</div>
          <div>Resolution: 800x600 256 colors</div>
          {view === "Details" && <div style={{ fontSize: 11, color: "#333" }}>User: Wenge · Uptime: {Math.floor(performance.now() / 60000)} min · Shell: Explorer</div>}
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <Button onClick={() => showInfo("System Properties", "Wenge 95\nRegistered to: Wenge User\nMemory: 32MB RAM\nSystem: WengeChip 133MHz")}>Properties</Button>
          <Select value={view} onChange={(e: any) => setView(e.target.value)} options={[{ value: "Details", label: "Details" }, { value: "Simple", label: "Simple" }]} width={100} />
        </div>
      </Fieldset>
    </div>
  );
}
