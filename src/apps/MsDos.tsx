import { useState, useRef, useEffect } from "react";
import { Frame } from "react95";

type FSNode = { type:"dir"|"file"; name:string; children?:FSNode[]; content?:string };

const INITIAL_FS: FSNode = {
  name:"C:", type:"dir", children:[
    {name:"WENGE", type:"dir", children:[
      {name:"COMMAND", type:"dir", children:[]},
      {name:"README.TXT", type:"file", content:"Welcome to Wenge DOS.\nType HELP for commands."},
      {name:"AUTOEXEC.BAT", type:"file", content:"@echo off\nPROMPT $p$g"},
    ]},
    {name:"WINDOWS", type:"dir", children:[
      {name:"SYSTEM", type:"dir", children:[]},
      {name:"WIN.COM", type:"file", content:"Windows binary"},
    ]},
  ]
};

function findNode(root:FSNode, path:string[]):FSNode|null{
  let cur=root;
  for(const p of path){
    if(!cur.children) return null;
    const n=cur.children.find(c=>c.name===p);
    if(!n) return null;
    cur=n;
  }
  return cur;
}

export function MsDosApp(){
  const [history,setHistory]=useState<string[]>(["Microsoft(R) Windows 95","(C)Copyright Microsoft Corp 1981-1995.","", "Type HELP for help.",""]);
  const [input,setInput]=useState("");
  const [cwd,setCwd]=useState<string[]>(["WENGE"]);
  const ref=useRef<HTMLDivElement>(null);
  const inputRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{ ref.current?.scrollTo(0, ref.current.scrollHeight); },[history]);

  const exec=(cmdRaw:string)=>{
    const cmd=cmdRaw.trim();
    if(!cmd) return;
    const args=cmd.split(/\s+/);
    const base=args[0].toLowerCase();
    const out:string[]=[`C:\\${cwd.join("\\")}> ${cmd}`];
    if(base==="help"){
      out.push("DIR  - List files","CD   - Change directory","CLS  - Clear screen","ECHO - Echo text","TYPE - Show file","DATE - Show date","TIME - Show time","VER  - Version","HELP - This help");
    } else if(base==="dir"){
      const node=findNode(INITIAL_FS,cwd);
      if(node?.children){
        out.push(" Volume in drive C is WENGE"," Directory of C:\\"+cwd.join("\\"),"");
        node.children.forEach(c=> out.push(c.type==="dir"?`<DIR>      ${c.name}`:`           ${c.name}`));
        out.push(`${node.children.length} file(s)`);
      }
    } else if(base==="cd"){
      const target=args[1];
      if(!target || target==="\\"){ setCwd([]); }
      else if(target===".."){ setCwd(p=>p.slice(0,-1)); }
      else {
        const name=target.toUpperCase().replace(/\\/g,"");
        const node=findNode(INITIAL_FS,cwd);
        const child=node?.children?.find(c=>c.name===name && c.type==="dir");
        if(child) setCwd(p=>[...p,name]); else out.push(`File Not Found - ${target}`);
      }
      setHistory(h=>[...h,...out]);
      return;
    } else if(base==="cls"){ setHistory([]); return; }
    else if(base==="echo"){ out.push(args.slice(1).join(" ")); }
    else if(base==="type"){
      const name=(args[1]||"").toUpperCase();
      const node=findNode(INITIAL_FS,cwd);
      const f=node?.children?.find(c=>c.name===name);
      if(f?.content) out.push(f.content); else out.push(`File not found - ${name}`);
    } else if(base==="date"){ out.push(new Date().toLocaleDateString()); }
    else if(base==="time"){ out.push(new Date().toLocaleTimeString()); }
    else if(base==="ver"){ out.push("MS-DOS Version 7.00  Windows 95 [Version 4.00.950]"); }
    else { out.push(`Bad command or file name - ${base}`); }
    setHistory(h=>[...h,...out]);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"#000", color:"#c0c0c0", fontFamily:"monospace", fontSize:12 }}>
      <Frame variant="well" style={{ flex:1, background:"#000", color:"#c0c0c0", padding:4, overflow:"auto", fontFamily:"monospace" }} ref={ref as any}>
        {history.map((l,i)=><div key={i} style={{whiteSpace:"pre-wrap", minHeight:14}}>{l||"\u00A0"}</div>)}
        <div style={{ display:"flex", gap:4 }}>
          <span>C:\{cwd.join("\\")}&gt;</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"){ exec(input); setInput(""); } }}
            style={{ flex:1, background:"#000", color:"#c0c0c0", border:"none", outline:"none", fontFamily:"monospace", fontSize:12 }}
            autoFocus
          />
        </div>
      </Frame>
      <div style={{ fontSize:10, padding:"2px 4px", background:"#c0c0c0", color:"#000", borderTop:"2px solid #808080" }}>MS-DOS Prompt - Press HELP for commands</div>
    </div>
  );
}
