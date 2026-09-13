import { useState } from "react";
import { Button, Frame } from "react95";

type Card={s:"♠"|"♥"|"♦"|"♣";r:number;id:number};
const SUITS:Card["s"][]=["♠","♥","♦","♣"];
const RANKS=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
function deck():Card[]{ let id=0; const d:Card[]=[]; for(const s of SUITS) for(let r=0;r<13;r++) d.push({s,r,id:id++}); for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; } return d;}
function isHeart(c:Card){ return c.s==="♥"; }
function isQs(c:Card){ return c.s==="♠" && c.r===10; } // Q

export function HeartsApp(){
  const [hands,setHands]=useState<Card[][]>(()=>{ const d=deck(); return [d.slice(0,13), d.slice(13,26), d.slice(26,39), d.slice(39,52)]; });
  const [trick,setTrick]=useState<{card:Card,player:number}[]>([]);
  const [scores,setScores]=useState([0,0,0,0]);
  const [round,setRound]=useState(1);
  const [msg,setMsg]=useState("You are South (bottom). Click a card to play.");

  const play=(idx:number)=>{
    const you=hands[0];
    if(you.length===0) return;
    const card=you[idx];
    // simple rule: must follow suit if possible
    if(trick.length>0){
      const lead=trick[0].card.s;
      const hasLead=you.some(c=>c.s===lead);
      if(hasLead && card.s!==lead){ setMsg(`Must follow ${lead}!`); return; }
    }
    const newHands=hands.map(a=>[...a]);
    newHands[0]=newHands[0].filter((_,i)=>i!==idx);
    const newTrick=[...trick,{card,player:0}];
    setHands(newHands);
    setTrick(newTrick);
    setMsg(`Played ${card.s}${RANKS[card.r]} - Trick ${newTrick.length}/4`);
    // auto play other 3
    if(newTrick.length<4){
      setTimeout(()=>{
        let t=[...newTrick];
        for(let p=1;p<=3;p++){
          const h=newHands[p];
          const lead=t[0].card.s;
          let pickIdx=h.findIndex(c=>c.s===lead);
          if(pickIdx===-1) pickIdx=0;
          const c=h[pickIdx];
          newHands[p]=h.filter((_,i)=>i!==pickIdx);
          t=[...t,{card:c,player:p}];
        }
        // score: hearts 1, Q♠ 13
        let pts=0; t.forEach(x=>{ if(isHeart(x.card)) pts+=1; if(isQs(x.card)) pts+=13; });
        // winner is highest of lead suit
        const lead=t[0].card.s;
        let winner=t[0]; let max=-1;
        t.forEach(x=>{ if(x.card.s===lead && x.card.r>max){ max=x.card.r; winner=x; }});
        if(winner.player===0) setScores(s=>{ const n=[...s]; n[0]+=pts; return n; });
        else setScores(s=>{ const n=[...s]; n[winner.player]+=pts; return n; });
        setHands([...newHands]);
        setTrick([]);
        if(newHands[0].length===0){ setMsg(`Round ${round} finished. You: ${scores[0]+(winner.player===0?pts:0)}`); setRound(r=>r+1); setTimeout(()=>{ const d=deck(); setHands([d.slice(0,13),d.slice(13,26),d.slice(26,39),d.slice(39,52)]); setScores([0,0,0,0]); },1500); }
        else setMsg(`Winner: Player ${winner.player} (+${pts}) - Your turn`);
      },400);
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"center" }}>
      <div style={{ fontSize:11, background:"#000080", color:"#fff", padding:"2px 6px", width:"100%", textAlign:"center" }}>Hearts - Round {round} - Scores: You {scores[0]} | W {scores[1]} | N {scores[2]} | E {scores[3]}</div>
      <div style={{ display:"flex", gap:6, fontSize:10 }}>
        <span>West: {hands[1].length} cards</span><span>North: {hands[2].length}</span><span>East: {hands[3].length}</span>
      </div>
      <Frame variant="well" style={{ width:320, height:80, background:"#008080", display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:6 }}>
        {trick.length===0? <span style={{ color:"#fff", fontSize:11 }}>Trick area</span> : trick.map((t,i)=>(
          <Frame key={i} variant="well" style={{ width:48, height:64, background:"#fff", display:"grid", placeItems:"center", fontSize:12, color: t.card.s==="♥"||t.card.s==="♦"?"red":"black" }}>
            {t.card.s}{RANKS[t.card.r]}
          </Frame>
        ))}
      </Frame>
      <div style={{ display:"flex", flexWrap:"wrap", gap:4, justifyContent:"center", maxWidth:360 }}>
        {hands[0].map((c,i)=>(
          <Frame key={c.id} variant="well" onClick={()=>play(i)} style={{ width:44, height:60, background:"#fff", display:"grid", placeItems:"center", cursor:"url('/cursors/hand.png') 12 0, pointer", color: c.s==="♥"||c.s==="♦"?"red":"black", fontSize:12 }}>
            {c.s}{RANKS[c.r]}
          </Frame>
        ))}
      </div>
      <div style={{ fontSize:10, color:"#808080", textAlign:"center" }}>{msg}</div>
      <Button size="sm" onClick={()=>{ const d=deck(); setHands([d.slice(0,13),d.slice(13,26),d.slice(26,39),d.slice(39,52)]); setTrick([]); setScores([0,0,0,0]); }}>New Game</Button>
    </div>
  );
}
