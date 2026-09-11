import { useState } from "react";
import { Button, Frame } from "react95";

type Card={s:"♠"|"♥"|"♦"|"♣";r:number;id:number};
const SUITS:Card["s"][]=["♠","♥","♦","♣"];
const RANKS=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
function deck():Card[]{ let id=0; const d:Card[]=[]; for(const s of SUITS) for(let r=1;r<=13;r++) d.push({s,r,id:id++}); for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; } return d;}
function isRed(s:Card["s"]){return s==="♥"||s==="♦";}

export function FreeCellApp(){
  const [cols,setCols]=useState<Card[][]>(()=>{ const d=deck(); const c:Card[][]=Array.from({length:8},()=>[]); d.forEach((card,i)=> c[i%8].push(card)); return c; });
  const [free,setFree]=useState<(Card|null)[]>([null,null,null,null]);
  const [found,setFound]=useState<Record<string,Card[]>>({"♠":[], "♥":[], "♦":[], "♣":[]});
  const [sel,setSel]=useState<{col:number,idx:number}|{free:number}|null>(null);

  const selectCol=(col:number, idx:number)=>{
    if(sel && "col" in sel && sel.col===col && sel.idx===idx){ setSel(null); return; }
    setSel({col,idx});
  };
  const moveToFree=()=>{
    if(!sel||!("col" in sel)) return;
    const empty=free.findIndex(f=>f===null);
    if(empty===-1) return;
    const col=cols[sel.col];
    if(sel.idx!==col.length-1) return;
    const card=col[col.length-1];
    setCols(cs=>{ const n=cs.map(a=>[...a]); n[sel.col]=n[sel.col].slice(0,-1); return n; });
    setFree(f=>{ const n=[...f]; n[empty]=card; return n; });
    setSel(null);
  };
  const moveToFoundation=()=>{
    let card:Card|null=null;
    let source: any=null;
    if(sel && "col" in sel){ const col=cols[sel.col]; if(sel.idx===col.length-1) {card=col[col.length-1]; source={col:sel.col};} }
    else if(sel && "free" in sel){ card=free[sel.free]; source={free:sel.free}; }
    if(!card) return;
    const f=found[card.s];
    const can= f.length===0? card.r===1 : f[f.length-1].r+1===card.r;
    if(!can) return;
    if(source.col!==undefined) setCols(cs=>{ const n=cs.map(a=>[...a]); n[source.col]=n[source.col].slice(0,-1); return n; });
    else setFree(ff=>{ const n=[...ff]; n[source.free]=null; return n; });
    setFound(ff=> ({...ff, [card!.s]: [...ff[card!.s], card!]}));
    setSel(null);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"center" }}>
      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
        <Button size="sm" onClick={moveToFree}>→ FreeCell</Button>
        <Button size="sm" onClick={moveToFoundation}>→ Foundation</Button>
        <Button size="sm" onClick={()=>{ const d=deck(); const c:Card[][]=Array.from({length:8},()=>[]); d.forEach((cd,i)=>c[i%8].push(cd)); setCols(c); setFree([null,null,null,null]); setFound({"♠":[], "♥":[], "♦":[], "♣":[]}); setSel(null); }}>New Game</Button>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        {free.map((c,i)=>(
          <Frame key={i} variant="well" style={{ width:50, height:70, background: sel && "free" in sel && sel.free===i ? "#000080":"#c0c0c0", color: sel && "free" in sel && sel.free===i ? "#fff":"#000", display:"grid", placeItems:"center", cursor:"pointer", border: c?"2px solid #000":"2px inset #fff" }} onClick={()=> setSel({free:i})}>
            {c? <span style={{ color:isRed(c.s)?"red":"black" }}>{c.s}{RANKS[c.r-1]}</span> : <span style={{fontSize:10, color:"#808080"}}>Free</span>}
          </Frame>
        ))}
        <div style={{ width:20 }} />
        {SUITS.map(s=>(
          <Frame key={s} variant="well" style={{ width:50, height:70, background:"#c0c0c0", display:"grid", placeItems:"center" }}>
            {found[s].length? <span style={{ color:isRed(s)?"red":"black"}}>{s}{RANKS[found[s][found[s].length-1].r-1]}</span> : <span style={{fontSize:10}}>{s} A</span>}
          </Frame>
        ))}
      </div>
      <div style={{ display:"flex", gap:6, alignItems:"flex-start" }}>
        {cols.map((col,ci)=>(
          <div key={ci} style={{ width:50, display:"flex", flexDirection:"column" }}>
            {col.map((c,idx)=>(
              <Frame key={c.id} variant="well" onClick={()=>selectCol(ci,idx)} style={{ width:50, height:28, marginTop: idx===0?0:-16, background: sel && "col" in sel && sel.col===ci && sel.idx===idx ? "#000080":"#fff", color: sel && "col" in sel && sel.col===ci && sel.idx===idx ? "#fff" : isRed(c.s)?"red":"black", display:"grid", placeItems:"center", fontSize:11, cursor:"pointer", zIndex:idx }}>
                {c.s}{RANKS[c.r-1]}
              </Frame>
            ))}
          </div>
        ))}
      </div>
      <div style={{ fontSize:10, color:"#808080" }}>FreeCell - Select card then → FreeCell / Foundation. No drag yet.</div>
    </div>
  );
}
