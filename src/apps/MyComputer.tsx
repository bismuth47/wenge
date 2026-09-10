import { Button, Fieldset, ProgressBar, Select } from "react95";
import { ICONS } from "../assets/icons";

export function MyComputerApp() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Fieldset label="Drives">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "C: (Wenge)", iconSrc: ICONS.hardDrive, fallback: "💾", free: 78 },
            { label: "A: Floppy", iconSrc: ICONS.floppy, fallback: "💿", free: 32 },
            { label: "D: CD-ROM", iconSrc: ICONS.cd, fallback: "📀", free: 0 },
          ].map((d) => (
            <div key={d.label} style={{ textAlign: "center", width: 90 }}>
              <img
                src={d.iconSrc}
                alt={d.label}
                width={32}
                height={32}
                style={{ imageRendering: "pixelated" as const }}
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
        </div>
      </Fieldset>
      <Fieldset label="System Info">
        <div style={{ fontSize: 12, lineHeight: "1.6" }}>
          <div>OS: Wenge 95 ver 4.0.950</div>
          <div>CPU: WengeChip 133MHz</div>
          <div>Memory: 32MB RAM</div>
          <div>Resolution: 800x600 256 colors</div>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <Button>Properties</Button>
          <Select defaultValue="Details" options={[{ value: "Details", label: "Details" }, { value: "Simple", label: "Simple" }]} width={100} />
        </div>
      </Fieldset>
    </div>
  );
}
