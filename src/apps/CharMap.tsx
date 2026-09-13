import { useState } from "react";
import { Button, Frame, TextInput, Fieldset } from "react95";

export function CharMapApp(){
  const [selected,setSelected]=useState("A");
  const [font,setFont]=useState("MS Sans Serif");
  const chars = Array.from({length: 224}, (_,i)=> String.fromCharCode(32+i));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
        <span style={{fontSize:11}}>Font:</span>
        <select value={font} onChange={e=>setFont(e.target.value)} style={{ fontSize:11, flex:1 }}>
          <option>MS Sans Serif</option><option>Courier New</option><option>Times New Roman</option><option>Wingdings</option>
        </select>
        <Button size="sm" onClick={()=> navigator.clipboard?.writeText(selected)}>Copy</Button>
      </div>
      <Frame variant="well" style={{ background:"#fff", padding:4, maxHeight:200, overflow:"auto", display:"grid", gridTemplateColumns:"repeat(16, 1fr)", gap:1 }}>
        {chars.map(c=>(
          <div key={c} onClick={()=>setSelected(c)} style={{ width:22, height:22, display:"grid", placeItems:"center", border: selected===c?"1px solid #000080":"1px solid #c0c0c0", background: selected===c?"#000080":"#fff", color: selected===c?"#fff":"#000", cursor:"url('/cursors/hand.png') 12 0, pointer", fontFamily:font, fontSize:14 }}>
            {c}
          </div>
        ))}
      </Frame>
      <Fieldset label="Selected">
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <div style={{ width:48, height:48, border:"2px inset #fff", background:"#fff", display:"grid", placeItems:"center", fontSize:28, fontFamily:font }}>{selected}</div>
          <div style={{ fontSize:11 }}>
            <div>Character: {selected} (U+{selected.charCodeAt(0).toString(16).toUpperCase().padStart(4,"0")})</div>
            <div style={{ marginTop:4, display:"flex", gap:4, alignItems:"center" }}>
              <span>To copy:</span>
              <TextInput value={selected} readOnly width={30} style={{ textAlign:"center" }} />
              <Button size="sm" onClick={()=>{ const v=selected; navigator.clipboard?.writeText(v); }}>Select & Copy</Button>
            </div>
          </div>
        </div>
      </Fieldset>
      <div style={{ fontSize:10, color:"#808080" }}>Click a character, then Copy. Paste into Notepad/WordPad.</div>
    </div>
  );
}
