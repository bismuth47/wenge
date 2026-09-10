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
        <Button size="sm">◀ Back</Button>
        <Button size="sm">▶ Forward</Button>
        <Button size="sm" onClick={navigate}>
          Refresh
        </Button>
        <Button size="sm" onClick={navigate}>
          Stop
        </Button>
        <TextInput value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} />
        <Button onClick={navigate}>Go</Button>
      </div>
      {loading && <ProgressBar value={60} />}
      <Fieldset label="Wenge Internet Explorer">
        <div style={{ background: "#fff", border: "2px inset", padding: 12, minHeight: 180 }}>
          <h3 style={{ margin: "0 0 8px", color: "#000080", display: "flex", alignItems: "center", gap: 6 }}>
            <img src={ICONS.ie} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
            Welcome to Wenge Network!
          </h3>
          <p style={{ fontSize: 12, lineHeight: 1.6 }}>
            This browser recreates the Netscape / IE3 era of Windows 95.
            <br />
            Current URL: <Anchor href="#">{url}</Anchor>
          </p>
          <ul style={{ fontSize: 12 }}>
            {history.map((h) => (
              <li key={h}>
                <Anchor onClick={() => setUrl(h)}>{h}</Anchor>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <Button>Add to Favorites</Button>
            <Button>View Source</Button>
          </div>
        </div>
      </Fieldset>
      <div style={{ fontSize: 11, background: "#c0c0c0", border: "2px inset", padding: "2px 6px" }}>Document done</div>
    </div>
  );
}
