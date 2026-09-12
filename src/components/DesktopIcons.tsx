import { useEffect, useMemo, useState } from "react";
import { Button, TextInput } from "react95";
import { ICONS } from "../assets/icons";
import { showError } from "./SystemDialog";
import { saveUrlToVfs } from "../lib/vfs/download";
import { useVfsDirectory } from "../lib/vfs/store";
import { VFS_DESKTOP, VFS_DOCUMENTS, VFS_DOWNLOADS } from "../lib/vfs/types";
import { vfsOpenTarget } from "../lib/vfs/openWith";

const DIRS = [VFS_DESKTOP, VFS_DOCUMENTS, VFS_DOWNLOADS] as const;

function iconFor(mime: string, name: string): string {
  const t = vfsOpenTarget({ mime, name } as never);
  if (t === "image-viewer") return ICONS.paint;
  if (t === "media-player") return ICONS.mediaPlayer;
  if (t === "notepad" || t === "wordpad") return ICONS.notepad;
  return ICONS.fileWindows;
}

/**
 * Sample component: VFS-backed file list + save-from-URL box.
 * Desktop itself uses useVfsDirectory("C:/Desktop") the same way —
 * see App.tsx desktopDocs section.
 */
export function DesktopIcons({ onOpen }: { onOpen?: (fileId: string, target: string) => void }) {
  const [dir, setDir] = useState<string>(VFS_DESKTOP);
  const { files, loading, refresh } = useVfsDirectory(dir);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const count = useMemo(() => files.length, [files]);

  useEffect(() => { refresh(); }, [dir, refresh]);

  const save = async () => {
    const u = url.trim();
    if (!u) return;
    setSaving(true);
    try {
      await saveUrlToVfs(u, dir);
      setUrl("");
    } catch (e: any) {
      showError("VFS", e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {DIRS.map((d) => (
          <Button key={d} size="sm" active={dir === d} onClick={() => setDir(d)}>{d}</Button>
        ))}
        <span style={{ fontSize: 11, marginLeft: "auto" }}>{loading ? "Loading..." : `${count} file(s)`}</span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <TextInput value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} placeholder="https://example.com/file.png → Save to VFS" style={{ flex: 1 }} />
        <Button size="sm" onClick={save} disabled={saving || !url.trim()}>{saving ? "..." : "Save"}</Button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxHeight: 220, overflow: "auto", background: "#fff", border: "2px inset #fff", padding: 6 }}>
        {files.map((f) => (
          <div
            key={f.id}
            onDoubleClick={() => onOpen?.(f.id, vfsOpenTarget(f))}
            title={`${f.path}\nDouble-click to open (${vfsOpenTarget(f)})`}
            style={{ width: 76, textAlign: "center", cursor: "pointer", fontSize: 10 }}
          >
            <img src={iconFor(f.mime, f.name)} alt="" width={28} height={28} style={{ imageRendering: "pixelated" as const }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
            <div style={{ wordBreak: "break-word", lineHeight: 1.2 }}>{f.name}</div>
          </div>
        ))}
        {!loading && files.length === 0 && <div style={{ fontSize: 11, color: "#808080" }}>Empty. Paste a URL above and Save.</div>}
      </div>
    </div>
  );
}
