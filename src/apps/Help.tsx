import { useState } from "react";
import { Frame, TreeView } from "react95";

const HELP_DATA = [
  { id:0, label:"Wenge Help", expanded:true, items:[
    { id:1, label:"Getting Started", items:[{id:10,label:"What is Wenge?"},{id:11,label:"Using the desktop"}]},
    { id:2, label:"Programs", items:[{id:20,label:"Notepad"},{id:21,label:"Paint"},{id:22,label:"Media Player"}]},
    { id:3, label:"Tips & Tricks", items:[{id:30,label:"Keyboard shortcuts"},{id:31,label:"Sounds"}]},
  ]},
];

const CONTENT:Record<number,string>={
  0:"Welcome to Wenge Help!\n\nSelect a topic on the left.",
  10:"Wenge is a Windows 95 homage built with React + react95.\nTeal background #008080, MS Sans Serif, taskbar, Start menu.",
  11:"Double-click icons to open. Drag icons to move. Drag on desktop for selection. Right-click for Auto Arrange.",
  20:"Notepad: Save text files. Word Wrap toggle.",
  21:"Paint: Draw with Canvas, color + size.",
  22:"Media Player: Supports mp3/wav/ogg, drag & drop.",
  30:"Alt+Tab: Switch windows\nF5: Refresh\nCtrl+C/V: Copy/Paste (in apps)",
  31:"Sounds default ON. Control Panel → Sound to mute. All WAV in /sounds.",
};

export function HelpApp(){
  const [selected,setSelected]=useState(0);
  return (
    <div style={{ display:"flex", gap:6, height:300 }}>
      <Frame variant="well" style={{ width:150, background:"#fff", overflow:"auto", padding:4 }}>
        <TreeView tree={HELP_DATA as any} onNodeSelect={(_,id)=> setSelected(id as number)} />
      </Frame>
      <Frame variant="well" style={{ flex:1, background:"#fff", padding:8, overflow:"auto", whiteSpace:"pre-wrap", fontSize:12, lineHeight:1.6 }}>
        {CONTENT[selected] ?? "Content not found."}
        <div style={{ marginTop:12, fontSize:10, color:"#808080", borderTop:"1px solid #c0c0c0", paddingTop:6 }}>
          Wenge Help - Windows 95 style
        </div>
      </Frame>
    </div>
  );
}
