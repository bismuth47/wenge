import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Frame, Select, Separator, TextInput } from "react95";
import { showInfo } from "../components/SystemDialog";
import { ICONS } from "../assets/icons";
import type { VfsFile } from "../lib/vfs/types";

type Props = {
  file?: VfsFile | null;
};

type Phase = "idle" | "loading" | "running" | "error";

const LOADER_URL = "https://cjrtnc.leaningtech.com/4.3/loader.js";

declare global {
  interface Window {
    cheerpjInit?: (opts?: Record<string, unknown>) => Promise<void>;
    cheerpjCreateDisplay?: (w: number, h: number, parent?: HTMLElement) => HTMLElement;
    cheerpjRunJar?: (path: string) => Promise<number>;
    cheerpjRunMain?: (cls: string, classpath: string, args?: string[]) => Promise<number>;
    cheerpOSAddStringFile?: (path: string, content: string | Uint8Array) => void;
  }
}

// cheerpjInitはページ毎に1回だけ。バージョン違いの再初期化は不可のため使い回す。
let initPromise: Promise<{ version: number }> | null = null;
let initVersion = 0;

function ensureLoader(): Promise<void> {
  if (window.cheerpjInit) return Promise.resolve();
  const existing = document.querySelector(`script[data-cheerpj]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load CheerpJ runtime.")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = LOADER_URL;
    s.async = true;
    s.setAttribute("data-cheerpj", "4.3");
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${LOADER_URL} (network or ad-blocker?).`));
    document.head.appendChild(s);
  });
}

function ensureInit(version: number): Promise<void> {
  if (initPromise && initVersion === version) return initPromise.then(() => undefined);
  if (initPromise && initVersion !== version) {
    return Promise.reject(
      new Error(`CheerpJ runtime already started with Java ${initVersion}. Version switch needs a page reload.`)
    );
  }
  initPromise = (async () => {
    await ensureLoader();
    if (!window.cheerpjInit) throw new Error("CheerpJ loader did not expose cheerpjInit.");
    await window.cheerpjInit({ version });
    initVersion = version;
    return { version };
  })();
  return initPromise.then(() => undefined);
}

function sanitizeJarName(name: string): string {
  const base = (name.split("/").pop() || "app.jar").replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.toLowerCase().endsWith(".jar") ? base : `${base}.jar`;
}

async function isZipJar(file: VfsFile): Promise<boolean | null> {
  try {
    const buf = await file.blob.slice(0, 4).arrayBuffer();
    const b = new Uint8Array(buf);
    if (b.length < 4) return null;
    return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
  } catch {
    return null;
  }
}

