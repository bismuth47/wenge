/** Display settings: virtual resolution, UI scale, fullscreen. Persisted to localStorage. */

export type ResolutionId = "native" | "800x600" | "1024x768" | "1280x1024";

export const RESOLUTIONS: Record<Exclude<ResolutionId, "native">, { w: number; h: number; label: string }> = {
  "800x600": { w: 800, h: 600, label: "800 x 600" },
  "1024x768": { w: 1024, h: 768, label: "1024 x 768" },
  "1280x1024": { w: 1280, h: 1024, label: "1280 x 1024" },
};

export type UiScale = 100 | 125 | 150;
export const UI_SCALES: UiScale[] = [100, 125, 150];

const RES_KEY = "wenge_resolution";
const SCALE_KEY = "wenge_ui_scale";

export const RESOLUTION_EVENT = "wenge:resolution";
export const UI_SCALE_EVENT = "wenge:ui-scale";

export function getResolution(): ResolutionId {
  try {
    const v = localStorage.getItem(RES_KEY);
    if (v === "native" || v === "800x600" || v === "1024x768" || v === "1280x1024") return v;
  } catch {}
  return "native";
}

export function setResolution(v: ResolutionId) {
  try {
    localStorage.setItem(RES_KEY, v);
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent<ResolutionId>(RESOLUTION_EVENT, { detail: v }));
  } catch {}
}

export function getUiScale(): UiScale {
  try {
    const v = Number(localStorage.getItem(SCALE_KEY));
    if (v === 100 || v === 125 || v === 150) return v;
  } catch {}
  return 100;
}

export function setUiScale(v: UiScale) {
  try {
    localStorage.setItem(SCALE_KEY, String(v));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent<UiScale>(UI_SCALE_EVENT, { detail: v }));
  } catch {}
}

// --- View metrics (仮想画面の論理サイズと描画スケール) ---
// Appが毎レンダーで更新し、WindowFrame外の部品(IEメニュー等)が座標換算に使う。
export type ViewMetrics = { scale: number; w: number; h: number };
let viewMetrics: ViewMetrics = { scale: 1, w: 0, h: 0 };
export function setViewMetrics(m: ViewMetrics) {
  viewMetrics = m;
}
export function getViewMetrics(): ViewMetrics {
  return viewMetrics;
}
/** client座標(画面px)→仮想論理px */
export function toVirtualPoint(clientX: number, clientY: number): { x: number; y: number } {
  try {
    const rect = document.getElementById("wenge-virtual-screen")?.getBoundingClientRect();
    const s = viewMetrics.scale > 0 ? viewMetrics.scale : 1;
    if (!rect) return { x: clientX, y: clientY };
    return { x: (clientX - rect.left) / s, y: (clientY - rect.top) / s };
  } catch {
    return { x: clientX, y: clientY };
  }
}

// --- Fullscreen (Fullscreen API; not persisted) ---
export function isFullscreen(): boolean {
  try {
    return !!document.fullscreenElement;
  } catch {
    return false;
  }
}

export async function enterFullscreen(): Promise<void> {
  const el = document.documentElement as any;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch {}
}

export async function exitFullscreen(): Promise<void> {
  try {
    if (document.exitFullscreen && document.fullscreenElement) await document.exitFullscreen();
    else if ((document as any).webkitExitFullscreen && (document as any).webkitFullscreenElement) {
      await (document as any).webkitExitFullscreen();
    }
  } catch {}
}

export async function toggleFullscreen(): Promise<void> {
  if (isFullscreen()) await exitFullscreen();
  else await enterFullscreen();
}
