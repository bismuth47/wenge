import { useCallback, useRef } from "react";

// Global default ON — stored in localStorage, defaults to true
function isSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem("wenge_sound_enabled");
    if (v === null) return true;
    return v !== "0" && v !== "false";
  } catch {
    return true;
  }
}

// Unlock helper: browsers block autoplay until user gesture.
// We queue a retry on next click/keydown if play() was blocked.
let audioUnlocked = false;
let unlockListenersAttached = false;
const pendingPlays: (() => void)[] = [];
function ensureUnlockListeners() {
  if (unlockListenersAttached || typeof window === "undefined") return;
  unlockListenersAttached = true;
  const unlock = () => {
    audioUnlocked = true;
    // create dummy AudioContext resume if needed
    try {
      const ctx = (window as any).__wengeAudioCtx;
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch {}
    // flush pending plays
    while (pendingPlays.length) {
      const fn = pendingPlays.shift();
      try { fn?.(); } catch {}
    }
    window.removeEventListener("click", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("click", unlock, { once: false });
  window.addEventListener("keydown", unlock, { once: false });
  window.addEventListener("touchstart", unlock, { once: false });
}

export function useSound(src: string, volume = 0.5) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const play = useCallback(() => {
    if (!isSoundEnabled()) return;
    ensureUnlockListeners();
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(src);
        audioRef.current.preload = "auto";
      }
      const audio = audioRef.current;
      audio.volume = volume;
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof (p as Promise<void>).catch === "function") {
        (p as Promise<void>).catch(() => {
          // autoplay blocked — queue for unlock
          if (!audioUnlocked) {
            pendingPlays.push(() => {
              try {
                audio.currentTime = 0;
                audio.play().catch(() => {});
              } catch {}
            });
          }
        });
      }
    } catch {}
  }, [src, volume]);
  return play;
}

export function setSoundEnabled(enabled: boolean) {
  try { localStorage.setItem("wenge_sound_enabled", enabled ? "1" : "0"); } catch {}
}
export function getSoundEnabled(): boolean { return isSoundEnabled(); }

export const SOUNDS = {
  startup: "/sounds/Startup.wav",
  chord: "/sounds/chord.wav",
  ding: "/sounds/Ding.wav",
  chimes: "/sounds/chimes.wav",
  tada: "/sounds/tada.wav",
  recycle: "/sounds/recycle.wav",
  minimize: "/sounds/Minimize.wav",
  restore: "/sounds/Restore.wav",
  start: "/sounds/start.wav",
  error: "/sounds/Critical Stop.wav",
  notify: "/sounds/notify.wav",
  navigation: "/sounds/Navigation Start.wav",
  exclamation: "/sounds/Exclamation.wav",
  shutdown: "/sounds/Shutdown.wav",
};
