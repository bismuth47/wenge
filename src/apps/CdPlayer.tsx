import { useState, useRef } from "react";
import { Button, Frame, Slider } from "react95";

const TRACKS=[ {n:1,t:"02:45"},{n:2,t:"03:12"},{n:3,t:"04:05"},{n:4,t:"03:33"} ];

export function CdPlayerApp(){
  const [track,setTrack]=useState(1);
  const [playing,setPlaying]=useState(false);
  const [pos,setPos]=useState(0);
  const timer=useRef<number|null>(null);
  const toggle=()=>{
    if(playing){ if(timer.current) clearInterval(timer.current); setPlaying(false); }
    else { setPlaying(true); timer.current=window.setInterval(()=> setPos(p=> (p+1)%100), 500); }
  };
  const next=()=> setTrack(t=> Math.min(4, t+1) );
  const prev=()=> setTrack(t=> Math.max(1, t-1) );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"center" }}>
      <Frame variant="well" style={{ width:280, padding:8, background:"#c0c0c0", display:"flex", flexDirection:"column", gap:6 }}>
        <div style={{ display:"flex", gap:6, alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:80, height:80, background:"#000", border:"2px inset #fff", display:"grid", placeItems:"center", color:"#00ff00", fontFamily:"monospace", fontSize:10 }}>
            <div style={{ textAlign:"center" }}>
              <div>Track {track}</div>
              <div style={{ fontSize:14 }}>{playing?"▶":"■"} {TRACKS[track-1].t}</div>
              <div style={{ fontSize:8 }}>{playing?"PLAY":"STOP"}</div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <Button size="sm" onClick={prev}>|◀</Button>
            <Button size="sm" onClick={toggle} style={{ fontWeight:"bold" }}>{playing?"||":"▶"}</Button>
            <Button size="sm" onClick={next}>▶|</Button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <Button size="sm" onClick={()=>setPos(0)}>■</Button>
            <Button size="sm" disabled>⏏</Button>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:10 }}>{String(Math.floor(pos/60)).padStart(2,"0")}:{String(pos%60).padStart(2,"0")}</span>
          <div style={{ flex:1 }}><Slider value={pos} min={0} max={100} onChange={(e:any)=> setPos(Number(e.target.value))} /></div>
          <span style={{ fontSize:10 }}>4 tracks</span>
        </div>
        <div style={{ display:"flex", gap:1, height:10 }}>
          {Array.from({length:20}).map((_,i)=> <div key={i} style={{ flex:1, background: i<pos/5?"#00ff00":"#003300", border:"1px solid #001100" }} />)}
        </div>
      </Frame>
      <div style={{ fontSize:10, color:"#808080" }}>CD Player - Audio CD emulation (Media Player backend)</div>
    </div>
  );
}
