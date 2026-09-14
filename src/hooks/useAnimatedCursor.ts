import { useEffect } from "react";

// Animated hourglass for Windows 95 busy state
// Cycles through wait_0..wait_7 every 100ms when body has .w95-busy or .w95-appstarting
const WAIT_FRAMES = 8;
const FRAME_MS = 100;

export function useAnimatedCursor() {
  useEffect(() => {
    let frame = 0;
    let raf: number | null = null;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      last = now;

      const isBusy = document.body.classList.contains("w95-busy");
      const isAppStarting = document.body.classList.contains("w95-appstarting");
      const rootStyle = document.documentElement.style;

      if (isBusy) {
        const url = `/cursors/wait_${frame % WAIT_FRAMES}.png`;
        // NOTE: .w95-busy * は !important で固定カーソルを指定しているため、
        // body/html の inline cursor では上書きできない (inline < !important)。
        // CSS変数経由で !important ルールの中身を毎フレーム差し替えてアニメさせる。
        rootStyle.setProperty("--w95-wait-cursor", `url('${url}') 16 16, wait`);
        frame = (frame + 1) % WAIT_FRAMES;
      } else if (isAppStarting) {
        // AppStarting alternates arrow + hourglass: we just use appstarting.png static for now, but animate small hourglass part
        // Simple: keep appstarting.png but also pulse
        const url = frame % 2 === 0 ? `/cursors/appstarting.png` : `/cursors/wait_${frame % WAIT_FRAMES}.png`;
        // For appstarting, keep arrow shape but show hourglass at corner - we fallback to appstarting
        rootStyle.setProperty("--w95-appstarting-cursor", `url('${url}') 0 0, progress`);
        frame = (frame + 1) % WAIT_FRAMES;
      } else {
        // busy/appstarting クラスが外れたら変数を掃除 (次回の開始を0フレーム目からに)
        // 旧実装の inline cursor が残っていた場合の互換掃除も兼ねる
        if (rootStyle.getPropertyValue("--w95-wait-cursor")) {
          rootStyle.removeProperty("--w95-wait-cursor");
        }
        if (rootStyle.getPropertyValue("--w95-appstarting-cursor")) {
          rootStyle.removeProperty("--w95-appstarting-cursor");
        }
        if (
          document.documentElement.style.cursor.includes("wait_") ||
          document.documentElement.style.cursor.includes("appstarting")
        ) {
          document.documentElement.style.cursor = "";
          document.body.style.cursor = "";
        }
        frame = 0;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.documentElement.style.removeProperty("--w95-wait-cursor");
      document.documentElement.style.removeProperty("--w95-appstarting-cursor");
      document.documentElement.style.cursor = "";
      document.body.style.cursor = "";
    };
  }, []);
}

// Helper to trigger busy briefly (e.g., on window open)
export function triggerBusy(durationMs = 800) {
  acquireBusy();
  window.setTimeout(() => releaseBusy(), durationMs);
}
export function setBusy(on: boolean) {
  if (on) document.body.classList.add("w95-busy");
  else document.body.classList.remove("w95-busy");
}

// 複数ウィンドウ共存用: 最後の1つが終わるまで w95-busy を維持する参照カウント。
// Explorer / FileShare など非同期ロードを持つ窓はこちらを使うこと。
let globalBusyRefs = 0;
export function acquireBusy() {
  if (globalBusyRefs === 0) setBusy(true);
  globalBusyRefs += 1;
}
export function releaseBusy() {
  globalBusyRefs = Math.max(0, globalBusyRefs - 1);
  if (globalBusyRefs === 0) setBusy(false);
}
