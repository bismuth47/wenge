import { useState } from "react";
import { Button, Frame, TextInput } from "react95";
import { showInfo } from "../components/SystemDialog";

type Item={name:string,status:"Up to date"|"Needs update"|"Orphan",path:string};

export function BriefcaseApp(){
  const [items,setItems]=useState<Item[]>([
    {name:"Report.doc", status:"Up to date", path:"C:\\WENGE\\Report.doc"},
    {name:"Budget.xls", status:"Needs update", path:"A:\\Budget.xls"},
  ]);
  const [selected,setSelected]=useState<number|null>(null);
  const [nameInput,setNameInput]=useState("");
  const [adding,setAdding]=useState(false);
  const updateAll=()=> setItems(items=> items.map(i=> ({...i, status:"Up to date" as const})));
  const add=()=>{
    const name=nameInput.trim();
    if(!name) return;
    setItems([...items,{name, status:"Needs update", path:`C:\\WENGE\\${name}`}]);
    setNameInput(""); setAdding(false);
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        <Button size="sm" onClick={updateAll}>Update All</Button>
        <Button size="sm" onClick={()=>setAdding(v=>!v)}>Add File...</Button>
        <Button size="sm" disabled={selected===null} onClick={()=>{ if(selected!==null) setItems(items=> items.map((it,i)=> i===selected?{...it,status:"Orphan" as const}:it)); }}>Split</Button>
        <Button size="sm" disabled={selected===null} onClick={()=>{ if(selected===null) return; const it=items[selected]; if(it) showInfo(it.name, `${it.name}\nStatus: ${it.status}\nLocation: ${it.path}`); }}>Details</Button>
      </div>
      {adding && (
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          <TextInput value={nameInput} onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") add(); }} placeholder="File name e.g. Memo.txt" style={{ flex:1 }} />
          <Button size="sm" onClick={add} disabled={!nameInput.trim()}>Add</Button>
          <Button size="sm" onClick={()=>{setAdding(false); setNameInput("");}}>Cancel</Button>
        </div>
      )}
      <Frame variant="well" style={{ background:"#fff", padding:4 }}>
        <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse" }}>
          <thead><tr style={{ background:"#000080", color:"#fff" }}><th style={{padding:3, textAlign:"left"}}>Name</th><th>Status</th><th>Location</th></tr></thead>
          <tbody>{items.map((it,i)=> <tr key={i} onClick={()=>setSelected(i)} style={{ borderTop:"1px solid #c0c0c0", background: selected===i?"#000080":"transparent", color: selected===i?"#fff":"#000", cursor:"url('/cursors/hand.png') 12 0, pointer" }}><td style={{padding:3}}>{it.name}</td><td style={{textAlign:"center", color: selected===i?"#fff":(it.status==="Needs update"?"#ff0000":it.status==="Orphan"?"#808080":"#008000")}}>{it.status}</td><td style={{padding:3}}>{it.path}</td></tr>)}</tbody>
        </table>
        {items.length===0 && <div style={{ padding:12, textAlign:"center", color:"#808080" }}>Briefcase is empty. Drag files here.</div>}
      </Frame>
      <div style={{ fontSize:10, color:"#808080" }}>Briefcase - Keeps files in sync between computers. Orphan = original deleted.</div>
    </div>
  );
}
