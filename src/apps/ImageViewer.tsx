import { useEffect, useMemo, useState } from "react";
import { Button, Frame } from "react95";
import { consumePendingVfsFile } from "../lib/vfs/openWith";
import { downloadVfsFileToMachine } from "../lib/vfs/store";
import type { VfsFile } from "../lib/vfs/types";

type Props = { file?: VfsFile | null };

export function ImageViewerApp({ file }: Props) {
  const [pending, setPending] = useState<VfsFile | null>(null);
  const [zoom, setZoom] = useState(100);
  useEffect(() => {
    if (file) return;
    const p = consumePendingVfsFile();
    if (p) setPending(p);
  }, [file]);
  const active = file ?? pending;
  const url = useMemo(() => {
    if (!active?.blob) return null;
    return URL.createObjectURL(active.blob);
  }, [active]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  if (!active || !url) {
    return <div style={{ fontSize: 11 }}>No image. Double-click an image on the Desktop to open it here.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        <Button size="sm" onClick={() => setZoom((z) => Math.max(25, z - 25))}>−</Button>
        <span style={{ fontSize: 11, minWidth: 44, textAlign: "center" }}>{zoom}%</span>
        <Button size="sm" onClick={() => setZoom((z) => Math.min(400, z + 25))}>＋</Button>
        <Button size="sm" onClick={() => setZoom(100)}>Actual</Button>
        <Button size="sm" onClick={() => downloadVfsFileToMachine(active)}>Save to machine...</Button>
        <span style={{ fontSize: 11, color: "#555", marginLeft: "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{active.name}</span>
      </div>
      <Frame variant="well" style={{ background: "#808080", padding: 8, overflow: "auto", maxHeight: 380, display: "grid", placeItems: "center" }}>
        <img
          src={url}
          alt={active.name}
          style={{ width: `${zoom}%`, maxWidth: zoom <= 100 ? "100%" : undefined, imageRendering: zoom >= 200 ? "pixelated" : "auto", background: "#fff", border: "1px solid #000" }}
          draggable={false}
        />
      </Frame>
      <div style={{ fontSize: 10, color: "#808080" }}>{active.mime || "image"} · {((active.size || 0) / 1024).toFixed(1)} KB</div>
    </div>
  );
}
