import type { R2DragItem, WengeDropAction } from "./r2";

/**
 * Bridge so an Explorer window can ask the Desktop (App.tsx) to materialize a
 * file/folder as a shortcut / copy / move without reaching into App internals.
 *
 * App.tsx renders the desktop and owns `desktopShortcuts`/`setDesktopShortcuts`
 * plus the drop machinery, so it registers a listener for this event and calls
 * its existing `dropWengeFileToDesktop(item, clientX, clientY, action)`.
 */

export const SEND_TO_DESKTOP_EVENT = "wenge:send-to-desktop";

export type SendToDesktopPayload = {
  item: R2DragItem;
  action: WengeDropAction;
  clientX: number;
  clientY: number;
};

export function sendItemToDesktop(item: R2DragItem, action: WengeDropAction, clientX: number, clientY: number): void {
  try {
    const payload: SendToDesktopPayload = { item, action, clientX, clientY };
    window.dispatchEvent(new CustomEvent<SendToDesktopPayload>(SEND_TO_DESKTOP_EVENT, { detail: payload }));
  } catch {
    /* non-window env */
  }
}

export function onSendToDesktop(handler: (payload: SendToDesktopPayload) => void): () => void {
  const listener = (e: Event) => {
    const p = (e as CustomEvent<SendToDesktopPayload>).detail;
    if (p) handler(p);
  };
  window.addEventListener(SEND_TO_DESKTOP_EVENT, listener);
  return () => window.removeEventListener(SEND_TO_DESKTOP_EVENT, listener);
}