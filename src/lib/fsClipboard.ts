import { useEffect, useState } from "react";

/**
 * Shared file clipboard (Cut / Copy / Paste) for Wenge.
 *
 * Win95 style: right-click → Cut / Copy puts the item here, Paste creates it
 * in the destination (Desktop or an Explorer folder). Desktop (App.tsx) and the
 * Explorer window (ExplorerApp.tsx) read the SAME clipboard so a file copied on
 * the Desktop can be pasted into an Explorer folder and vice-versa.
 *
 * This is intentionally store-agnostic: it only remembers *what* was cut/copied.
 * The paste target decides the semantics (move vs copy, VFS vs R2 vs Desktop).
 */

export type FsClipboardOp = "cut" | "copy";

/** Generic clipboard entry. `kind` identifies the source store so a paste
 *  destination can decide how to materialize it. */
export type FsClipboardItem = {
  op: FsClipboardOp;
  kind: string;
  id: string;
  label: string;
  iconSrc?: string;
  /** Optional opaque payload a destination can use to re-fetch the item. */
  item?: unknown;
};

const CLIPBOARD_EVENT = "wenge:fs-clipboard-changed";

let current: FsClipboardItem | null = null;

export function getFsClipboard(): FsClipboardItem | null {
  return current;
}

export function setFsClipboard(item: FsClipboardItem | null): void {
  current = item;
  try {
    window.dispatchEvent(new CustomEvent(CLIPBOARD_EVENT));
  } catch {
    /* non-window env */
  }
}

export function clearFsClipboard(): void {
  setFsClipboard(null);
}

/** React hook: re-render when the shared clipboard changes. */
export function useFsClipboard(): FsClipboardItem | null {
  const [, setNonce] = useState(0);
  useEffect(() => {
    const listener = () => setNonce((n) => n + 1);
    window.addEventListener(CLIPBOARD_EVENT, listener);
    return () => window.removeEventListener(CLIPBOARD_EVENT, listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return getFsClipboard();
}