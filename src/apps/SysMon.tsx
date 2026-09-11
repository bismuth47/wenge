import { useEffect, useRef, useState } from "react";
import { Frame } from "react95";

export function SysMonApp(){
  const [cpu,setCpu]=useState<number[]>(Array.from({length:60},()=>20));
  const [mem,setMem]=useState<number[]>(Array.from({length:60},()=>40));
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const id=setInterval(()=>{
      setCpu(c=>[...c.slice(1), 15+Math.random()*70+Math.sin(Date.now()/800)*10]);
      setMem(m=>[...m.slice(1), 35+Math.random()*30]);
    },500);
    return()=>clearInterval(id);
  },[]);
  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const ctx=canvas.getContext("2d")!; ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#000"; ctx.fillRect(0,0,canvas.width,canvas.height);
    // grid
    ctx.strokeStyle="#003300"; ctx.lineWidth=1;
    for(let x=0;x<canvas.width;x+=40){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for(let y=0;y<canvas.height;y+=20){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
    // cpu line
    ctx.strokeStyle="#00ff00"; ctx.beginPath(); cpu.forEach((v,i)=>{ const x=i/cpu.length*canvas.width; const y=canvas.height - v/cpu.length*80 -20; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
    // mem line
    ctx.strokeStyle="#ffff00"; ctx.beginPath(); mem.forEach((v,i)=>{ const x=i/mem.length*canvas.width; const y=canvas.height - v/100*60 -10; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
  },[cpu,mem]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <Frame variant="well" style={{ padding:2, background:"#000" }}>
        <canvas ref={ref} width={460} height={120} style={{ width:"100%", imageRendering:"pixelated" as const }} />
      </Frame>
      <div style={{ display:"flex", gap:12, fontSize:11 }}>
        <span style={{ color:"#00ff00" }}>● CPU: {Math.floor(cpu[cpu.length-1])}%</span>
        <span style={{ color:"#ffff00" }}>● Memory: {Math.floor(mem[mem.length-1])}%</span>
        <span style={{ marginLeft:"auto", fontSize:10, color:"#808080" }}>Wenge System Monitor - Updates every 0.5s</span>
      </div>
      <div style={{ fontSize:10, color:"#808080" }}>File / Edit / View / Help - Kernel usage real-time</div>
    </div>
  );
}
