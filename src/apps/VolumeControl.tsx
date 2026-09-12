import { useState, useEffect } from "react";
import { Button, Slider, Checkbox, Frame } from "react95";
import { getSoundEnabled, setSoundEnabled, getVolume, setVolume } from "../hooks/useSound";

export function VolumeControlApp(){
  const [vol,setVol]=useState(()=>getVolume());
  const [muted,setMuted]=useState(()=>!getSoundEnabled());
  useEffect(()=>{
    const onVol=(e:Event)=>setVol((e as CustomEvent<number>).detail);
    const onEn=(e:Event)=>setMuted(!((e as CustomEvent<boolean>).detail));
    window.addEventListener("wenge:volume", onVol);
    window.addEventListener("wenge:sound-enabled", onEn);
    return ()=>{ window.removeEventListener("wenge:volume", onVol); window.removeEventListener("wenge:sound-enabled", onEn); };
  },[]);
  useEffect(()=> setSoundEnabled(!muted), [muted]);
  useEffect(()=>{ setVolume(vol); }, [vol]);
  const test=()=>{
    if(muted) return;
    const a=new Audio("/sounds/chord.wav"); a.volume=(vol/100)*0.9; a.play().catch(()=>{});
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10, alignItems:"center" }}>
      <Frame variant="well" style={{ width:120, padding:12, background:"#c0c0c0", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
        <div style={{ fontSize:11, fontWeight:"bold" }}>Volume</div>
        <div style={{ height:120, display:"flex", alignItems:"center" }}>
          {/* vertical slider simulated with rotate */}
          <div style={{ transform:"rotate(-90deg)", width:100 }}>
            <Slider value={vol} min={0} max={100} onChange={(v: number)=>setVol(Math.max(0, Math.min(100, Math.round(v))))} />
          </div>
        </div>
        <span style={{ fontSize:11 }}>{vol}%</span>
        <Checkbox checked={muted} onChange={()=>setMuted(v=>!v)} label="Mute" value="mute" />
        <Button size="sm" onClick={test} disabled={muted}>Test</Button>
        <div style={{ display:"flex", gap:2, marginTop:6 }}>
          {Array.from({length:10}).map((_,i)=> <div key={i} style={{ width:6, height:8+ i*2, background: muted? "#808080" : i*10 < vol ? "#000080": "#fff", border:"1px solid #808080" }} />)}
        </div>
      </Frame>
      <div style={{ fontSize:10, color:"#808080", textAlign:"center" }}>Adjust system sound volume.<br/>Mute affects all WAV effects.</div>
    </div>
  );
}
