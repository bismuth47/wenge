import { useEffect, useRef, useState, useCallback } from "react";
import { Button, Frame, Slider, Separator, TextInput, Checkbox } from "react95";
import { ICONS } from "../assets/icons";

type Track = {
  id: string;
  name: string;
  src: string;
  artist?: string;
  duration?: number;
};

// Default playlist uses authentic Windows 95 sounds as demo + allows user files
const BUILTIN_TRACKS: Track[] = [
  { id: "1", name: "Startup.wav", src: "/sounds/Startup.wav", artist: "Windows 95" },
  { id: "2", name: "Logon Sound.wav", src: "/sounds/Logon Sound.wav", artist: "Windows 95" },
  { id: "3", name: "chimes.wav", src: "/sounds/chimes.wav", artist: "Windows 95" },
  { id: "4", name: "tada.wav", src: "/sounds/tada.wav", artist: "Windows 95" },
  { id: "5", name: "chord.wav", src: "/sounds/chord.wav", artist: "Windows 95" },
  { id: "6", name: "notify.wav", src: "/sounds/notify.wav", artist: "Windows 95" },
  { id: "7", name: "recycle.wav", src: "/sounds/recycle.wav", artist: "Windows 95" },
  { id: "8", name: "ringin.wav", src: "/sounds/ringin.wav", artist: "Windows 95" },
];

