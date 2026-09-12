import { useEffect, useRef, useState } from "react";
import { Button, Frame, ProgressBar, Select, Checkbox } from "react95";

export function BackupApp(){
  const [step,setStep]=useState(0);
  const [progress,setProgress]=useState(0);
  const [drive,setDrive]=useState("C:");
  const [tape,setTape]=useState("A:");
  const [verify,setVerify]=useState(true);
  const [compress,setCompress]=useState(false);
  const timer=useRef<number|null>(null);
  useEffect(()=>()=>{ if(timer.current) clearInterval(timer.current); },[]);
  const start=()=>{
    if(timer.current) clearInterval(timer.current);
    setStep(1); setProgress(0);
    let v=0;
    timer.current=window.setInterval(()=>{ v+= Math.random()*18; if(v>=100){ v=100; if(timer.current) clearInterval(timer.current); timer.current=null; setStep(2); } setProgress(Math.floor(v)); }, 300);
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
        <span style={{fontSize:11}}>Backup from:</span>
        <Select width={80} value={drive} onChange={(e:any)=>setDrive(e.target.value)} options={[{value:"C:",label:"C:"},{value:"A:",label:"A:"}]} />
        <span style={{fontSize:11}}>To:</span>
        <Select width={80} value={tape} onChange={(e:any)=>setTape(e.target.value)} options={[{value:"A:",label:"A: Tape"},{value:"D:",label:"D: CD"}]} />
        <Button size="sm" onClick={start} disabled={step===1}>Start Backup</Button>
        <Button size="sm" onClick={()=>{setStep(0);setProgress(0);}}>Reset</Button>
      </div>
      <Frame variant="well" style={{ padding:8, background:"#fff" }}>
        {step===0 && <div style={{ fontSize:11 }}>Select drives and press Start Backup.<br/>Files will be compressed to tape.</div>}
        {step===1 && <div style={{ display:"flex", flexDirection:"column", gap:6 }}><div style={{ fontSize:11 }}>Backing up {drive} → {tape} ... {progress}%</div><ProgressBar value={progress} /></div>}
        {step===2 && <div style={{ fontSize:11, color:"#000080" }}>✓ Backup complete. {Math.floor(progress*1.2)} files, 12.4 MB written.<br/>Verify: {verify?"OK":"Skipped"}. Compress: {compress?"ON":"OFF"}. Log: C:\BACKUP.LOG</div>}
      </Frame>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <Checkbox checked={verify} onChange={()=>setVerify(v=>!v)} label="Verify after backup" value="verify" />
        <Checkbox checked={compress} onChange={()=>setCompress(v=>!v)} label="Compress" value="compress" />
      </div>
      <div style={{ fontSize:10, color:"#808080" }}>Microsoft Backup - Wenge 95</div>
    </div>
  );
}
