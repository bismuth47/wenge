import { useCallback, useRef } from "react";

export function useSound(src: string, volume = 0.5) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const play = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(src);
      }
      audioRef.current.volume = volume;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}
  }, [src, volume]);
  return play;
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
