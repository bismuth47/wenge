import { useEffect, useState } from "react";
import { Button, Fieldset } from "react95";

export function ClockApp(){
  const [now,setNow]=useState(new Date());
  const [analog,setAnalog]=useState(true);
  useEffect(()=>{ const id=setInterval(()=>setNow(new Date()),1000); return()=>clearInterval(id); },[]);
  const h=now.getHours()%12, m=now.getMinutes(), s=now.getSeconds();
  const deg=(v:number,max:number)=>v/max*360;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"center" }}>
      <Fieldset label={analog?"Analog":"Digital"} style={{ width:220, display:"grid", placeItems:"center", padding:12 }}>
        {analog ? (
          <div style={{ width:160, height:160, border:"2px solid #000", borderRadius:"50%", position:"relative", background:"#fff" }}>
            {[12,3,6,9].map(n=> <div key={n} style={{ position:"absolute", fontSize:12, fontWeight:"bold", left: n===3?140:n===9?12:n===12?74:74, top: n===12?6:n===6?140:n===3?74:74 }}>{n}</div>)}
            <div style={{ position:"absolute", left:79, top:20, width:2, height:60, background:"#000080", transformOrigin:"bottom center", transform:`rotate(${deg(h+m/60,12)}deg)` }} />
            <div style={{ position:"absolute", left:79, top:10, width:2, height:70, background:"#000", transformOrigin:"bottom center", transform:`rotate(${deg(m,60)}deg)` }} />
            <div style={{ position:"absolute", left:80, top:15, width:1, height:65, background:"#ff0000", transformOrigin:"bottom center", transform:`rotate(${deg(s,60)}deg)` }} />
            <div style={{ position:"absolute", left:77, top:77, width:6, height:6, background:"#000", borderRadius:"50%" }} />
          </div>
        ) : (
          <div style={{ fontFamily:"monospace", fontSize:28, background:"#000", color:"#00ff00", padding:"8px 16px", border:"2px inset #fff" }}>
            {now.toLocaleTimeString()}
          </div>
        )}
      </Fieldset>
      <div style={{ fontSize:12 }}>{now.toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
      <div style={{ display:"flex", gap:6 }}>
        <Button size="sm" onClick={()=>setAnalog(!analog)}>{analog?"Digital":"Analog"}</Button>
        <Button size="sm" onClick={()=>setNow(new Date())}>Refresh</Button>
      </div>
    </div>
  );
}
