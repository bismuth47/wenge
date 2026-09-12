import { useState, useEffect } from "react";
import styled from "styled-components";
import { Button, Window, WindowHeader, WindowContent } from "react95";

export type SystemDialogKind = "error" | "confirm" | "info";

export type SystemDialogRequest = {
  id: number;
  kind: SystemDialogKind;
  title: string;
  message: string;
  okLabel?: string;
  cancelLabel?: string;
  /** resolved with true=OK/confirmed, false=cancelled */
  resolve: (ok: boolean) => void;
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
  position: fixed;
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
  background: ${(p) => (p.$kind === "error" ? "#c00000" : p.$kind === "confirm" ? "#000080" : "#007000")};
  border: 2px solid #fff;
  outline: 1px solid #000;
`;

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
      if (e.key === "Enter") settle(top.id, true);
      if (e.key === "Escape" && top.kind !== "error") settle(top.id, false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top]);
  if (!top) return null;
  return (
    <Overlay onMouseDown={(e) => { if (e.target === e.currentTarget && top.kind !== "error") settle(top.id, false); }}>
      <DialogWindow>
        <WindowHeader style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{top.title}</span>
          {top.kind !== "error" && (
            <Button square size="sm" onClick={() => settle(top.id, false)}>
              <span>×</span>
            </Button>
          )}
        </WindowHeader>
        <WindowContent>
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
        </WindowContent>
      </DialogWindow>
    </Overlay>
  );
}
