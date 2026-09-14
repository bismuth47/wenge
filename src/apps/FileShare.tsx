import { useEffect, useState } from "react";
import { Button, TextInput, Fieldset, ProgressBar } from "react95";
import { ICONS, ICON_FALLBACK } from "../assets/icons";
import { guessMime, listR2, normalizePrefix, r2NameOfKey, uploadToR2, createR2Folder, type R2File } from "../lib/r2";
import { handleDownload } from "../lib/downloadTarget";
import { acquireBusy, releaseBusy } from "../hooks/useAnimatedCursor";

type FileItem = R2File;

export function FileShareApp() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [prefix, setPrefix] = useState("");

  const fetchFiles = async () => {
    setLoading(true);
    try {
      // Folder-aware list; FileShare keeps working with flat prefix filter
      const data = await listR2(prefix);
      const flat = [...data.folders.map((fd) => ({ key: `${normalizePrefix(prefix)}${fd}/`, url: "#", size: 0, uploadedAt: new Date(0).toISOString() })), ...data.files];
      setFiles(flat);
      if (data.note) {
        const raw = localStorage.getItem("wenge_files");
        if (raw && flat.length === 0) setFiles(JSON.parse(raw));
      }
    } catch {
      // local fallback
      const raw = localStorage.getItem("wenge_files");
      if (raw) {
        try { setFiles(JSON.parse(raw)); } catch { setFiles([]); }
      } else {
        setFiles([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // ロード/アップロード中はアニメーション待機カーソル (wait_0..wait_7) を表示
  useEffect(() => {
    const busy = loading || uploading;
    if (busy) acquireBusy();
    return () => { if (busy) releaseBusy(); };
  }, [loading, uploading]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesToUpload = Array.from(e.target.files || []);
    if (filesToUpload.length === 0) return;
    
    setUploading(true);
    setProgress(10);
    try {
      // Pre‑compute all unique intermediate folders across the batch (deduped)
      const folderSet = new Set<string>();
      for (const file of filesToUpload) {
        const filePath = file.webkitRelativePath || file.name;
        const parts = filePath.split('/');
        let cur = prefix;
        for (let i = 0; i < parts.length - 1; i++) {
          cur += parts[i] + '/';
          folderSet.add(cur);
        }
      }
      // Create folders in parallel (ignore errors – they may already exist)
      await Promise.allSettled([...folderSet].map(folderPath => {
        const folderName = folderPath.slice(prefix.length).replace(/^\//, '');
        return createR2Folder(prefix, folderName);
      }));
      
      // Upload all files, preserving full paths
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const filePath = file.webkitRelativePath || file.name;
        const parts = filePath.split('/');
        let fullKey = prefix;
        for (let j = 0; j < parts.length; j++) {
          fullKey += parts[j];
          if (j !== parts.length - 1) fullKey += '/';
        }
        await uploadToR2(fullKey, file);
        setProgress(Math.min(90, 10 + Math.round((i + 1) / filesToUpload.length * 80)));
      }
      await fetchFiles();
      setProgress(100);
    } catch {
      // localStorage mock for demo (only first file for simplicity)
      const mock: FileItem = { key: filesToUpload[0].name, url: URL.createObjectURL(filesToUpload[0]), size: filesToUpload[0].size, uploadedAt: new Date().toISOString() };
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
            <input type="file" onChange={onUpload} style={{ display: "none" }} multiple />
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
                    {f.url === "#" ? (
                      <span style={{ fontSize: 10, color: "#808080" }}>Folder</span>
                    ) : (
                      <Button size="sm" onClick={() => handleDownload({ name: r2NameOfKey(f.key), mime: guessMime(f.key), url: f.url, sourceR2Key: f.key })}>
                        Open
                      </Button>
                    )}
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
