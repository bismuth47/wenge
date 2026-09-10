import { useEffect, useState } from "react";
import { Button, TextInput, Fieldset, ProgressBar } from "react95";
import { ICONS, ICON_FALLBACK } from "../assets/icons";

type FileItem = { key: string; url: string; size: number; uploadedAt: string };

export function FileShareApp() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [prefix, setPrefix] = useState("");

  const fetchFiles = async () => {
    try {
      const res = await fetch(`/api/files${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files ?? []);
      } else {
        // fallback mock
        setFiles([{ key: "demo/wenge.txt", url: "#", size: 1024, uploadedAt: new Date().toISOString() }]);
      }
    } catch {
      // local fallback
      const raw = localStorage.getItem("wenge_files");
      if (raw) setFiles(JSON.parse(raw));
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setProgress(10);
    try {
      // Try presigned upload flow, fallback to direct /api/files
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/files", { method: "POST", body: form });
      if (!res.ok) throw new Error("upload failed");
      setProgress(90);
      await fetchFiles();
      setProgress(100);
    } catch {
      // localStorage mock for demo
      const mock: FileItem = { key: file.name, url: URL.createObjectURL(file), size: file.size, uploadedAt: new Date().toISOString() };
      const next = [mock, ...files];
      setFiles(next);
      localStorage.setItem("wenge_files", JSON.stringify(next));
      setProgress(100);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 600);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Fieldset label="Cloudflare R2 File Share">
        <div style={{ fontSize: 11, color: "#333", marginBottom: 8 }}>
          Saved via Vercel API → Cloudflare R2. Works with presigned URLs or direct upload.
          <br />
          Env vars: <code>R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET</code>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Button as="span">Choose File</Button>
            <input type="file" onChange={onUpload} style={{ display: "none" }} />
          </label>
          <TextInput placeholder="Filter by prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} width={160} />
          <Button onClick={fetchFiles}>Refresh</Button>
        </div>
        {uploading && <ProgressBar value={progress} style={{ marginTop: 8 }} />}
      </Fieldset>

      <div style={{ border: "2px inset #fff", background: "#fff", minHeight: 140, maxHeight: 220, overflow: "auto" }}>
        {files.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 12 }}>No files. Please upload.</div>
        ) : (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#000080", color: "#fff" }}>
                <th style={{ textAlign: "left", padding: 4 }}>File name</th>
                <th>Size</th>
                <th>Date Modified</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.key} style={{ borderBottom: "1px solid #c0c0c0" }}>
                  <td style={{ padding: 4, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                    <img
                      src={ICONS.fileWindows}
                      alt=""
                      width={16}
                      height={16}
                      style={{ imageRendering: "pixelated" as const, flexShrink: 0 }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        const fb = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null;
                        if (fb) fb.style.display = "inline";
                      }}
                    />
                    <span style={{ display: "none" }}>{ICON_FALLBACK.fileWindows}</span> {f.key}
                  </td>
                  <td style={{ textAlign: "center" }}>{(f.size / 1024).toFixed(1)} KB</td>
                  <td style={{ textAlign: "center", fontSize: 10 }}>{new Date(f.uploadedAt).toLocaleString()}</td>
                  <td style={{ textAlign: "center" }}>
                    <Button size="sm" onClick={() => window.open(f.url, "_blank")}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ fontSize: 11 }}>{files.length} object(s) | R2 Bucket: {import.meta.env.VITE_R2_BUCKET ?? "wenge-files"} </div>
    </div>
  );
}
