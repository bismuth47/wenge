import { useState } from "react";
import { Button, Checkbox, Fieldset, Radio, Select, Slider } from "react95";

export function ControlPanelApp() {
  const [bg, setBg] = useState("#008080");
  const [volume, setVolume] = useState(70);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Fieldset label="画面">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12 }}>背景色:</span>
          <Select
            value={bg}
            onChange={(e: any) => setBg(e.target.value)}
            options={[
              { value: "#008080", label: "ティール #008080" },
              { value: "#000080", label: "ネイビー #000080" },
              { value: "#808080", label: "グレー #808080" },
            ]}
            width={160}
          />
          <Button onClick={() => (document.body.style.background = bg)}>適用</Button>
          <div style={{ width: 24, height: 18, background: bg, border: "2px inset #fff" }} />
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
          <Radio checked name="res" value="800x600" label="800 x 600" />
          <Radio checked={false} name="res" value="1024x768" label="1024 x 768" />
        </div>
      </Fieldset>

      <Fieldset label="サウンド">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12 }}>音量</span>
          <div style={{ width: 150 }}><Slider value={volume} onChange={(e: any) => setVolume(e.target.value)} min={0} max={100} /></div>
          <span style={{ fontSize: 12 }}>{volume}%</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <Checkbox checked value="startup">
            起動音
          </Checkbox>
          <Checkbox checked value="chord">
            操作音
          </Checkbox>
          <Checkbox checked={false} value="mute">
            消音
          </Checkbox>
        </div>
      </Fieldset>

      <Fieldset label="システム">
        <div style={{ display: "flex", gap: 8 }}>
          <Button>ハードウェア</Button>
          <Button>ネットワーク</Button>
          <Button>パスワード</Button>
        </div>
      </Fieldset>
    </div>
  );
}