function formatSize(bytes: number): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function JavaRunnerApp({ file }: Props) {
  const displayParentRef = useRef<HTMLDivElement>(null);
  const filePickRef = useRef<HTMLInputElement>(null);
  const displayElRef = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(11);
  const [mainClass, setMainClass] = useState("");
  const [headerInfo, setHeaderInfo] = useState<string | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);
  const runningRef = useRef(false);

  const activeFile = file ?? null;
  const activeName = activeFile?.name ?? localName ?? "app.jar";

  useEffect(() => {
    let cancelled = false;
    if (!activeFile?.blob) {
      setHeaderInfo(null);
      return;
    }
    isZipJar(activeFile).then((ok) => {
      if (cancelled) return;
      if (ok === true) setHeaderInfo(`ZIP/JAR signature (PK..) confirmed — runnable candidate via CheerpJ.`);
      else if (ok === false) setHeaderInfo(`Not a ZIP/JAR (missing PK signature) — CheerpJ will likely fail.`);
      else setHeaderInfo(null);
    });
    return () => {
      cancelled = true;
    };
  }, [activeFile]);

  // ファイル切替・ unmount時にdisplayだけ掃除 (ランタイム自体は使い回す)
  useEffect(() => {
    return () => {
      try {
        displayElRef.current?.remove();
      } catch {}
      displayElRef.current = null;
    };
  }, []);

  const clearDisplay = useCallback(() => {
    try {
      displayElRef.current?.remove();
    } catch {}
    displayElRef.current = null;
    if (displayParentRef.current) displayParentRef.current.innerHTML = "";
  }, []);

  const run = useCallback(async () => {
    const target = activeFile;
    if (!target?.blob) {
      setError("No JAR file. Drop a .jar onto the Desktop and double-click it, or pick one below.");
      setPhase("error");
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    setPhase("loading");
    setError(null);
    setLog([`> ${target.name}`, `Initializing CheerpJ (Java ${version})...`]);
    try {
      await ensureInit(version);
      setLog((p) => [...p, "Runtime ready. Writing JAR to /str/ ..."]);
      const bytes = new Uint8Array(await target.blob.arrayBuffer());
      if (bytes.length >= 4 && !(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
        throw new Error("Not a JAR/ZIP file (missing PK header). Pick a valid .jar built with `jar` / Gradle / Maven.");
      }
      if (!window.cheerpOSAddStringFile) throw new Error("CheerpJ filesystem API missing (cheerpOSAddStringFile).");
      if (!window.cheerpjCreateDisplay) throw new Error("CheerpJ display API missing (cheerpjCreateDisplay).");
      clearDisplay();
      const vfsPath = `/str/${sanitizeJarName(target.name)}`;
      window.cheerpOSAddStringFile(vfsPath, bytes);
      const parent = displayParentRef.current;
      if (!parent) throw new Error("Display container missing.");
      const el = window.cheerpjCreateDisplay(-1, -1, parent);
      displayElRef.current = el ?? null;
      setPhase("running");
      setLog((p) => [...p, `Launching ${mainClass ? `${mainClass} in ` : ""}${vfsPath} ...`]);
      let exit = 0;
      if (mainClass.trim()) {
        if (!window.cheerpjRunMain) throw new Error("cheerpjRunMain missing.");
        exit = await window.cheerpjRunMain(mainClass.trim(), vfsPath);
      } else {
        if (!window.cheerpjRunJar) throw new Error("cheerpjRunJar missing.");
        exit = await window.cheerpjRunJar(vfsPath);
      }
      setLog((p) => [...p, `Process exited with code ${exit}.`]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setPhase("error");
      setLog((p) => [...p, `Error: ${msg}`]);
    } finally {
      runningRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile, version, mainClass, clearDisplay]);

  const pickLocal = useCallback(async (picked: File | undefined) => {
    if (!picked) return;
    // VFSを介さずその場で実行できるよう、FileをVfsFile互換で保持する代わりに
    // 親へ渡せないため、ローカルBlobを直接cheerpjに流す簡易パスを用意する。
    // ここでは表示名だけ保持し、実体はwindowに一時退避してrun時に使う。
    setLocalName(picked.name);
    (window as unknown as { __wengeJavaLocal?: File }).__wengeJavaLocal = picked;
    setError(null);
    setPhase("idle");
    setLog([`> ${picked.name}`, "Local file staged. Press Run to launch (not saved to VFS)."]);
  }, []);

  // ローカル選択ファイルがあればそれを優先するラッパー
  const runWithLocal: () => void = useCallback(() => {
    const local = (window as unknown as { __wengeJavaLocal?: File }).__wengeJavaLocal;
    if (!activeFile?.blob && local) {
      const pseudo = {
        name: local.name,
        blob: local,
        size: local.size,
      } as unknown as VfsFile;
      // 一時的にactiveFile差し替え相当の処理をインライン実行
      void (async () => {
        if (runningRef.current) return;
        runningRef.current = true;
        setPhase("loading");
        setError(null);
        setLog([`> ${pseudo.name}`, `Initializing CheerpJ (Java ${version})...`]);
        try {
          await ensureInit(version);
          const bytes = new Uint8Array(await pseudo.blob.arrayBuffer());
          if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
            throw new Error("Not a JAR/ZIP file (missing PK header).");
          }
          clearDisplay();
          const vfsPath = `/str/${sanitizeJarName(pseudo.name)}`;
          window.cheerpOSAddStringFile!(vfsPath, bytes);
          const parent = displayParentRef.current!;
          const el = window.cheerpjCreateDisplay!(-1, -1, parent);
          displayElRef.current = el ?? null;
          setPhase("running");
          const exit = mainClass.trim()
            ? await window.cheerpjRunMain!(mainClass.trim(), vfsPath)
            : await window.cheerpjRunJar!(vfsPath);
          setLog((p) => [...p, `Process exited with code ${exit}.`]);
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : String(e));
          setPhase("error");
        } finally {
          runningRef.current = false;
        }
      })();
      return;
    }
    void run();
  }, [activeFile, version, mainClass, clearDisplay, run]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <img
          src={ICONS.fileWindows}
          alt=""
          width={32}
          height={32}
          style={{ imageRendering: "pixelated" as const, flexShrink: 0 }}
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: "bold", wordBreak: "break-all" }}>{activeName}</div>
          <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
            {activeFile ? `${formatSize(activeFile.size)} · ${activeFile.mime || "application/java-archive"}` : "No VFS file mounted"}
          </div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 4, lineHeight: 1.35 }}>
            JARをブラウザ内のJVM (CheerpJ/WASM) で実行します。初回はランタイム取得のため時間がかかります。
          </div>
          {headerInfo && (
            <div style={{ fontSize: 10, color: "#666", marginTop: 6, fontFamily: "monospace", background: "#fff", border: "1px inset #808080", padding: "3px 4px" }}>
              {headerInfo}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11 }}>Java:</span>
        <div style={{ width: 130 }}>
          <Select
            value={version}
            onChange={(e: any) => setVersion(Number(e.target.value))}
            width="100%"
            options={[
              { value: 8, label: "Java 8" },
              { value: 11, label: "Java 11" },
              { value: 17, label: "Java 17 (preview)" },
            ]}
          />
        </div>
        <span style={{ fontSize: 11 }}>Main class (optional):</span>
        <div style={{ flex: 1, minWidth: 140 }}>
          <TextInput value={mainClass} onChange={(e) => setMainClass(e.target.value)} placeholder="com.example.Main" style={{ width: "100%" }} />
        </div>
      </div>

      <Separator />

      <Frame variant="well" style={{ background: "#000", color: "#c0c0c0", padding: 6, overflow: "auto", fontFamily: "monospace", fontSize: 11, minHeight: 60, maxHeight: 110 }}>
        {log.length === 0 ? (
          <div style={{ color: "#808080" }}>Ready. Press Run to execute.</div>
        ) : (
          log.map((l, i) => (
            <div key={i} style={{ whiteSpace: "pre-wrap", lineHeight: 1.35 }}>{l}</div>
          ))
        )}
        {phase === "error" && error && <div style={{ color: "#ff8080", marginTop: 4 }}>Error: {error}</div>}
      </Frame>

      <div
        ref={displayParentRef}
        style={{ flex: 1, minHeight: 220, background: "#fff", border: "2px inset #808080", overflow: "auto", position: "relative" }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ marginRight: "auto" }}>
          <input
            ref={filePickRef}
            type="file"
            accept=".jar,application/java-archive"
            style={{ display: "none" }}
            onChange={(e) => void pickLocal(e.target.files?.[0])}
          />
          <Button size="sm" onClick={() => filePickRef.current?.click()}>
            Pick .jar…
          </Button>
        </span>
        {phase === "loading" ? (
          <Button disabled>Running…</Button>
        ) : (
          <Button onClick={runWithLocal} style={{ fontWeight: "bold" }}>Run</Button>
        )}
        <Button onClick={() => { clearDisplay(); setPhase("idle"); setError(null); }}>Clear display</Button>
        <Button onClick={() => showInfo("Java", "CheerpJ Community build (free for personal/FOSS/eval, credit required).\nJAR runs fully client-side; no server upload.\nRaw TCP multiplayer and native (.dll/.so) code are not supported.")}>About…</Button>
      </div>

      <div style={{ fontSize: 10, color: "#808080", lineHeight: 1.3, borderTop: "1px solid #c0c0c0", paddingTop: 6 }}>
        Powered by CheerpJ (Leaning Technologies, Community License). Drop any <code>.jar</code> onto the Desktop — double-click opens it here.
      </div>
    </div>
  );
}

export function isJavaArchiveName(name: string): boolean {
  return /\.jar$/i.test(name);
}
