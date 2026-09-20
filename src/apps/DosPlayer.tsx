import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import type { VfsFile } from "../lib/vfs/types";

/**
 * Minimal DOSBox runner using js-dos (https://js-dos.com).
 * - For pure DOS MZ executables (no PE header) we create an on-the-fly .jsdos bundle
 *   containing the exe + autoexec and hand it to `Dos()` from js-dos.
 * - PE (Win32) files are NOT runnable here – caller should gate with isDosExecutable.
 * Requires `public/emulators/*` (copied from js-dos/dist/emulators).
 */
export function DosPlayer({ file, onExit }: { file: VfsFile; onExit?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"preparing" | "ready" | "error">("preparing");
  const [error, setError] = useState<string | null>(null);
  const bundleUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanupDos: (() => void) | null = null;

    const run = async () => {
      if (!containerRef.current) return;
      setStatus("preparing");
      setError(null);
      try {
        // Load js-dos CSS/JS as static assets (copied to public/ at build time)
        // This avoids Vite bundling the UMD bundle and keeps the emulator out of the main chunk.
        const ensureJsDos = async () => {
          if ((window as any).Dos) return;
          // CSS
          if (!document.querySelector('link[href="/js-dos.css"]')) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "/js-dos.css";
            document.head.appendChild(link);
          }
          // JS
          await new Promise<void>((resolve, reject) => {
            if ((window as any).Dos) return resolve();
            const s = document.createElement("script");
            s.src = "/js-dos.js";
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Failed to load /js-dos.js"));
            document.head.appendChild(s);
          });
        };
        await ensureJsDos();
        if (cancelled) return;

        const DosGlobal: any = (window as any).Dos;
        if (!DosGlobal) throw new Error("js-dos failed to load (window.Dos missing).");

        // Build a minimal .jsdos bundle zip in memory
        // Structure: dosbox.conf + exe at root. js-dos 8 prefers Bundle v2 JSON but legacy zip auto-detect works.
        const zip = new JSZip();
        const exeName = file.name || "program.exe";
        // sanitize: dos 8.3 name fallback if needed, but keep original for display
        const dosName = exeName.replace(/[^a-zA-Z0-9._-]/g, "_");
        zip.file(dosName, file.blob);

        // dosbox.conf that auto-runs the exe
        const conf = `[sdl]
autolock=false
[cpu]
core=auto
cputype=auto
cycles=max
[dosbox]
memsize=16
[autoexec]
@echo off
mount c .
c:
${dosName}
`;
        zip.file("dosbox.conf", conf);

        // Also add .jsdos/config.json for js-dos 8 bundle API (optional, helps with autoexec)
        // Keep minimal; omit to rely on dosbox.conf.
        const bundleBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(bundleBlob);
        bundleUrlRef.current = url;
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        setStatus("ready");
        // Clear previous content
        containerRef.current!.innerHTML = "";
        // js-dos 8 API: Dos(element, { url: bundleUrl }) returns a promise with api
        const api = await DosGlobal(containerRef.current, {
          url,
          // point to our copied emulators; default is "/emulators" which matches public/emulators
          pathPrefix: "/emulators/",
          // smaller UI
          theme: "light",
        });
        if (cancelled) {
          try {
            api?.exit?.();
          } catch {}
          return;
        }
        cleanupDos = () => {
          try {
            api?.exit?.();
          } catch {}
          if (bundleUrlRef.current) {
            URL.revokeObjectURL(bundleUrlRef.current);
            bundleUrlRef.current = null;
          }
        };
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || String(e));
          setStatus("error");
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      try {
        cleanupDos?.();
      } catch {}
      if (bundleUrlRef.current) {
        URL.revokeObjectURL(bundleUrlRef.current);
        bundleUrlRef.current = null;
      }
      if (containerRef.current) containerRef.current.innerHTML = "";
      onExit?.();
    };
  }, [file, onExit]);

  if (status === "error") {
    return (
      <div style={{ padding: 12, fontSize: 11, color: "#800" }}>
        DOSBox failed: {error}
        <div style={{ marginTop: 6, color: "#555" }}>This file may not be a pure DOS program (Win32 PE requires Wine).</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: 4 }}>
      {status === "preparing" && (
        <div style={{ fontSize: 11, padding: "4px 6px", background: "#ffffe1", border: "1px solid #808080" }}>
          Preparing DOSBox bundle for {file.name}…
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 240,
          background: "#000",
          border: "2px inset #808080",
          overflow: "hidden",
          position: "relative",
        }}
      />
      <div style={{ fontSize: 10, color: "#666", padding: "2px 4px" }}>
        js-dos 8 · DOSBox · Press Ctrl+F9 to exit · Files are not persisted
      </div>
    </div>
  );
}

/** Quick PE vs DOS check: true if MZ but no PE signature -> runnable in DOSBox */
export async function isDosExecutable(file: VfsFile): Promise<boolean> {
  try {
    const buf = await file.blob.slice(0, 8192).arrayBuffer();
    const b = new Uint8Array(buf);
    if (b.length < 2 || b[0] !== 0x4d || b[1] !== 0x5a) return false;
    if (b.length < 0x40) return true; // tiny MZ, assume DOS
    const e_lfanew = b[0x3c] | (b[0x3d] << 8) | (b[0x3e] << 16) | (b[0x3f] << 24);
    if (e_lfanew <= 0 || e_lfanew + 6 > b.length) {
      // Need more bytes to verify; fetch larger slice if truncated
      if (e_lfanew + 6 > buf.byteLength) {
        const full = await file.blob.slice(0, e_lfanew + 6).arrayBuffer();
        const fb = new Uint8Array(full);
        if (fb.length < e_lfanew + 6) return true;
        return !(fb[e_lfanew] === 0x50 && fb[e_lfanew + 1] === 0x45 && fb[e_lfanew + 2] === 0 && fb[e_lfanew + 3] === 0);
      }
      return true;
    }
    const isPe = b[e_lfanew] === 0x50 && b[e_lfanew + 1] === 0x45 && b[e_lfanew + 2] === 0 && b[e_lfanew + 3] === 0;
    return !isPe;
  } catch {
    return false;
  }
}
