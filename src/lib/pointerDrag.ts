/**
 * Pointer Events ベースの自作ドラッグ機構。
 *
 * 背景: HTML5標準のDnD APIではドラッグ中にブラウザ/OSが描くカーソル
 * (矢印・プラスマーク等) が優先され、`move_hand.png` 等のカスタムカーソルが
 * 負けてしまう。ネイティブのドラッグ状態を一切使わず、pointermoveで座標を
 * 追跡する方式にすることで、カスタムカーソルを途切れなく維持する。
 *
 * 構成:
 * - ファイルドラッグのセッション管理 (ペイロード + 追従ゴースト + カーソル)
 * - ドロップ先エレメントのレジストリ (elementFromPoint + closestで判定)
 * - 移動量しきい値・ホバー強調などの共通定数
 *
 * 注意: OS外からのドロップ (実ファイル等) はPointer Eventsでは受け取れない
 * ため、その部分だけは従来どおりネイティブの onDragOver/onDrop を残すこと。
 * (ハイブリッド構成: 内部移動=Pointer / 外部受入=ネイティブ)
 */
import { WENGE_DRAGGING_CLASS, markWengeDragEnd, markWengeDragStart } from "./r2";
import type { R2DragItem, WengeDropAction, WengeDropModifiers } from "./r2";

/** ドラッグ開始とみなす最小移動量 (px) */
export const DRAG_THRESHOLD_PX = 5;

/** ドロップ先に付与するホバー強調クラス */
export const DROP_HOVER_CLASS = "wenge-drop-hover";

export type PointerDropPos = { clientX: number; clientY: number; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean };

export type WengeDropHandler = {
  /** payloadを受け取って複製/移動などの実処理を行う */
  onDrop: (payload: R2DragItem, pos: PointerDropPos, action?: WengeDropAction) => void;
};

const dropEls = new Map<HTMLElement, WengeDropHandler>();

/** ドロップ先エレメントを登録する。戻り値で登録解除する。 */
export function registerWengeDrop(el: HTMLElement, handler: WengeDropHandler): () => void {
  dropEls.set(el, handler);
  return () => {
    if (dropEls.get(el) === handler) dropEls.delete(el);
    el.classList.remove(DROP_HOVER_CLASS);
  };
}

/** 座標直下の登録済みドロップ先を探す (一番手前を優先) */
export function hitTestDrop(clientX: number, clientY: number): { el: HTMLElement; handler: WengeDropHandler } | null {
  let el: Element | null = null;
  try {
    // ドラッグゴーストは pointer-events:none のため elementFromPoint に影響しない
    el = document.elementFromPoint(clientX, clientY);
  } catch {
    return null;
  }
  let fallback: { el: HTMLElement; handler: WengeDropHandler } | null = null;
  let insideWindow = false;
  while (el) {
    if (el instanceof HTMLElement) {
      // ウィンドウ内 (Explorer以外) ではデスクトップへ素通りさせない。
      // 例: メモ帳ウィンドウの空白部に落としてもデスクトップに移動しない。
      if (el.hasAttribute?.("data-window-id")) insideWindow = true;
      if (dropEls.has(el)) {
        // Explorerペイン/ナビ等の内側ドロップ先を最優先し、
        // デスクトップ背景自体はフォールバックとして保持 (前全面のウィンドウ下でも拾えるように)
        if (el.dataset.wengeDrop !== "desktop") {
          return { el, handler: dropEls.get(el)! };
        }
        // ウィンドウ上のドロップはそのウィンドウの処理に任せる (デスクトップ背景は拾わない)
        if (!insideWindow && !fallback) fallback = { el, handler: dropEls.get(el)! };
      }
    }
    // シャドウ除外: 直近の登録済み祖先を探す
    const closer = (el as HTMLElement).closest?.("[data-wenge-drop]") as HTMLElement | null;
    if (closer && dropEls.has(closer)) {
      if (closer.dataset.wengeDrop !== "desktop") return { el: closer, handler: dropEls.get(closer)! };
      if (!insideWindow && !fallback) fallback = { el: closer, handler: dropEls.get(closer)! };
      // より外側にExplorer等のドロップ先がある可能性は低いが、念のため走査を続ける
    }
    el = el.parentElement;
  }
  return fallback;
}

type FileSession = {
  payload: R2DragItem;
  ghost: HTMLElement;
  ghostLabel: HTMLElement | null;
  ghostBase: string;
  hoverEl: HTMLElement | null;
  modifiers: WengeDropModifiers;
};

let session: FileSession | null = null;

