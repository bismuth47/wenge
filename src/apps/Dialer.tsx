import { useState } from "react";
import { Button, Frame, TextInput } from "react95";

export function DialerApp(){
  const [num,setNum]=useState("");
  const [status,setStatus]=useState("Idle");
  const press=(d:string)=> setNum(n=> n+d);
  const dial=()=>{
    if(!num){ setStatus("Enter a number"); return; }
    setStatus(`Dialing ${num}...`);
    setTimeout(()=> setStatus(`Connected to ${num}`), 1200);
  };
  const hang=()=>{ setStatus("Idle"); setNum(""); };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"center" }}>
      <Frame variant="well" style={{ width:200, padding:8, background:"#c0c0c0", display:"flex", flexDirection:"column", gap:6, alignItems:"center" }}>
        <TextInput value={num} onChange={e=>setNum(e.target.value)} placeholder="Phone number" style={{ width:"100%" }} />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 50px)", gap:6 }}>
          {["1","2","3","4","5","6","7","8","9","*","0","#"].map(k=>(
            <Button key={k} onClick={()=>press(k)} style={{ height:32 }}>{k}</Button>
          ))}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <Button size="sm" onClick={dial}>Dial</Button>
          <Button size="sm" onClick={hang}>Hang Up</Button>
          <Button size="sm" onClick={()=>setNum("")}>Clear</Button>
        </div>
        <div style={{ fontSize:11, background:"#000", color:"#00ff00", padding:"4px 8px", width:"100%", textAlign:"center", fontFamily:"monospace" }}>{status}</div>
      </Frame>
      <div style={{ fontSize:10, color:"#808080" }}>Phone Dialer - Uses modem (mock). Dial any number.</div>
    </div>
  );
}
