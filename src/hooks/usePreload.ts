import { SOUNDS } from "./useSound";
import { ICONS } from "../assets/icons";

export type PreloadProgress = {
  loaded: number;
  total: number;
  /** 0..1 */
  ratio: number;
  current: string;
};

function loadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;
    img.src = src;
    // decode() warms the image cache so first paint is instant
    if (typeof img.decode === "function") {
      img.decode().then(done, done);
    }
  });
}

function loadAudio(src: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      const done = () => resolve();
      const timer = window.setTimeout(done, 5000);
      const finish = () => {
        window.clearTimeout(timer);
        resolve();
      };
      audio.addEventListener("canplaythrough", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
      audio.preload = "auto";
      audio.src = src;
      audio.load();
      // already cached / instant
      if (audio.readyState >= 4) finish();
      else window.setTimeout(done, 4000);
    } catch {
      resolve();
    }
  });
}

const CURSORS = [
  "/cursors/arrow.png",
  "/cursors/beam.png",
  "/cursors/wait.png",
  "/cursors/appstarting.png",
  "/cursors/move.png",
  "/cursors/hand.png",
] as const;

const EXTRA_ICONS = ["/icons/start.png", "/icons/start-16.png", "/favicon.svg"] as const;

function collectAssets(): string[] {
  const imgs = [
    ...Object.values(ICONS),
    ...CURSORS,
    ...EXTRA_ICONS,
  ];
  const sounds = Object.values(SOUNDS);
  // de-dupe
  return [...new Set([...imgs, ...sounds])];
}

export function getPreloadAssets(): { images: string[]; sounds: string[] } {
  return {
    images: [...new Set([...Object.values(ICONS), ...CURSORS, ...EXTRA_ICONS])],
    sounds: [...new Set(Object.values(SOUNDS))],
  };
}

/**
 * Preload every image / sound the OS shell needs so the desktop paints
 * instantly after login. Never rejects; resolves when all settle.
 * onProgress is called after each asset finishes (or fails — failures
 * still count so the boot screen can never get stuck).
 */
export async function preloadOsAssets(onProgress?: (p: PreloadProgress) => void): Promise<void> {
  const assets = collectAssets();
  const total = assets.length;
  let loaded = 0;
  const tick = (src: string) => {
    loaded += 1;
    try {
      onProgress?.({ loaded, total, ratio: total ? loaded / total : 1, current: src });
    } catch {}
  };
  await Promise.all(
    assets.map((src) => {
      const isAudio = /\.(wav|mp3|ogg)$/i.test(src);
      const job = isAudio ? loadAudio(src) : loadImage(src);
      return job.then(
        () => tick(src),
        () => tick(src)
      );
    })
  );
}
