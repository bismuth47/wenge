import { useState } from "react";
import { Button, Fieldset, Select, Frame } from "react95";

export function WordPadApp() {
  const [text, setText] = useState("Welcome to WordPad!\n\nThis is a rich text editor mock.\n- Bold / Italic / Underline toggle works on selection.");
  const [font, setFont] = useState("MS Sans Serif");
  const [size, setSize] = useState("10");
  const [style, setStyle] = useState({ bold: false, italic: false, underline: false });
  const [color, setColor] = useState("#000000");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%" }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid #808080", paddingBottom: 4 }}>
        <Select width={140} value={font} onChange={(e:any)=>setFont(e.target.value)} options={[{value:"MS Sans Serif",label:"MS Sans Serif"},{value:"Courier New",label:"Courier New"},{value:"Times New Roman",label:"Times New Roman"}]} />
        <Select width={60} value={size} onChange={(e:any)=>setSize(e.target.value)} options={[{value:"8",label:"8"},{value:"10",label:"10"},{value:"12",label:"12"},{value:"14",label:"14"}]} />
        <Button size="sm" active={style.bold} onClick={()=>setStyle(s=>({...s,bold:!s.bold}))} style={{fontWeight:"bold"}}>B</Button>
        <Button size="sm" active={style.italic} onClick={()=>setStyle(s=>({...s,italic:!s.italic}))} style={{fontStyle:"italic"}}>I</Button>
        <Button size="sm" active={style.underline} onClick={()=>setStyle(s=>({...s,underline:!s.underline}))} style={{textDecoration:"underline"}}>U</Button>
        <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{width:24,height:24}} />
        <Button size="sm" onClick={()=>{const blob=new Blob([text],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="document.txt";a.click();URL.revokeObjectURL(url);}}>Save</Button>
        <Button size="sm" onClick={()=>setText("")}>New</Button>
      </div>
      <Frame variant="well" style={{ flex:1, padding:2, background:"#fff" }}>
        <textarea
          value={text}
          onChange={e=>setText(e.target.value)}
          style={{
            width:"100%", height:220, border:"none", outline:"none", resize:"none",
            fontFamily: font, fontSize: `${size}pt`, color,
            fontWeight: style.bold?"bold":"normal",
            fontStyle: style.italic?"italic":"normal",
            textDecoration: style.underline?"underline":"none",
          }}
        />
      </Frame>
      <div style={{ fontSize:11, display:"flex", justifyContent:"space-between" }}>
        <span>Chars: {text.length} | Words: {text.trim()?text.trim().split(/\s+/).length:0}</span>
        <Fieldset label="" style={{padding:"2px 6px", fontSize:10}}>WordPad - Wenge</Fieldset>
      </div>
    </div>
  );
}
