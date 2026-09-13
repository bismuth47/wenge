import { useState } from "react";
import { Button, Frame, TextInput } from "react95";
import { showError } from "../components/SystemDialog";
import { ICONS } from "../assets/icons";

export const RUN_ALIASES: Record<string, string> = {
  "notepad": "notepad", "notepad.exe": "notepad",
  "wordpad": "wordpad", "wordpad.exe": "wordpad", "write": "wordpad", "write.exe": "wordpad",
  "paint": "paint", "pbrush": "paint", "pbrush.exe": "paint", "mspaint": "paint", "mspaint.exe": "paint",
  "calc": "calc", "calc.exe": "calc", "clock": "clock",
  "msdos": "msdos", "command": "msdos", "command.com": "msdos", "cmd": "msdos",
  "explorer": "explorer", "my-computer": "my-computer", "mycomputer": "my-computer",
  "minesweeper": "minesweeper", "winmine": "minesweeper", "winmine.exe": "minesweeper",
  "solitaire": "solitaire", "sol": "solitaire", "sol.exe": "solitaire",
  "freecell": "freecell", "hearts": "hearts", "mshearts": "hearts", "mshearts.exe": "hearts",
  "cd-player": "cd-player", "cdplayer": "cd-player", "cdplay": "cd-player", "cdplay.exe": "cd-player",
  "media-player": "media-player", "mplayer": "media-player", "mplayer.exe": "media-player",
  "sound-recorder": "sound-recorder", "soundrec": "sound-recorder", "soundrec32": "sound-recorder",
  "volume": "volume", "sndvol": "volume", "sndvol32": "volume", "sndvol32.exe": "volume",
  "control": "control", "control-panel": "control", "control.exe": "control",
  "help": "help", "winhlp32": "help", "winhlp32.exe": "help",
  "find": "find", "run": "run", "ie": "ie", "iexplore": "ie", "iexplore.exe": "ie",
  "file-share": "file-share", "chat": "chat", "about": "about",
  "backup": "backup", "scandisk": "scandisk", "sysmon": "sysmon",
  "briefcase": "briefcase", "dialer": "dialer", "network": "network",
  "recycle": "recycle", "charmap": "charmap", "charmap.exe": "charmap",
};

export const RUN_PROGRAMS = [
  { cmd: "notepad", label: "Notepad (notepad.exe)" },
  { cmd: "mspaint", label: "Paint (mspaint.exe)" },
  { cmd: "calc", label: "Calculator (calc.exe)" },
  { cmd: "explorer", label: "Explorer (explorer)" },
  { cmd: "command", label: "MS-DOS Prompt (command.com)" },
  { cmd: "winmine", label: "Minesweeper (winmine.exe)" },
  { cmd: "sol", label: "Solitaire (sol.exe)" },
  { cmd: "iexplore", label: "Internet Explorer (iexplore.exe)" },
  { cmd: "mplayer", label: "Media Player (mplayer.exe)" },
  { cmd: "control", label: "Control Panel (control.exe)" },
  { cmd: "winhlp32", label: "Help (winhlp32.exe)" },
];

export function RunDialog({ onClose, onRun }: { onClose?: () => void; onRun?: (id: any) => void }) {
  const [cmd, setCmd] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);
  const submit = (raw?: string) => {
    const src = (raw ?? cmd).trim();
    if (!src) { showError("Run", "Type the name of a program."); return; }
    const id = (RUN_ALIASES as any)[src.toLowerCase()];
    if (id) { onRun?.(id); onClose?.(); }
    else showError("Run", "Cannot find '" + src + "'.\nCheck the spelling and try again.");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <img src={ICONS.run} alt="" width={32} height={32} style={{ imageRendering: "pixelated" as const, flexShrink: 0 }} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
        <div style={{ fontSize: 11, lineHeight: 1.5 }}>Type the name of a program, folder, document, or Internet resource,<br />and Wenge will open it for you.</div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, width: 70 }}>Name:</span>
        <TextInput value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="e.g.: notepad, calc, mspaint" style={{ flex: 1 }} />
      </div>
      {browseOpen && (
        <Frame variant="well" style={{ background: "#fff", padding: 4, maxHeight: 150, overflow: "auto" }}>
          <div style={{ fontSize: 11, background: "#000080", color: "#fff", padding: "2px 6px" }}>Browse - C:\\Windows</div>
          {RUN_PROGRAMS.map((p) => (<div key={p.cmd} onClick={() => setCmd(p.cmd)} onDoubleClick={() => { setCmd(p.cmd); setBrowseOpen(false); submit(p.cmd); }} style={{ fontSize: 11, padding: "3px 6px", cursor: "url('/cursors/hand.png') 12 0, pointer", background: cmd === p.cmd ? "#000080" : "transparent", color: cmd === p.cmd ? "#fff" : "#000" }}>{p.label}</div>))}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, padding: 4 }}>
            <Button size="sm" onClick={() => setBrowseOpen(false)}>OK</Button>
            <Button size="sm" onClick={() => setBrowseOpen(false)}>Cancel</Button>
          </div>
        </Frame>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <Button onClick={() => submit()}>OK</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => setBrowseOpen((v) => !v)}>Browse...</Button>
      </div>
    </div>
  );
}
