import { useState } from "react";
import { Button, Frame, TextInput } from "react95";

const FILES=[
  {name:"README.TXT", path:"C:\\WENGE\\README.TXT", size:"2 KB"},
  {name:"WIN.COM", path:"C:\\WINDOWS\\WIN.COM", size:"45 KB"},
  {name:"NOTEPAD.EXE", path:"C:\\WINDOWS\\NOTEPAD.EXE", size:"32 KB"},
  {name:"CALC.EXE", path:"C:\\WINDOWS\\CALC.EXE", size:"18 KB"},
  {name:"MPLAYER.EXE", path:"C:\\WINDOWS\\MPLAYER.EXE", size:"88 KB"},
  {name:"SOL.EXE", path:"C:\\WINDOWS\\SOL.EXE", size:"120 KB"},
];

export function FindApp(){
  const [q,setQ]=useState("");
  const [results,setResults]=useState<typeof FILES>([]);
  const [searched,setSearched]=useState(false);
  const search=()=>{
    const r=FILES.filter(f=> f.name.toLowerCase().includes(q.toLowerCase()) || f.path.toLowerCase().includes(q.toLowerCase()));
    setResults(r); setSearched(true);
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ display:"flex", gap:4, alignItems:"center" }}>
        <span style={{fontSize:11, width:80}}>Named:</span>
        <TextInput value={q} onChange={e=>setQ(e.target.value)} placeholder="e.g. notepad, readme" style={{ flex:1 }} onKeyDown={e=> e.key==="Enter"&&search()} />
        <Button size="sm" onClick={search}>Find Now</Button>
        <Button size="sm" onClick={()=>{setQ("");setResults([]);setSearched(false);}}>New Search</Button>
      </div>
      <div style={{ fontSize:10, color:"#808080" }}>Look in: C:\ (Include subfolders)  · Case insensitive</div>
      <Frame variant="well" style={{ background:"#fff", padding:4, height:160, overflow:"auto" }}>
        {!searched? <div style={{ fontSize:11, color:"#808080", padding:20, textAlign:"center" }}>Enter a file name and press Find Now</div> :
         results.length===0? <div style={{ fontSize:11, padding:12 }}>No files found matching "{q}"</div> :
         <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse" }}>
           <thead><tr style={{ background:"#c0c0c0" }}><th style={{textAlign:"left",padding:3}}>Name</th><th style={{textAlign:"left",padding:3}}>Location</th><th>Size</th></tr></thead>
           <tbody>{results.map(f=> <tr key={f.name} style={{ borderTop:"1px solid #c0c0c0" }}><td style={{padding:3}}>{f.name}</td><td style={{padding:3}}>{f.path}</td><td style={{textAlign:"center"}}>{f.size}</td></tr>)}</tbody>
         </table>
        }
      </Frame>
      <div style={{ fontSize:11 }}>{searched? `${results.length} file(s) found` : "Ready"}</div>
    </div>
  );
}