function formatTime(s: number) {
  if (!isFinite(s) || isNaN(s)) return "00:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

import { consumePendingVfsFile } from "../lib/vfs/openWith";
import type { VfsFile } from "../lib/vfs/types";
import { getSoundEnabled, getVolume } from "../hooks/useSound";

export function MediaPlayerApp({ file }: { file?: VfsFile | null }) {
  const [tracks, setTracks] = useState<Track[]>(BUILTIN_TRACKS);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    try {
      const v = localStorage.getItem("wenge_mediaplayer_volume");
      if (v !== null) {
        const n = Number(v);
        if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
      }
    } catch {}
    return 70;
  });
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("wenge_mediaplayer_muted") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("wenge_mediaplayer_volume", String(volume));
    } catch {}
  }, [volume]);
  useEffect(() => {
    try {
      localStorage.setItem("wenge_mediaplayer_muted", muted ? "1" : "0");
    } catch {}
  }, [muted]);
  // タスクバーのマスター音量。タスクバー操作で変わるのでイベント購読し、
  // 再生音量 = ローカル音量 × マスターにする (トレイが全てを制御)
  const [masterVol, setMasterVol] = useState(() => getVolume());
  const [masterEnabled, setMasterEnabled] = useState(() => getSoundEnabled());
  useEffect(() => {
    const onVol = (e: Event) => setMasterVol((e as CustomEvent<number>).detail);
    const onEn = (e: Event) => setMasterEnabled((e as CustomEvent<boolean>).detail);
    window.addEventListener("wenge:volume", onVol);
    window.addEventListener("wenge:sound-enabled", onEn);
    return () => {
      window.removeEventListener("wenge:volume", onVol);
      window.removeEventListener("wenge:sound-enabled", onEn);
    };
  }, []);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [status, setStatus] = useState("Stopped");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const progressRef = useRef<HTMLInputElement | null>(null);
  // 取り込み済みVFSトラックid。file propのidentity変化でのeffect再発火時に
  // 重複追加・勝手な再生再開をしないためのガード
  const importedVfsIds = useRef<Set<string>>(new Set());
  const tracksRef = useRef<Track[]>(tracks);
  tracksRef.current = tracks;

  // Open a VFS audio/video file (double-click on Desktop / Explorer)
  useEffect(() => {
    const target = file ?? consumePendingVfsFile();
    if (!target) return;
    const trackId = `vfs-${target.id}`;
    const existingIdx = tracksRef.current.findIndex((x) => x.id === trackId);
    if (existingIdx >= 0 || importedVfsIds.current.has(trackId)) {
      // 取り込み済みの再オープン: そのトラックへ移動して再生 (重複追加しない)
      if (existingIdx >= 0) {
        setIndex(existingIdx);
        setPlaying(true);
      }
      return;
    }
    importedVfsIds.current.add(trackId);
    const url = URL.createObjectURL(target.blob);
    const t: Track = { id: trackId, name: target.name, src: url, artist: "VFS" };
    const nextIdx = tracksRef.current.length;
    setTracks((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t]));
    setIndex(nextIdx);
    setPlaying(true);
  }, [file]);

  const current = tracks[index] ?? null;

  // --- Audio element lifecycle ---
  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "metadata";
    }
    return audioRef.current;
  }, []);

  useEffect(() => {
    const audio = ensureAudio();
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (repeat) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else if (shuffle) {
        const next = Math.floor(Math.random() * tracks.length);
        setIndex(next);
      } else {
        if (index < tracks.length - 1) setIndex((i) => i + 1);
        else setPlaying(false);
      }
    };
    const onPlay = () => setStatus("Playing");
    const onPause = () => setStatus(playing ? "Paused" : "Stopped");

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [ensureAudio, playing, repeat, shuffle, tracks.length, index]);

  // load track when index/src changes
  useEffect(() => {
    if (!current) return;
    const audio = ensureAudio();
    audio.src = current.src;
    audio.load();
    if (playing) {
      audio.play().catch(() => setPlaying(false));
    }
    setStatus(playing ? "Playing" : "Ready");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.src]);

  useEffect(() => {
    const audio = ensureAudio();
    audio.volume = muted || !masterEnabled ? 0 : (volume / 100) * (masterVol / 100);
  }, [volume, muted, masterVol, masterEnabled, ensureAudio]);

  useEffect(() => {
    const audio = ensureAudio();
    if (playing) audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [playing, ensureAudio]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      for (const t of tracksRef.current) {
        if (t.src.startsWith("blob:")) {
          try { URL.revokeObjectURL(t.src); } catch {}
        }
      }
    };
  }, []);

  const togglePlay = () => {
    if (!current) return;
    const audio = ensureAudio();
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      // if stopped at end, restart
      if (audio.currentTime >= (audio.duration || 0) - 0.2) audio.currentTime = 0;
      setPlaying(true);
    }
  };
  const stop = () => {
    const audio = ensureAudio();
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setPlaying(false);
      setStatus("Stopped");
    }
  };
  const next = () => {
    setIndex((i) => (i + 1) % tracks.length);
    setPlaying(true);
  };
  const prev = () => {
    const audio = ensureAudio();
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
    } else {
      setIndex((i) => (i - 1 + tracks.length) % tracks.length);
      setPlaying(true);
    }
  };
  const seek = (v: number) => {
    const audio = ensureAudio();
    audio.currentTime = v;
    setCurrentTime(v);
  };

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newTracks: Track[] = Array.from(files).map((f, i) => ({
      id: `user-${Date.now()}-${i}`,
      name: f.name,
      src: URL.createObjectURL(f),
      artist: "Local File",
    }));
    setTracks((prev) => [...prev, ...newTracks]);
    setIndex(tracks.length);
    setPlaying(true);
    setStatus(`Loaded ${newTracks.length} file(s)`);
  };

  const addUrl = () => {
    const u = urlInput.trim();
    if (!u) return;
    let name = u.split("/").pop() || u;
    try {
      const parsed = new URL(u.startsWith("http") ? u : `https://${u}`);
      name = decodeURIComponent(parsed.pathname.split("/").pop() || name);
    } catch {}
    if (!name) name = u;
    const t: Track = { id: `url-${Date.now()}`, name, src: u, artist: "URL" };
    setTracks((prev) => [...prev, t]);
    setIndex(tracks.length);
    setPlaying(true);
    setUrlInput("");
  };

  const onDrop: React.DragEventHandler = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFiles(e.dataTransfer.files);
    } else if (e.dataTransfer.getData("text/uri-list")) {
      const u = e.dataTransfer.getData("text/uri-list").split("\n")[0];
      if (u) {
        const t: Track = { id: `url-${Date.now()}`, name: u.split("/").pop() || u, src: u, artist: "URL" };
        setTracks((prev) => [...prev, t]);
        setIndex(tracks.length);
        setPlaying(true);
      }
    }
  };

  // keyboard: space play/pause
  const onKeyDown: React.KeyboardEventHandler = (e) => {
    if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      togglePlay();
    }
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 6, userSelect: "none" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      {/* Menu bar like Win95 Media Player */}
      <div style={{ display: "flex", gap: 10, fontSize: 11, padding: "2px 4px", borderBottom: "1px solid #808080" }}>
        <span style={{ textDecoration: "underline" }}>F</span>ile
        <span style={{ textDecoration: "underline" }}>V</span>iew
        <span style={{ textDecoration: "underline" }}>D</span>evice
        <span style={{ textDecoration: "underline" }}>S</span>cale
        <span style={{ textDecoration: "underline" }}>H</span>elp
      </div>

      {/* Display */}
      <Frame variant="well" style={{ background: "#000", color: "#00ff00", padding: "6px 8px", fontFamily: "monospace", fontSize: 11, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
            <img src={ICONS.cd} alt="" width={16} height={16} style={{ imageRendering: "pixelated" as const, flexShrink: 0 }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {current ? `${current.artist ? current.artist + " - " : ""}${current.name}` : "No track"}
            </span>
            <span style={{ background: current && playing ? "#00ff00" : "#003300", color: "#000", fontSize: 9, padding: "1px 4px", flexShrink: 0 }}>
              {status}
            </span>
          </div>
          <span style={{ flexShrink: 0, fontSize: 12, letterSpacing: 1 }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        {/* Seek */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, color: "#00ff00" }}>[{String(index + 1).padStart(2, "0")}/{String(tracks.length).padStart(2, "0")}]</span>
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <input
              ref={progressRef as any}
              type="range"
              min={0}
              max={duration || 100}
              value={Math.min(currentTime, duration || 0)}
              onChange={(e) => seek(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#00ff00", height: 12 }}
            />
          </div>
        </div>
        {/* VU meter fake */}
        <div style={{ display: "flex", gap: 2, height: 8, alignItems: "center" }}>
          {Array.from({ length: 20 }).map((_, i) => {
            const active = playing && Math.random() > 0.3 + i * 0.02;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: i < 14 ? 6 : 8,
                  background: active ? (i > 16 ? "#ff0000" : i > 12 ? "#ffff00" : "#00ff00") : "#003300",
                  border: "1px solid #001100",
                }}
              />
            );
          })}
          <span style={{ fontSize: 8, color: "#00ff00", marginLeft: 6 }}>{playing ? "▶ STEREO" : "■ STOP"}</span>
        </div>
      </Frame>

      {/* Transport */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        <Button size="sm" onClick={prev} title="Previous (or restart)">
          ◀◀
        </Button>
        <Button size="sm" onClick={togglePlay} style={{ fontWeight: "bold", minWidth: 60 }}>
          {playing ? "❚❚ Pause" : "▶ Play"}
        </Button>
        <Button size="sm" onClick={stop}>
          ■ Stop
        </Button>
        <Button size="sm" onClick={next}>
          ▶▶
        </Button>
        <Button size="sm" onClick={() => fileInputRef.current?.click()} title="Open file">
          ⏏ Open
        </Button>
        <Separator orientation="vertical" size="20px" style={{ margin: "0 4px" }} />
        <span style={{ fontSize: 11 }}>Vol</span>
        <div style={{ width: 90 }}>
          <Slider value={volume} min={0} max={100} onChange={(v: number) => setVolume(Math.max(0, Math.min(100, Math.round(v))))} />
        </div>
        <Checkbox checked={muted} onChange={() => setMuted((v) => !v)} label="Mute" value="mute" />
      </div>

      {/* File / URL open */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input ref={fileInputRef} type="file" accept="audio/*,video/*,.mp3,.wav,.ogg,.m4a,.flac,.mp4,.webm" multiple style={{ display: "none" }} onChange={(e) => onFiles(e.target.files)} />
        <TextInput value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addUrl()} placeholder="https://example.com/song.mp3  またはファイルをドロップ" style={{ flex: 1 }} />
        <Button size="sm" onClick={addUrl} disabled={!urlInput.trim()}>
          Add URL
        </Button>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <Checkbox checked={shuffle} onChange={() => setShuffle((v) => !v)} label="Shuffle" value="shuffle" />
        <Checkbox checked={repeat} onChange={() => setRepeat((v) => !v)} label="Repeat" value="repeat" />
        <span style={{ fontSize: 10, color: "#808080", marginLeft: "auto" }}>{tracks.length} track(s) · Drag & drop supported</span>
      </div>

      {/* Playlist */}
      <Frame variant="well" style={{ background: "#fff", padding: 2, height: 160, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ fontSize: 11, padding: "3px 6px", background: "#000080", color: "#fff", display: "flex", justifyContent: "space-between" }}>
          <span>Playlist</span>
          <span style={{ fontSize: 10 }}>{current ? `Now: ${current.name}` : ""}</span>
        </div>
        <div style={{ flex: 1, overflow: "auto", fontSize: 11 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#c0c0c0", position: "sticky", top: 0 }}>
                <th style={{ textAlign: "left", padding: "3px 6px", borderRight: "1px solid #808080", borderBottom: "1px solid #808080" }}>#</th>
                <th style={{ textAlign: "left", padding: "3px 6px", borderRight: "1px solid #808080", borderBottom: "1px solid #808080" }}>Title</th>
                <th style={{ textAlign: "left", padding: "3px 6px", borderBottom: "1px solid #808080" }}>Artist</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((t, i) => (
                <tr
                  key={t.id}
                  onClick={() => {
                    setIndex(i);
                    setPlaying(true);
                  }}
                  onDoubleClick={() => {
                    setIndex(i);
                    setPlaying(true);
                  }}
                  style={{
                    background: i === index ? "#000080" : "transparent",
                    color: i === index ? "#fff" : "#000",
                    cursor: "url('/cursors/hand.png') 12 0, pointer",
                  }}
                >
                  <td style={{ padding: "2px 6px", borderRight: "1px solid #dfdfdf" }}>
                    {i === index && playing ? "♪" : i + 1}
                  </td>
                  <td style={{ padding: "2px 6px", borderRight: "1px solid #dfdfdf", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</td>
                  <td style={{ padding: "2px 6px", whiteSpace: "nowrap" }}>{t.artist}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tracks.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "#808080" }}>No tracks — Open file or drop audio here</div>}
        </div>
      </Frame>

      <div style={{ display: "flex", gap: 6, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "#808080" }}>Wenge Media Player · supports mp3 / wav / ogg / m4a · Win95 style</span>
        <Button size="sm" onClick={() => { setTracks(BUILTIN_TRACKS); setIndex(0); setPlaying(false); }}>
          Reset
        </Button>
      </div>
    </div>
  );
}
