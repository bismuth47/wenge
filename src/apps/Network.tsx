import { useState } from "react";
import { Button, Frame } from "react95";
import { ICONS } from "../assets/icons";
import { showInfo } from "../components/SystemDialog";

type Pc={name:string,ip:string,online:boolean};

export function NetworkApp(){
  const [pcs]=useState<Pc[]>([
    {name:"WENGE-PC", ip:"192.168.1.10", online:true},
    {name:"LAB-PC", ip:"192.168.1.11", online:true},
    {name:"PRINT-SRV", ip:"192.168.1.5", online:false},
  ]);
  const [selected,setSelected]=useState<string>("WENGE-PC");
  const [pingLog,setPingLog]=useState<string[]>([]);
  const [pinging,setPinging]=useState(false);
  const doPing=(ip:string)=>{
    if(pinging) return;
    setPinging(true); setPingLog([`Pinging ${ip} with 32 bytes of data:`]);
    let n=0;
    const id=window.setInterval(()=>{
      n++;
      const ms=1+Math.floor(Math.random()*8);
      setPingLog((l)=>[...l, `Reply from ${ip}: bytes=32 time=${ms}ms TTL=128`]);
      if(n>=4){ window.clearInterval(id); setPingLog((l)=>[...l, ``, `Ping statistics: Sent=4, Received=4, Lost=0`]); setPinging(false); }
    },450);
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ fontSize:11, background:"#000080", color:"#fff", padding:"3px 6px" }}>Network Neighborhood</div>
      <div style={{ display:"flex", gap:6 }}>
        <Frame variant="well" style={{ width:150, background:"#fff", padding:4 }}>
          {pcs.map(pc=>(
            <div key={pc.name} onClick={()=>setSelected(pc.name)} style={{ padding:"4px 6px", display:"flex", alignItems:"center", gap:6, background: selected===pc.name?"#000080":"transparent", color: selected===pc.name?"#fff":"#000", cursor:"pointer", fontSize:11 }}>
              <img src={ICONS.myComputer} width={16} height={16} style={{imageRendering:"pixelated" as const}} alt="" />
              {pc.name} {pc.online?"●":"○"}
            </div>
          ))}
        </Frame>
        <Frame variant="well" style={{ flex:1, background:"#fff", padding:8, fontSize:11 }}>
          {pcs.find(p=>p.name===selected) ? (()=>{ const pc=pcs.find(p=>p.name===selected)!; return (
            <div>
              <div>Computer: {pc.name}</div>
              <div>IP: {pc.ip}</div>
              <div>Status: {pc.online?"Online":"Offline"}</div>
              <div style={{ marginTop:8, display:"flex", gap:6 }}>
                <Button size="sm" disabled={!pc.online} onClick={()=>showInfo(pc.name, `\\\\${pc.name}\\C$\n\\\\${pc.name}\\Printers\n\nShared folders (mock).`)}>Open</Button>
                <Button size="sm" disabled={!pc.online||pinging} onClick={()=>doPing(pc.ip)}>Ping</Button>
              </div>
              <div style={{ marginTop:8, fontSize:10, color:"#808080" }}>Shared: C$ , Printers</div>
              {pingLog.length>0 && <Frame variant="well" style={{ marginTop:8, background:"#000", color:"#00ff00", fontFamily:"monospace", fontSize:10, padding:6, maxHeight:100, overflow:"auto" }}>{pingLog.map((l,i)=><div key={i}>{l||" "}</div>)}</Frame>}
            </div>
          );})() : null}
        </Frame>
      </div>
      <div style={{ fontSize:10, color:"#808080" }}>Network Neighborhood - Browse network computers (mock).</div>
    </div>
  );
}
