import { useEffect, useState } from "react";
import { Button, Checkbox, Fieldset, TextInput } from "react95";
import styled from "styled-components";
import { showInfo } from "../components/SystemDialog";
import { consumePendingVfsFile } from "../lib/vfs/openWith";
import { saveBlobToVfs } from "../lib/vfs/store";
import { VFS_DOCUMENTS } from "../lib/vfs/types";
import type { VfsFile } from "../lib/vfs/types";

const Area = styled.textarea`
  width: 100%;
  height: 180px;
  resize: none;
  font-family: "Courier New", monospace !important;
  font-size: 12px;
  padding: 4px;
  border: 2px inset #fff;
  outline: none;
`;

export function NotepadApp({ file }: { file?: VfsFile | null }) {
  const [text, setText] = useState("Welcome to Wenge OS!\n\nThis is a Windows 95-style Notepad.\n- Buttons\n- Text input\n- Checkboxes\nYou can try them here.");
  const [wrap, setWrap] = useState(true);
  const [showStatus, setShowStatus] = useState(true);
  const [title, setTitle] = useState("Untitled");
  // Open a VFS text file (double-click on Desktop / Explorer)
  useEffect(() => {
    const target = file ?? consumePendingVfsFile();
    if (!target) return;
    const base = (target.name || "Untitled").replace(/\.[^.]+$/, "") || "Untitled";
    setTitle(base);
    target.blob.text().then((t) => setText(t)).catch(() => {});
  }, [file]);
  const save=()=>{
    try{
      const blob=new Blob([text],{type:"text/plain"});
      const name=(title.trim()||"Untitled")+".txt";
      // Save into the VFS (Documents) so it survives reload + shows in Explorer,
      // and also offer a real-machine download via the anchor.
      saveBlobToVfs({ blob, dir: VFS_DOCUMENTS, name, mime: "text/plain" })
        .then(() => showInfo("Notepad", `Saved to C:/Documents/${name}\nCharacters: ${text.length}`))
        .catch(() => showInfo("Notepad", `Saved: ${title}\nCharacters: ${text.length}`));
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url; a.download=name; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch{ showInfo("Notepad", `Saved: ${title}\nCharacters: ${text.length}`); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="File name" style={{ flex: 1 }} />
        <Button onClick={save}>Save</Button>
        <Button onClick={() => setText("")}>New</Button>
      </div>
      <Fieldset label="Options">
        <Checkbox checked={wrap} onChange={() => setWrap(!wrap)} value="wrap" label="Word Wrap" />
        <Checkbox checked={showStatus} onChange={()=>setShowStatus(v=>!v)} value="status" label="Status Bar" />
      </Fieldset>
      <Area value={text} onChange={(e) => setText(e.target.value)} style={{ whiteSpace: wrap ? "pre-wrap" : "pre", overflowX: wrap ? "hidden" : "auto" }} />
      {showStatus && <div style={{ fontSize: 11, color: "#555" }}>Characters: {text.length} | Lines: {text.split("\n").length}</div>}
    </div>
  );
}