/** 追従ゴースト (手アイコン + ファイルアイコン + 名前) を生成する */
export function createFileDragGhost(name: string, iconSrc: string = "/cursors/file_windows.png"): HTMLElement {
  const el = document.createElement("div");
  el.className = "wenge-drag-ghost";
  el.style.cssText =
    "position:fixed;left:0;top:0;display:flex;align-items:center;gap:4px;" +
    "background:#fff;border:1px solid #000;padding:2px 6px;" +
    "font-size:11px;color:#000;pointer-events:none;white-space:nowrap;z-index:99999;";
  const hand = document.createElement("img");
  hand.src = "/cursors/move_hand.png";
  hand.width = 20;
  hand.height = 20;
  hand.draggable = false;
  const ic = document.createElement("img");
  ic.src = iconSrc;
  ic.width = 16;
  ic.height = 16;
  ic.draggable = false;
  const sp = document.createElement("span");
  sp.textContent = name;
  sp.dataset.role = "drag-label";
  el.append(hand, ic, sp);
  return el;
}

export function dropActionOf(mod?: WengeDropModifiers | null, fallback: WengeDropAction = "move"): WengeDropAction {
  if (mod?.altKey) return "shortcut";
  if (mod?.ctrlKey) return "copy";
  return fallback;
}

function ghostActionText(action: WengeDropAction): string {
  if (action === "copy") return "にコピー";
  if (action === "shortcut") return "にショートカットを作成";
  return "へ移動";
}

function defaultActionForPayload(payload: R2DragItem): WengeDropAction {
  // 実体のない仮想エントリ・R2は常にコピー/ショートカット扱い (move不可)
  if (payload.kind === "shortcut") return "shortcut";
  if (payload.kind === "file" || payload.kind === "folder") return "copy";
  return "move";
}

/** ゴーストの動作ラベルを更新する */
function updateGhostAction() {
  if (!session || !session.ghostLabel) return;
  const fallback = defaultActionForPayload(session.payload);
  const action = dropActionOf(session.modifiers, fallback);
  session.ghostLabel.textContent = `${session.ghostBase}${ghostActionText(action)}`;
}

function setHover(el: HTMLElement | null) {
  if (!session || session.hoverEl === el) return;
  session.hoverEl?.classList.remove(DROP_HOVER_CLASS);
  session.hoverEl = el;
  el?.classList.add(DROP_HOVER_CLASS);
}

/** ファイルドラッグセッションを開始する (しきい値超過後に呼ぶ) */
export function beginFileDragSession(payload: R2DragItem, ghost: HTMLElement, clientX: number, clientY: number, modifiers?: WengeDropModifiers) {
  cancelFileDragSession();
  document.body.appendChild(ghost);
  const label = ghost.querySelector('[data-role="drag-label"]') as HTMLElement | null;
  const base = label?.textContent ?? "";
  session = { payload, ghost, ghostLabel: label, ghostBase: base, hoverEl: null, modifiers: modifiers ?? {} };
  markWengeDragStart();
  updateGhostAction();
  moveFileDragSession(clientX, clientY, modifiers);
}

/** セッション中のゴースト追従 + ホバー強調の更新 */
export function moveFileDragSession(clientX: number, clientY: number, modifiers?: WengeDropModifiers) {
  if (!session) return;
  if (modifiers) {
    session.modifiers = { ctrlKey: modifiers.ctrlKey, altKey: modifiers.altKey, shiftKey: modifiers.shiftKey };
    updateGhostAction();
  }
  // 手アイコンがポインタ位置に来るようオフセット
  session.ghost.style.transform = `translate(${clientX - 10}px, ${clientY - 10}px)`;
  const hit = hitTestDrop(clientX, clientY);
  setHover(hit?.el ?? null);
}

/**
 * セッションを終了し、ドロップ先があればハンドラを呼ぶ。
 * 戻り値: ドロップ先で処理されたかどうか。
 */
export function finishFileDragSession(clientX: number, clientY: number, modifiers?: WengeDropModifiers): boolean {
  if (!session) return false;
  const { payload } = session;
  const mod = modifiers ?? session.modifiers;
  const fallback = defaultActionForPayload(payload);
  const action = dropActionOf(mod, fallback);
  const pos: PointerDropPos = { clientX, clientY, ctrlKey: mod?.ctrlKey, altKey: mod?.altKey, shiftKey: mod?.shiftKey };
  const hit = hitTestDrop(clientX, clientY);
  cancelFileDragSession();
  if (hit) {
    try {
      hit.handler.onDrop(payload, pos, action);
    } catch {
      /* ハンドラ内のエラーは各ハンドラ側で表示する */
    }
    return true;
  }
  return false;
}

/** セッションを破棄する (ドロップなし) */
export function cancelFileDragSession() {
  if (!session) {
    try {
      document.body.classList.remove(WENGE_DRAGGING_CLASS);
    } catch {}
    return;
  }
  try {
    session.hoverEl?.classList.remove(DROP_HOVER_CLASS);
    session.ghost.remove();
  } catch {}
  session = null;
  markWengeDragEnd();
}

export function isFileDragging(): boolean {
  return session !== null;
}

/** ウィンドウフォーカス喪失時などにゴーストが残らないための保険 */
export function initPointerDragCleanup() {
  const cancel = () => cancelFileDragSession();
  window.addEventListener("blur", cancel);
  window.addEventListener("pointercancel", cancel as EventListener);
  return () => {
    window.removeEventListener("blur", cancel);
    window.removeEventListener("pointercancel", cancel as EventListener);
  };
}