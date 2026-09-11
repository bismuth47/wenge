import { useState, useEffect } from "react";
import { Button, Checkbox, Fieldset, Radio, Select, Slider } from "react95";
import { getSoundEnabled, setSoundEnabled, SOUNDS } from "../hooks/useSound";

export function ControlPanelApp() {
  const [bg, setBg] = useState("#008080");
  const [volume, setVolume] = useState(70);
  const [soundEnabled, setSoundEnabledState] = useState(() => getSoundEnabled());
  useEffect(() => { setSoundEnabled(soundEnabled); }, [soundEnabled]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Fieldset label="Display">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12 }}>Background:</span>
          <Select
            value={bg}
            onChange={(e: any) => setBg(e.target.value)}
            options={[
              { value: "#008080", label: "Teal #008080" },
              { value: "#000080", label: "Navy #000080" },
              { value: "#808080", label: "Gray #808080" },
            ]}
            width={160}
          />
          <Button onClick={() => (document.body.style.background = bg)}>Apply</Button>
          <div style={{ width: 24, height: 18, background: bg, border: "2px inset #fff" }} />
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
          <Radio checked name="res" value="800x600" label="800 x 600" />
          <Radio checked={false} name="res" value="1024x768" label="1024 x 768" />
        </div>
      </Fieldset>

      <Fieldset label="Sound">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12 }}>Volume</span>
          <div style={{ width: 150 }}><Slider value={volume} onChange={(e: any) => setVolume(Number(e.target.value))} min={0} max={100} /></div>
          <span style={{ fontSize: 12 }}>{volume}%</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Checkbox checked={soundEnabled} onChange={() => setSoundEnabledState((v) => !v)} value="enabled" label="Sound enabled (default ON)" />
          <Button size="sm" onClick={() => { const a = new Audio(SOUNDS.chord); a.volume = volume / 100; if (!soundEnabled) a.muted = true; a.play().catch(()=>{}); }}>Test</Button>
        </div>
        <div style={{ fontSize: 10, color: "#808080", marginTop: 4 }}>
          デフォルトON。OFFにすると全ての効果音(起動/操作/エラー)がミュートされます。Media Playerの音量は別。
        </div>
      </Fieldset>

      <Fieldset label="System">
        <div style={{ display: "flex", gap: 8 }}>
          <Button>Hardware</Button>
          <Button>Network</Button>
          <Button>Password</Button>
        </div>
      </Fieldset>
    </div>
  );
}
