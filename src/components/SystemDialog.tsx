import { useState, useEffect } from "react";
import styled from "styled-components";
import { Button, Checkbox, Radio, Window, WindowHeader, WindowContent } from "react95";
import { CloseGlyph } from "./CaptionGlyphs";

export type SystemDialogKind = "error" | "confirm" | "info" | "download-choice";

export type DownloadChoice = { target: "machine" | "wenge"; remember: boolean };

export type SystemDialogRequest = {
  id: number;
  kind: SystemDialogKind;
  title: string;
  message: string;
  okLabel?: string;
  cancelLabel?: string;
  /** resolved with true=OK/confirmed, false=cancelled */
  resolve: (ok: boolean) => void;
  /** file name shown in the download destination dialog */
  fileName?: string;
  /** resolves the download destination dialog (null = cancelled) */
  resolveChoice?: (c: DownloadChoice | null) => void;
};

// --- module-level queue so any code (even outside React) can raise dialogs ---
let nextId = 1;
const listeners = new Set<(reqs: SystemDialogRequest[]) => void>();
let queue: SystemDialogRequest[] = [];

function emit() {
  const snap = [...queue];
  listeners.forEach((fn) => {
    try { fn(snap); } catch {}
  });
}

function pushDialog(kind: SystemDialogKind, title: string, message: string, okLabel?: string, cancelLabel?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req: SystemDialogRequest = { id: nextId++, kind, title, message, okLabel, cancelLabel, resolve };
    queue = [...queue, req];
    emit();
  });
}

function settle(id: number, ok: boolean) {
  const found = queue.find((q) => q.id === id);
  queue = queue.filter((q) => q.id !== id);
  emit();
  try { found?.resolve(ok); } catch {}
}

function settleChoice(id: number, choice: DownloadChoice | null) {
  const found = queue.find((q) => q.id === id);
  queue = queue.filter((q) => q.id !== id);
  emit();
  try { found?.resolveChoice?.(choice); } catch {}
  try { found?.resolve(choice !== null); } catch {}
}

/** Win95-style modal error popup inside the OS (with error sound). */
export function showError(title: string, message: string, okLabel = "OK"): Promise<boolean> {
  return pushDialog("error", title, message, okLabel);
}
/** Win95-style modal confirm popup inside the OS. */
export function showConfirm(title: string, message: string, okLabel = "OK", cancelLabel = "Cancel"): Promise<boolean> {
  return pushDialog("confirm", title, message, okLabel, cancelLabel);
}
/** Win95-style modal info popup inside the OS. */
export function showInfo(title: string, message: string, okLabel = "OK"): Promise<boolean> {
  return pushDialog("info", title, message, okLabel);
}
/**
 * Download destination dialog: real machine vs inside Wenge.
 * Resolves with the choice (null when cancelled).
 */
export function showDownloadChoice(fileName: string): Promise<DownloadChoice | null> {
  return new Promise((resolveChoice) => {
    const req: SystemDialogRequest = {
      id: nextId++,
      kind: "download-choice",
      title: "Download",
      message: `Where do you want to save '${fileName}'?`,
      resolve: () => {},
      fileName,
      resolveChoice,
    };
    queue = [...queue, req];
    emit();
  });
}

export function useSystemDialogs(): SystemDialogRequest[] {
  const [reqs, setReqs] = useState<SystemDialogRequest[]>(() => [...queue]);
  useEffect(() => {
    const fn = (snap: SystemDialogRequest[]) => setReqs(snap);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return reqs;
}

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 12000;
  display: grid;
  place-items: center;
  padding: 16px;
  box-sizing: border-box;
`;

const DialogWindow = styled(Window)`
  width: min(380px, calc(100vw - 32px));
  cursor: url('/cursors/arrow.png') 0 0, default;
`;

const IconGlyph = styled.span<{ $kind: SystemDialogKind }>`
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  background: ${(p) => (p.$kind === "error" ? "#c00000" : p.$kind === "confirm" || p.$kind === "download-choice" ? "#000080" : "#007000")};
  border: 2px solid #fff;
  outline: 1px solid #000;
`;

function DownloadChoiceBody({ req }: { req: SystemDialogRequest }) {
  const [target, setTarget] = useState<"machine" | "wenge">("machine");
  const [remember, setRemember] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") settleChoice(req.id, { target, remember });
      if (e.key === "Escape") settleChoice(req.id, null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req.id, target, remember]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-line" }}>{req.message}</div>
      <Radio checked={target === "machine"} onChange={() => setTarget("machine")} value="machine" name={`dl-${req.id}`} label="この実機にダウンロード" />
      <Radio checked={target === "wenge"} onChange={() => setTarget("wenge")} value="wenge" name={`dl-${req.id}`} label="Wenge内 (C:\Wenge\Downloads) に保存" />
      <Checkbox checked={remember} onChange={() => setRemember((v) => !v)} value="remember" label="次回から表示しない" />
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 6 }}>
        <Button style={{ minWidth: 88 }} onClick={() => settleChoice(req.id, { target, remember })}>OK</Button>
        <Button style={{ minWidth: 88 }} onClick={() => settleChoice(req.id, null)}>Cancel</Button>
      </div>
    </div>
  );
}

export function SystemDialogs() {
  const reqs = useSystemDialogs();
  const top = reqs[0];
  useEffect(() => {
    if (!top) return;
    if (top.kind !== "error") return;
    try {
      const a = new Audio("/sounds/Critical Stop.wav");
      a.volume = 0.5;
      a.play().catch(() => {});
    } catch {}
  }, [top?.id]);
  useEffect(() => {
    if (!top) return;
    const onKey = (e: KeyboardEvent) => {
      // download-choice has its own Enter/Escape handling (respects the radio selection)
      if (top.kind === "download-choice") return;
      if (e.key === "Enter") settle(top.id, true);
      if (e.key === "Escape" && top.kind !== "error") settle(top.id, false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top]);
  if (!top) return null;
  const cancelTop = () => {
    if (top.kind === "download-choice") settleChoice(top.id, null);
    else settle(top.id, false);
  };
  return (
    <Overlay data-system-dialog onMouseDown={(e) => { if (e.target === e.currentTarget && top.kind !== "error") cancelTop(); }}>
      <DialogWindow>
        <WindowHeader style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{top.title}</span>
          {top.kind !== "error" && (
            <Button square size="sm" onClick={cancelTop} title="閉じる">
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <CloseGlyph size={10} />
              </span>
            </Button>
          )}
        </WindowHeader>
        <WindowContent>
          {top.kind === "download-choice" ? (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <IconGlyph $kind={top.kind}>↓</IconGlyph>
              <div style={{ flex: 1 }}><DownloadChoiceBody key={top.id} req={top} /></div>
            </div>
          ) : (
          <>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <IconGlyph $kind={top.kind}>
              {top.kind === "error" ? "×" : top.kind === "confirm" ? "?" : "i"}
            </IconGlyph>
            <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-line", flex: 1 }}>{top.message}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
            <Button style={{ minWidth: 88 }} onClick={() => settle(top.id, true)}>{top.okLabel ?? "OK"}</Button>
            {top.kind === "confirm" && (
              <Button style={{ minWidth: 88 }} onClick={() => settle(top.id, false)}>{top.cancelLabel ?? "Cancel"}</Button>
            )}
          </div>
          </>
          )}
        </WindowContent>
      </DialogWindow>
    </Overlay>
  );
}
