import { Button, Fieldset, ProgressBar, Select } from "react95";

export function MyComputerApp() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Fieldset label="ドライブ">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "C: (Wenge)", icon: "💾", free: 78 },
            { label: "A: フロッピー", icon: "💿", free: 32 },
            { label: "D: CD-ROM", icon: "📀", free: 0 },
          ].map((d) => (
            <div key={d.label} style={{ textAlign: "center", width: 90 }}>
              <div style={{ fontSize: 32 }}>{d.icon}</div>
              <div style={{ fontSize: 11 }}>{d.label}</div>
              <ProgressBar value={d.free} style={{ height: 8, marginTop: 4 }} />
              <div style={{ fontSize: 10 }}>{d.free}% 空き</div>
            </div>
          ))}
        </div>
      </Fieldset>
      <Fieldset label="システム情報">
        <div style={{ fontSize: 12, lineHeight: "1.6" }}>
          <div>OS: Wenge 95 ver 4.0.950</div>
          <div>CPU: WengeChip 133MHz</div>
          <div>メモリ: 32MB RAM</div>
          <div>解像度: 800x600 256色</div>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <Button>プロパティ</Button>
          <Select defaultValue="詳細" options={[{ value: "詳細", label: "詳細" }, { value: "簡易", label: "簡易" }]} width={100} />
        </div>
      </Fieldset>
    </div>
  );
}
