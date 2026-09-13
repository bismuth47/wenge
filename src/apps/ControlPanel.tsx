import { useState, useEffect } from "react";
import { Button, Checkbox, Fieldset, Radio, Select, Slider } from "react95";
import { getSoundEnabled, setSoundEnabled, SOUNDS } from "../hooks/useSound";
import { showInfo } from "../components/SystemDialog";
import { DL_TARGET_EVENT, getDownloadSetting, setDownloadSetting, type DownloadSetting } from "../lib/downloadTarget";
import {
  RESOLUTION_EVENT,
  RESOLUTIONS,
  UI_SCALE_EVENT,
  UI_SCALES,
  enterFullscreen,
  exitFullscreen,
  getResolution,
  getUiScale,
  isFullscreen,
  setResolution,
  setUiScale,
  type ResolutionId,
  type UiScale,
} from "../lib/display";

export function ControlPanelApp() {
  const [bg, setBg] = useState(() => {
    try { return localStorage.getItem("wenge_bg") ?? "#008080"; } catch { return "#008080"; }
  });
  const [resolution, setResolutionState] = useState<ResolutionId>(() => getResolution());
  const [uiScale, setUiScaleState] = useState<UiScale>(() => getUiScale());
  const [fullscreen, setFullscreen] = useState(() => isFullscreen());
  useEffect(() => {
    const onRes = (e: Event) => setResolutionState((e as CustomEvent<ResolutionId>).detail);
    const onScale = (e: Event) => setUiScaleState((e as CustomEvent<UiScale>).detail);
    const onFs = () => setFullscreen(isFullscreen());
    window.addEventListener(RESOLUTION_EVENT, onRes);
    window.addEventListener(UI_SCALE_EVENT, onScale);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener(RESOLUTION_EVENT, onRes);
      window.removeEventListener(UI_SCALE_EVENT, onScale);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);
  const [volume, setVolume] = useState(70);
  const [soundEnabled, setSoundEnabledState] = useState(() => getSoundEnabled());
  useEffect(() => { setSoundEnabled(soundEnabled); }, [soundEnabled]);
  const [dlTarget, setDlTarget] = useState<DownloadSetting>(() => getDownloadSetting());
  useEffect(() => {
    const onDl = (e: Event) => setDlTarget((e as CustomEvent<DownloadSetting>).detail);
    window.addEventListener(DL_TARGET_EVENT, onDl);
    return () => window.removeEventListener(DL_TARGET_EVENT, onDl);
  }, []);
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
          <Button onClick={() => { try { localStorage.setItem("wenge_bg", bg); } catch {} try { window.dispatchEvent(new CustomEvent("wenge:bg", { detail: bg })); } catch {} document.body.style.background = bg; }}>Apply</Button>
          <div style={{ width: 24, height: 18, background: bg, border: "2px inset #fff" }} />
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Radio checked={resolution === "native"} onChange={() => setResolution("native")} name="res" value="native" label="Native (full window)" />
          {(Object.keys(RESOLUTIONS) as ResolutionId[]).map((id) => (
            <Radio key={id} checked={resolution === id} onChange={() => setResolution(id)} name="res" value={id} label={RESOLUTIONS[id as keyof typeof RESOLUTIONS].label} />
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#808080", marginTop: 4 }}>
          Native以外は画面中央に仮想画面を表示します(余白は黒帯)。ウィンドウ・アイコン位置は自動で収められます。
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12 }}>UI scale:</span>
          {UI_SCALES.map((s) => (
            <Radio key={s} checked={uiScale === s} onChange={() => setUiScale(s)} name="uiscale" value={String(s)} label={`${s}%`} />
          ))}
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12 }}>Full screen:</span>
          {fullscreen
            ? <Button size="sm" onClick={() => exitFullscreen()}>Exit Full Screen</Button>
            : <Button size="sm" onClick={() => enterFullscreen()}>Enter Full Screen</Button>}
          <span style={{ fontSize: 11, color: "#555" }}>{fullscreen ? "全画面表示中 (Escで終了可)" : "ブラウザ全体にWengeを表示します"}</span>
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

      <Fieldset label="Downloads">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Radio checked={dlTarget === "ask"} onChange={() => setDownloadSetting("ask")} name="dl" value="ask" label="毎回保存先を確認する" />
          <Radio checked={dlTarget === "machine"} onChange={() => setDownloadSetting("machine")} name="dl" value="machine" label="常にこの実機にダウンロード" />
          <Radio checked={dlTarget === "wenge"} onChange={() => setDownloadSetting("wenge")} name="dl" value="wenge" label="常にWenge内 (C:\Wenge\Downloads) に保存" />
        </div>
        <div style={{ fontSize: 10, color: "#808080", marginTop: 4 }}>
          Explorer・File Share・デスクトップのファイル保存時に適用されます。
        </div>
      </Fieldset>

      <Fieldset label="System">
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => showInfo("Hardware", "Device Manager\n- WengeChip 133MHz\n- 32MB RAM\n- VGA Display\nAll devices working properly.")}>Hardware</Button>
          <Button onClick={() => showInfo("Network", "Network: WENGE workgroup\nAdapter: NE2000 Compatible\nStatus: Connected (mock)")}>Network</Button>
          <Button onClick={() => showInfo("Password", "Password protected.\nHint: check README (mock).\nChange password is disabled in demo.")}>Password</Button>
        </div>
      </Fieldset>
    </div>
  );
}
