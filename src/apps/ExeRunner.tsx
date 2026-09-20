import { useEffect, useState } from "react";
import { Button, Frame, ProgressBar, Separator } from "react95";
import { showError, showInfo } from "../components/SystemDialog";
import { ICONS } from "../assets/icons";
import type { VfsFile } from "../lib/vfs/types";
import { RUN_ALIASES } from "./RunDialog";
import { DosPlayer, isDosExecutable } from "./DosPlayer";

type Props = {
  file?: VfsFile | null;
  onLaunchApp?: (appId: string) => void;
};

function resolveAlias(name: string): string | null {
  const lower = name.trim().toLowerCase();
  // direct match
  if ((RUN_ALIASES as Record<string, string>)[lower]) return (RUN_ALIASES as Record<string, string>)[lower];
  const base = lower.replace(/\.(exe|com|scr|pif|msi)$/, "");
  if ((RUN_ALIASES as Record<string, string>)[base]) return (RUN_ALIASES as Record<string, string>)[base];
  if ((RUN_ALIASES as Record<string, string>)[`${base}.exe`]) return (RUN_ALIASES as Record<string, string>)[`${base}.exe`];
  return null;
}

function formatSize(bytes: number): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ExeRunnerApp({ file, onLaunchApp }: Props) {
  const fileName = file?.name ?? "program.exe";
  const alias = resolveAlias(fileName);
  const lower = fileName.toLowerCase();
  const isSetup = /^(setup|install|installer).*\.exe$/i.test(fileName) || lower === "setup.exe";
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "dos">("idle");
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [headerInfo, setHeaderInfo] = useState<string | null>(null);
  const [isDos, setIsDos] = useState<boolean | null>(null);

  // Peek PE header for realism + DOS vs PE classification
  useEffect(() => {
    if (!file?.blob) {
      if (alias) setHeaderInfo(`Known Wenge program → ${alias}`);
      else if (isSetup) setHeaderInfo("Installer executable");
      else setHeaderInfo("Windows executable (PE)");
      setIsDos(null);
      return;
    }
    let cancelled = false;
    // Fast MZ check + full PE check
    file.blob.slice(0, 8192).arrayBuffer().then(async (buf) => {
      if (cancelled) return;
      const b = new Uint8Array(buf);
      const isMz = b.length >= 2 && b[0] === 0x4d && b[1] === 0x5a;
      if (!isMz) {
        if (file.blob.type === "application/x-msdownload" || /\.(exe|com)$/i.test(file.name)) {
          setHeaderInfo(`Extension indicates executable · ${alias ? `maps to "${alias}"` : "unknown program"}`);
        } else {
          setHeaderInfo("Not a recognized executable format");
        }
        setIsDos(false);
        return;
      }
      // Check PE header via e_lfanew
      let isPe = false;
      if (b.length >= 0x40) {
        const e_lfanew = b[0x3c] | (b[0x3d] << 8) | (b[0x3e] << 16) | (b[0x3f] << 24);
        if (e_lfanew > 0 && e_lfanew + 6 <= b.length) {
          isPe = b[e_lfanew] === 0x50 && b[e_lfanew + 1] === 0x45 && b[e_lfanew + 2] === 0 && b[e_lfanew + 3] === 0;
        } else if (e_lfanew + 6 > b.length) {
          // need larger slice
          try {
            isPe = !(await isDosExecutable(file as VfsFile));
          } catch { isPe = true; }
        }
      }
      if (isPe) {
        if (alias) setHeaderInfo(`Valid PE executable · maps to "${alias}"`);
        else setHeaderInfo("Valid Win32 PE executable (MZ+PE header) — requires Wine, shows simulation");
        setIsDos(false);
      } else {
        setHeaderInfo(alias ? `Valid DOS executable · maps to "${alias}"` : "Valid DOS executable (MZ, no PE) — runnable in DOSBox");
        setIsDos(true);
      }
    }).catch(() => {
      setHeaderInfo(alias ? `Known program → ${alias}` : "Executable");
      setIsDos(null);
    });
    return () => { cancelled = true; };
  }, [file, alias, isSetup]);

  const run = async () => {
    // Known Wenge internal program: delegate to real app window
    if (alias && onLaunchApp) {
      setLog([`> ${fileName}`, `Resolving alias: ${fileName} → ${alias}`, `Launching ${alias}...`]);
      setPhase("running");
      setProgress(30);
      // tiny delay for realism
      await new Promise((r) => setTimeout(r, 420));
      setProgress(100);
      setPhase("done");
      setTimeout(() => {
        onLaunchApp(alias);
      }, 250);
      return;
    }
    if (alias && !onLaunchApp) {
      showInfo("Execute", `${fileName} maps to "${alias}" but launcher is not available.`);
      return;
    }

    // Pure DOS exe -> launch real DOSBox via js-dos
    if (isDos && file?.blob) {
      setPhase("dos");
      return;
    }

    // Generic exe: simulated execution with progress
    setPhase("running");
    setProgress(0);
    const steps: Array<{ p: number; msg: string; delay: number }> = isSetup
      ? [
          { p: 10, msg: `> ${fileName}`, delay: 120 },
          { p: 20, msg: "Checking system requirements...", delay: 500 },
          { p: 35, msg: "Preparing installer...", delay: 600 },
          { p: 55, msg: "Copying files...", delay: 700 },
          { p: 75, msg: "Updating registry...", delay: 600 },
          { p: 90, msg: "Finishing installation...", delay: 600 },
          { p: 100, msg: "Installation completed successfully.", delay: 300 },
        ]
      : [
          { p: 15, msg: `> ${fileName}`, delay: 120 },
          { p: 30, msg: `Loading ${fileName}...`, delay: 450 },
          { p: 55, msg: headerInfo ?? "Validating executable...", delay: 550 },
          { p: 80, msg: "Starting program...", delay: 500 },
          { p: 100, msg: "Program is now running.", delay: 300 },
        ];

    let curLog: string[] = [];
    for (const s of steps) {
      await new Promise((r) => setTimeout(r, s.delay));
      curLog = [...curLog, s.msg];
      setLog([...curLog]);
      setProgress(s.p);
    }

    // For generic unknown exe, decide outcome: most Windows PE won't run in browser,
    // so show a Wenge-emulated completion dialog rather than hard error.
    setPhase("done");
    if (!isSetup) {
      // optional: offer to keep running illusion
    }
  };

  const cancel = () => {
    if (phase === "running") {
      showError(fileName, "The program could not be terminated.\nIt is still running.");
      return;
    }
  };

  const blobSize = file?.size ?? 0;
  const mime = file?.mime ?? "application/x-msdownload";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <img src={ICONS.fileWindows} alt="" width={32} height={32} style={{ imageRendering: "pixelated" as const, flexShrink: 0 }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: "bold", wordBreak: "break-all" }}>{fileName}</div>
          <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
            {formatSize(blobSize)} · {mime}
          </div>
          <div style={{ fontSize: 11, color: alias ? "#000080" : "#555", marginTop: 4, lineHeight: 1.35 }}>
            {alias ? (
              <>
                This executable is a built-in Wenge program. Click <b>Run</b> to launch <b>{alias}</b>.
              </>
            ) : isDos ? (
              <>DOS program detected — click <b>Run</b> to launch it in DOSBox (js-dos). Pure DOS MZ files run for real; Win32 PE files are only simulated.</>
            ) : isSetup ? (
              <>Setup program — click <b>Run</b> to start the simulated installer.</>
            ) : (
              <>Windows executable. Wenge will try to run it in emulated mode. Native Win32 PE binaries cannot run directly in the browser — a simulated execution will be shown. Drop a DOS <code>.exe</code>/.<code>com</code> for real execution.</>
            )}
          </div>
          {headerInfo && (
            <div style={{ fontSize: 10, color: "#666", marginTop: 6, fontFamily: "monospace", background: "#fff", border: "1px inset #808080", padding: "3px 4px" }}>
              {headerInfo}
            </div>
          )}
        </div>
      </div>

      <Separator />

      {phase === "dos" && file ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <DosPlayer file={file as VfsFile} onExit={() => setPhase("idle")} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
            <Button onClick={() => setPhase("idle")}>Close DOSBox</Button>
          </div>
        </div>
      ) : (
        <>
          <Frame variant="well" style={{ flex: 1, background: "#000", color: "#c0c0c0", padding: 6, overflow: "auto", fontFamily: "monospace", fontSize: 11, minHeight: 84 }}>
            {log.length === 0 ? (
              <div style={{ color: "#808080" }}>Ready. Press Run to execute.</div>
            ) : (
              log.map((l, i) => (
                <div key={i} style={{ whiteSpace: "pre-wrap", lineHeight: 1.35 }}>{l}</div>
              ))
            )}
            {phase === "running" && <div style={{ marginTop: 6 }}><ProgressBar value={progress} /></div>}
            {phase === "done" && (
              <div style={{ marginTop: 6, color: alias ? "#00ff99" : isSetup ? "#00ff99" : "#ffd700" }}>
                {alias ? `✓ Launched ${alias}` : isSetup ? "✓ Setup finished." : "✓ Execution finished (emulated)."}
              </div>
            )}
          </Frame>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center" }}>
            {phase === "running" ? (
              <>
                <span style={{ fontSize: 11, color: "#555", marginRight: "auto" }}>{progress}%</span>
                <Button disabled>Run</Button>
                <Button onClick={cancel}>Cancel</Button>
              </>
            ) : phase === "done" ? (
              <>
                <Button onClick={() => { setPhase("idle"); setProgress(0); setLog([]); }}>Run Again</Button>
                <Button onClick={() => showInfo(fileName, alias ? `Program "${alias}" launched.` : isSetup ? "Setup completed.\nRestart is not required." : isDos ? "DOS execution finished. Win32 PE would need Wine and is only simulated." : "Emulated execution completed.\nThis was a simulated run — native Win32 PE code is not executed in Wenge.\nDrop a pure DOS .exe/.com for real DOSBox execution.")}>Details…</Button>
              </>
            ) : (
              <>
                <Button onClick={run} style={{ fontWeight: "bold" }}>Run{isDos ? " in DOSBox" : ""}</Button>
                <Button onClick={() => showInfo("Properties", `File: ${fileName}\nSize: ${formatSize(blobSize)}\nType: ${mime}\n${headerInfo ?? ""}\nDOS runnable: ${isDos ? "yes (js-dos)" : isDos === false ? "no (Win32 PE)" : "unknown"}`)}>Properties…</Button>
                <Button onClick={cancel}>Cancel</Button>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ fontSize: 10, color: "#808080", lineHeight: 1.3, borderTop: "1px solid #c0c0c0", paddingTop: 6 }}>
        Hint: Drop any <code>.exe</code> / <code>.com</code> from your OS or R2 onto the Desktop — double-click will open it here. Pure DOS MZ files run for real in DOSBox (js-dos); Win32 PE is simulated and known names (notepad.exe, calc.exe, winmine.exe, etc.) launch their Wenge app directly.
      </div>
    </div>
  );
}
