import { useState } from "react";
import { Button, TextInput, Fieldset, ProgressBar, Anchor } from "react95";
import { ICONS } from "../assets/icons";

export function InternetExplorerApp() {
  const [url, setUrl] = useState("http://www.wenge.co.jp/");
  const [loading, setLoading] = useState(false);
  const [history] = useState(["http://www.wenge.co.jp/", "http://www.microsoft.com/windows95/"]);

  const navigate = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1200);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <Button size="sm">◀ 戻る</Button>
        <Button size="sm">▶ 進む</Button>
        <Button size="sm" onClick={navigate}>
          更新
        </Button>
        <Button size="sm" onClick={navigate}>
          中止
        </Button>
        <TextInput value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} />
        <Button onClick={navigate}>移動</Button>
      </div>
      {loading && <ProgressBar value={60} />}
      <Fieldset label="Wenge Internet Explorer">
        <div style={{ background: "#fff", border: "2px inset", padding: 12, minHeight: 180 }}>
          <h3 style={{ margin: "0 0 8px", color: "#000080", display: "flex", alignItems: "center", gap: 6 }}>
            <img src={ICONS.ie} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
            Wenge ネットワークへようこそ！
          </h3>
          <p style={{ fontSize: 12, lineHeight: 1.6 }}>
            このブラウザは Windows 95 時代の Netscape / IE3 を再現しています。
            <br />
            現在のURL: <Anchor href="#">{url}</Anchor>
          </p>
          <ul style={{ fontSize: 12 }}>
            {history.map((h) => (
              <li key={h}>
                <Anchor onClick={() => setUrl(h)}>{h}</Anchor>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <Button>お気に入りに追加</Button>
            <Button>ソース表示</Button>
          </div>
        </div>
      </Fieldset>
      <div style={{ fontSize: 11, background: "#c0c0c0", border: "2px inset", padding: "2px 6px" }}>ドキュメントの読み込みが完了しました</div>
    </div>
  );
}
