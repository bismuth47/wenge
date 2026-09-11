import { useEffect } from "react";

// Animated hourglass for Windows 95 busy state
// Cycles through wait_0..wait_7 every 120ms when body has .w95-busy or .w95-appstarting
const WAIT_FRAMES = 8;
const FRAME_MS = 120;

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

      if (isBusy) {
        const url = `/cursors/wait_${frame % WAIT_FRAMES}.png`;
        // Update both body and html to ensure coverage
        document.documentElement.style.cursor = `url('${url}') 16 16, wait`;
        document.body.style.cursor = `url('${url}') 16 16, wait`;
        frame = (frame + 1) % WAIT_FRAMES;
      } else if (isAppStarting) {
        // AppStarting alternates arrow + hourglass: we just use appstarting.png static for now, but animate small hourglass part
        // Simple: keep appstarting.png but also pulse
        const url = frame % 2 === 0 ? `/cursors/appstarting.png` : `/cursors/wait_${frame % WAIT_FRAMES}.png`;
        // For appstarting, keep arrow shape but show hourglass at corner - we fallback to appstarting
        document.documentElement.style.cursor = `url('${url}') 0 0, progress`;
        document.body.style.cursor = `url('${url}') 0 0, progress`;
        frame = (frame + 1) % WAIT_FRAMES;
      } else {
        // Reset to default only if we previously overrode AND no element is being hovered
        // (element-level cursor should take priority over body)
        if (
          document.documentElement.style.cursor.includes("wait_") ||
          document.documentElement.style.cursor.includes("appstarting")
        ) {
          // Check if any element has a custom cursor set (e.g., on menu items)
          // Exclude standard cursors like arrow.png
          const customCursorExists = Array.from(document.querySelectorAll("*[style*=cursor]"))
            .slice(0, 20)
            .some(el => {
              const cursor = (el as HTMLElement).style.cursor;
              // Check if this is a Windows 95 custom cursor (not arrow.png)
              return (
                cursor &&
                !cursor.includes("auto") &&
                !cursor.includes("default") &&
                !cursor.includes("url('/cursors/arrow.png')") &&
                !cursor.includes("url('/cursors/wait_0.png')") &&
                !cursor.includes("url('/cursors/wait_1.png')") &&
                !cursor.includes("url('/cursors/wait_2.png')") &&
                !cursor.includes("url('/cursors/wait_3.png')") &&
                !cursor.includes("url('/cursors/wait_4.png')") &&
                !cursor.includes("url('/cursors/wait_5.png')") &&
                !cursor.includes("url('/cursors/wait_6.png')") &&
                !cursor.includes("url('/cursors/wait_7.png')") &&
                !cursor.includes("url('/cursors/appstarting.png')") &&
                !cursor.includes("url('/cursors/progress')")
              );
            });

          // Only reset if no custom cursors are set on any element
          if (!customCursorExists) {
            document.documentElement.style.cursor = "";
            document.body.style.cursor = "";
          }
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.documentElement.style.cursor = "";
      document.body.style.cursor = "";
    };
  }, []);
}

// Helper to trigger busy briefly (e.g., on window open)
export function triggerBusy(durationMs = 800) {
  document.body.classList.add("w95-busy");
  window.setTimeout(() => document.body.classList.remove("w95-busy"), durationMs);
}
export function setBusy(on: boolean) {
  if (on) document.body.classList.add("w95-busy");
  else document.body.classList.remove("w95-busy");
}
