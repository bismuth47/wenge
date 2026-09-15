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
      // scale by the global tray volume (0..100, default 70)
      audio.volume = volume * (getStoredVolume() / 100);
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
  try { window.dispatchEvent(new CustomEvent("wenge:sound-enabled", { detail: enabled })); } catch {}
}
export function getSoundEnabled(): boolean { return isSoundEnabled(); }

function getStoredVolume(): number {
  try {
    const v = localStorage.getItem("wenge_volume");
    if (v === null) return 70;
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  } catch {}
  return 70;
}

export function getVolume(): number { return getStoredVolume(); }

/** Master gain 0..1 reflecting the taskbar tray volume + mute switch.
 *  All audio output (effects, Media Player, test/shutdown sounds) should
 *  go through this so the tray controls *everything*. */
export function getMasterGain(): number {
  if (!isSoundEnabled()) return 0;
  return getStoredVolume() / 100;
}

/** Apply the master gain to an ad-hoc Audio element (scale = local factor 0..1). */
export function applyMasterVolume(audio: HTMLAudioElement, scale = 1): void {
  try {
    audio.volume = Math.max(0, Math.min(1, scale * getMasterGain()));
  } catch {}
}

export function setVolume(vol: number) {
  const v = Math.max(0, Math.min(100, Math.round(vol)));
  try { localStorage.setItem("wenge_volume", String(v)); } catch {}
  try { window.dispatchEvent(new CustomEvent("wenge:volume", { detail: v })); } catch {}
  // volume 0 behaves like mute for all effects
  if (v === 0) {
    try { localStorage.setItem("wenge_sound_enabled", "0"); } catch {}
    try { window.dispatchEvent(new CustomEvent("wenge:sound-enabled", { detail: false })); } catch {}
  }
}

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
