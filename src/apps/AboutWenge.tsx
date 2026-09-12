import { Button, Fieldset, Separator } from "react95";
import styled from "styled-components";
import { showInfo } from "../components/SystemDialog";

const Logo = styled.div`
  font-size: 28px;
  font-weight: bold;
  color: #000080;
  text-shadow: 1px 1px 0 #fff, 2px 2px 0 #808080;
  letter-spacing: 2px;
`;

export function AboutWengeApp() {
  return (
    <div style={{ textAlign: "center", padding: 8 }}>
      <Logo>Wenge 95</Logo>
      <div style={{ fontSize: 11, marginTop: 4 }}>Version 4.00.950 - Wenge OS</div>
      <Separator style={{ margin: "12px 0" }} />
      <Fieldset label="Welcome">
        <p style={{ fontSize: 12, lineHeight: 1.7, textAlign: "left" }}>
          <b>Wenge</b> is a Windows 95 homage desktop OS mock built with React + react95.
          <br />
          Fully recreates the teal background (#008080), MS Sans Serif, taskbar, Start menu, and draggable/resizable windows.
          <br />
          Sounds use authentic Windows 95 WAV files.
        </p>
      </Fieldset>
      <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
        <Button onClick={() => window.open("https://github.com/react95-io/React95", "_blank")}>React95</Button>
        <Button onClick={() => showInfo("Wenge OS License", "Wenge OS\n© 1995-2026 Wenge Corp.\nInspired by Windows 95.\nFree demo — no warranty.")}>License</Button>
      </div>
      <div style={{ marginTop: 12, fontSize: 10, color: "#555" }}>This product is inspired by Microsoft Windows 95</div>
    </div>
  );
}
