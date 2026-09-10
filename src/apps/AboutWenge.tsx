import { Button, Fieldset, Separator } from "react95";
import styled from "styled-components";

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
      <Fieldset label="ようこそ">
        <p style={{ fontSize: 12, lineHeight: 1.7, textAlign: "left" }}>
          <b>Wenge</b> は Windows 95 へのオマージュとして React + react95 で構築されたデスクトップ OS モックです。
          <br />
          ティール背景 (#008080)、MS Sans Serif、タスクバー、スタートメニュー、ドラッグ&リサイズ対応ウィンドウを完全再現。
          <br />
          サウンドは本物の Windows 95 WAV を使用しています。
        </p>
      </Fieldset>
      <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
        <Button onClick={() => window.open("https://github.com/react95-io/React95", "_blank")}>React95</Button>
        <Button onClick={() => alert("Wenge OS\n© 1995-2026 Wenge Corp.")}>ライセンス</Button>
      </div>
      <div style={{ marginTop: 12, fontSize: 10, color: "#555" }}>この製品は Microsoft Windows 95 にインスパイアされています</div>
    </div>
  );
}
