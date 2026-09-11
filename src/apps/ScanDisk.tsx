import { useState } from "react";
import { Button, Frame, ProgressBar, Radio, Checkbox } from "react95";

export function ScanDiskApp(){
  const [drive,setDrive]=useState("C:");
  const [type,setType]=useState("standard");
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState(0);
  const [log,setLog]=useState<string[]>([]);
  const start=()=>{
    setRunning(true); setProgress(0); setLog(["ScanDisk: Checking drive "+drive,""]);
    let v=0;
    const phases=["Checking file allocation table","Checking directories","Checking for lost clusters","Verifying free space"];
    let phaseIdx=0;
    const id=setInterval(()=>{
      v+= Math.random()*14;
      if(v>=100){ v=100; clearInterval(id); setRunning(false); setLog(l=>[...l,"","No errors found.","Scan complete."]); }
      else if(v> (phaseIdx+1)*25){ setLog(l=>[...l, `✓ ${phases[phaseIdx]} - OK`]); phaseIdx++; }
      setProgress(Math.floor(v));
    },400);
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <span style={{fontSize:11}}>Drive:</span>
        <select value={drive} onChange={e=>setDrive(e.target.value)} style={{ fontSize:11 }}>
          <option>C:</option><option>A:</option><option>D:</option>
        </select>
        <Radio checked={type==="standard"} onChange={()=>setType("standard")} value="standard" label="Standard" name="scan" />
        <Radio checked={type==="thorough"} onChange={()=>setType("thorough")} value="thorough" label="Thorough" name="scan" />
      </div>
      <Frame variant="well" style={{ background:"#fff", padding:6, height:140, overflow:"auto", fontFamily:"monospace", fontSize:11 }}>
        {log.length===0? <div style={{color:"#808080"}}>Ready to scan {drive}</div> : log.map((l,i)=><div key={i}>{l||"\u00A0"}</div>)}
        {running && <ProgressBar value={progress} style={{ marginTop:6 }} />}
      </Frame>
      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
        <Button size="sm" onClick={start} disabled={running}>Start</Button>
        <Button size="sm" onClick={()=>{setRunning(false); setProgress(0); setLog([]);}}>Close</Button>
        <Checkbox checked label="Automatically fix errors" value="fix" />
      </div>
      <div style={{ fontSize:10, color:"#808080" }}>ScanDisk - Checks and repairs drive errors</div>
    </div>
  );
}
