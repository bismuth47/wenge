import { useRef, useState, useEffect } from "react";
import { Button, Frame, ProgressBar } from "react95";

export function SoundRecorderApp(){
  const [recording,setRecording]=useState(false);
  const [playing,setPlaying]=useState(false);
  const [secs,setSecs]=useState(0);
  const [hasAudio,setHasAudio]=useState(false);
  const mediaRef=useRef<MediaRecorder|null>(null);
  const chunksRef=useRef<Blob[]>([]);
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const urlRef=useRef<string|null>(null);
  const timerRef=useRef<number|null>(null);

  const startRec=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mr=new MediaRecorder(stream);
      chunksRef.current=[];
      mr.ondataavailable=e=>{ if(e.data.size>0) chunksRef.current.push(e.data); };
      mr.onstop=()=>{ const blob=new Blob(chunksRef.current,{type:"audio/wav"}); if(urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current=URL.createObjectURL(blob); if(audioRef.current) audioRef.current.src=urlRef.current; setHasAudio(true); stream.getTracks().forEach(t=>t.stop()); };
      mr.start();
      mediaRef.current=mr;
      setRecording(true); setSecs(0);
      timerRef.current=window.setInterval(()=>setSecs(s=>s+1),1000);
    }catch{ alert("Microphone permission denied or not available"); }
  };
  const stopRec=()=>{
    mediaRef.current?.stop();
    setRecording(false);
    if(timerRef.current) clearInterval(timerRef.current);
  };
  const play=()=>{
    if(!audioRef.current) return;
    audioRef.current.currentTime=0;
    audioRef.current.play(); setPlaying(true);
    audioRef.current.onended=()=>setPlaying(false);
  };
  const save=()=>{
    if(!urlRef.current) return;
    const a=document.createElement("a"); a.href=urlRef.current; a.download=`recording-${Date.now()}.wav`; a.click();
  };
  useEffect(()=>()=>{ if(timerRef.current) clearInterval(timerRef.current); if(urlRef.current) URL.revokeObjectURL(urlRef.current); },[]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <Frame variant="well" style={{ background:"#c0c0c0", padding:8, display:"flex", flexDirection:"column", gap:8, alignItems:"center" }}>
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          <div style={{ width:12, height:12, background: recording?"#ff0000":"#808080", borderRadius:"50%", border:"1px solid #000", animation: recording?"blink 0.8s step-end infinite":"none" }} />
          <span style={{ fontFamily:"monospace", fontSize:14 }}>{String(Math.floor(secs/60)).padStart(2,"0")}:{String(secs%60).padStart(2,"0")}</span>
          <span style={{ fontSize:11, color:"#808080" }}>{recording?"Recording...":hasAudio?"Ready": "Idle"}</span>
        </div>
        <div style={{ display:"flex", gap:6, width:"100%", justifyContent:"center", flexWrap:"nowrap" }}>
            {!recording ? <Button onClick={startRec} size="sm" style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}>● Record</Button> : <Button onClick={stopRec} size="sm" style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}>■ Stop</Button>}
            <Button size="sm" disabled={!hasAudio||recording} onClick={play} style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}>{playing?"Playing...":"▶ Play"}</Button>
            <Button size="sm" disabled={!hasAudio} onClick={save} style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}>Save As...</Button>
          </div>
        <div style={{ width:"100%", height:40, background:"#000", border:"2px inset #fff", display:"flex", alignItems:"center", justifyContent:"center", gap:1 }}>
          {Array.from({length:30}).map((_,i)=> <div key={i} style={{ width:2, height: recording? 6+Math.random()*20 : hasAudio? 8+Math.sin(i+secs)*6 : 4, background: recording?"#00ff00": hasAudio?"#ffff00":"#003300" }} /> )}
        </div>
        <ProgressBar value={Math.min(100, secs*4)} style={{ width:"100%", height:10 }} />
        <audio ref={audioRef} hidden />
      </Frame>
      <div style={{ fontSize:11, display:"flex", gap:6, flexWrap:"wrap" }}>
        <Button size="sm" onClick={()=>{ setHasAudio(false); setSecs(0); if(urlRef.current){ URL.revokeObjectURL(urlRef.current); urlRef.current=null; } if(audioRef.current) audioRef.current.src=""; }}>New</Button>
        <span style={{ fontSize:10, color:"#808080" }}>Uses microphone. Grant permission to record. Save as WAV.</span>
      </div>
      <style>{`@keyframes blink{50%{opacity:0}}`}</style>
    </div>
  );
}
