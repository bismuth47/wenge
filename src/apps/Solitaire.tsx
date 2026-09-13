import { useState } from "react";
import { Button, Frame } from "react95";

type Card = { s:"♠"|"♥"|"♦"|"♣"; r:number; face:boolean; id:number };
const SUITS: Card["s"][]=["♠","♥","♦","♣"];
const RANKS=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function newDeck():Card[]{
  let id=0;
  const d:Card[]=[];
  for(const s of SUITS) for(let r=1;r<=13;r++) d.push({s,r,face:false,id:id++});
  for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
  return d;
}
function isRed(s:Card["s"]){ return s==="♥"||s==="♦"; }

export function SolitaireApp(){
  const [piles,setPiles]=useState<Card[][]>(()=>{
    const deck=newDeck();
    const p:Card[][]=Array.from({length:7},()=>[]);
    let idx=0;
    for(let i=0;i<7;i++) for(let j=0;j<=i;j++){ const c=deck[idx++]; c.face = j===i; p[i].push(c); }
    return p;
  });
  const [stock,setStock]=useState<Card[]>(()=> newDeck().slice(28));
  const [waste,setWaste]=useState<Card[]>([]);
  const [foundations,setFoundations]=useState<Record<string,Card[]>>({ "♠":[], "♥":[], "♦":[], "♣":[] });
  const [moves,setMoves]=useState(0);

  const draw=()=>{
    if(stock.length===0){ setStock([...waste.reverse().map(c=>({...c,face:false}))]); setWaste([]); return; }
    const c=stock[stock.length-1]; c.face=true;
    setStock(s=>s.slice(0,-1)); setWaste(w=>[...w,c]); setMoves(m=>m+1);
  };
  const canToFoundation=(c:Card, f:Card[])=>{
    if(f.length===0) return c.r===1;
    const top=f[f.length-1]; return c.s===top.s && c.r===top.r+1;
  };
  const autoToFoundation=()=>{
    // try waste top
    const wTop=waste[waste.length-1];
    if(wTop && canToFoundation(wTop, foundations[wTop.s])){ setWaste(w=>w.slice(0,-1)); setFoundations(f=>({...f,[wTop.s]:[...f[wTop.s],wTop]})); setMoves(m=>m+1); return; }
    // try pile tops
    piles.forEach((pile,i)=>{
      const top=pile[pile.length-1];
      if(top?.face && canToFoundation(top, foundations[top.s])){
        setPiles(p=>{ const n=p.map(a=>[...a]); n[i]=n[i].slice(0,-1); if(n[i].length) n[i][n[i].length-1].face=true; return n; });
        setFoundations(f=>({...f,[top.s]:[...f[top.s],top]})); setMoves(m=>m+1);
      }
    });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"center" }}>
      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
        <Button size="sm" onClick={draw}>Draw</Button>
        <Button size="sm" onClick={autoToFoundation}>Auto → Foundation</Button>
        <Button size="sm" onClick={()=>{ setPiles(()=>{ const d=newDeck(); const p:Card[][]=Array.from({length:7},()=>[]); let k=0; for(let i=0;i<7;i++) for(let j=0;j<=i;j++){ const c=d[k++]; c.face=j===i; p[i].push(c);} return p; }); setStock(newDeck().slice(28)); setWaste([]); setFoundations({ "♠":[], "♥":[], "♦":[], "♣":[] }); setMoves(0); }}>New Game</Button>
        <span style={{ fontSize:11 }}>Moves: {moves}</span>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <div style={{ display:"flex", gap:6 }}>
          <Frame variant="well" style={{ width:50, height:70, background:"#008080", display:"grid", placeItems:"center", cursor:"url('/cursors/hand.png') 12 0, pointer" }} onClick={draw}>
            <div style={{ fontSize:10, color:"#fff" }}>{stock.length} left</div>
          </Frame>
          <Frame variant="well" style={{ width:50, height:70, background:"#fff", display:"grid", placeItems:"center" }}>
            {waste.length? <div style={{ fontSize:14, color: isRed(waste[waste.length-1].s)?"red":"black" }}>{waste[waste.length-1].s} {RANKS[waste[waste.length-1].r-1]}</div> : <span style={{fontSize:10}}>Empty</span>}
          </Frame>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {SUITS.map(s=>(
            <Frame key={s} variant="well" style={{ width:50, height:70, background:"#c0c0c0", display:"grid", placeItems:"center" }}>
              {foundations[s].length? <div style={{ color:isRed(s)?"red":"black" }}>{s} {RANKS[foundations[s][foundations[s].length-1].r-1]}</div> : <span style={{fontSize:12, color:"#808080"}}>{s} A</span>}
            </Frame>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:6, alignItems:"flex-start" }}>
        {piles.map((pile,pi)=>(
          <div key={pi} style={{ width:50, minHeight:90, display:"flex", flexDirection:"column" }}>
            {pile.map((c,idx)=>(
              <Frame key={c.id} variant="well" style={{ width:50, height:22, marginTop: idx===0?0:-12, background: c.face?"#fff":"#000080", color: c.face? (isRed(c.s)?"red":"black"):"#fff", display:"grid", placeItems:"center", fontSize:11, zIndex:idx }}>
                {c.face? `${c.s} ${RANKS[c.r-1]}` : "░░░"}
              </Frame>
            ))}
            {pile.length===0 && <Frame variant="well" style={{ width:50, height:70, background:"#008080" }} />}
          </div>
        ))}
      </div>
      <div style={{ fontSize:10, color:"#808080" }}>Klondike Solitaire - Draw & Auto Foundation playable. Full drag coming soon.</div>
    </div>
  );
}
