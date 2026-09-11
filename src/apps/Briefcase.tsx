import { useState } from "react";
import { Button, Frame } from "react95";

type Item={name:string,status:"Up to date"|"Needs update"|"Orphan",path:string};

export function BriefcaseApp(){
  const [items,setItems]=useState<Item[]>([
    {name:"Report.doc", status:"Up to date", path:"C:\\WENGE\\Report.doc"},
    {name:"Budget.xls", status:"Needs update", path:"A:\\Budget.xls"},
  ]);
  const updateAll=()=> setItems(items=> items.map(i=> ({...i, status:"Up to date" as const})));
  const add=()=>{
    const name=prompt("File name?");
    if(!name) return;
    setItems([...items,{name, status:"Needs update", path:`C:\\WENGE\\${name}`}]);
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ display:"flex", gap:6 }}>
        <Button size="sm" onClick={updateAll}>Update All</Button>
        <Button size="sm" onClick={add}>Add File...</Button>
        <Button size="sm" onClick={()=> setItems(items=> items.filter(i=> i.status!=="Orphan"))}>Split</Button>
      </div>
      <Frame variant="well" style={{ background:"#fff", padding:4 }}>
        <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse" }}>
          <thead><tr style={{ background:"#000080", color:"#fff" }}><th style={{padding:3, textAlign:"left"}}>Name</th><th>Status</th><th>Location</th></tr></thead>
          <tbody>{items.map((it,i)=> <tr key={i} style={{ borderTop:"1px solid #c0c0c0" }}><td style={{padding:3}}>{it.name}</td><td style={{textAlign:"center", color: it.status==="Needs update"?"#ff0000":"#008000"}}>{it.status}</td><td style={{padding:3}}>{it.path}</td></tr>)}</tbody>
        </table>
        {items.length===0 && <div style={{ padding:12, textAlign:"center", color:"#808080" }}>Briefcase is empty. Drag files here.</div>}
      </Frame>
      <div style={{ fontSize:10, color:"#808080" }}>Briefcase - Keeps files in sync between computers. Orphan = original deleted.</div>
    </div>
  );
}
