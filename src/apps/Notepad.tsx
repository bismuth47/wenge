import { useState } from "react";
import { Button, Checkbox, Fieldset, TextInput } from "react95";
import styled from "styled-components";

const Area = styled.textarea`
  width: 100%;
  height: 180px;
  resize: none;
  font-family: "Courier New", monospace !important;
  font-size: 12px;
  padding: 4px;
  border: 2px inset #fff;
  outline: none;
`;

export function NotepadApp() {
  const [text, setText] = useState("ようこそ Wenge OS へ！\n\nここは Windows 95 風メモ帳です。\n- ボタン\n- テキスト入力\n- チェックボックス\nを体験できます。");
  const [wrap, setWrap] = useState(true);
  const [title, setTitle] = useState("無題");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ファイル名" style={{ flex: 1 }} />
        <Button onClick={() => alert(`保存しました: ${title}\n文字数: ${text.length}`)}>保存</Button>
        <Button onClick={() => setText("")}>新規</Button>
      </div>
      <Fieldset label="オプション">
        <Checkbox checked={wrap} onChange={() => setWrap(!wrap)} value="wrap" label="ワードラップ" />
        <Checkbox checked={true} value="status" label="ステータスバー" />
      </Fieldset>
      <Area value={text} onChange={(e) => setText(e.target.value)} style={{ whiteSpace: wrap ? "pre-wrap" : "pre", overflowX: wrap ? "hidden" : "auto" }} />
      <div style={{ fontSize: 11, color: "#555" }}>文字数: {text.length} | 行: {text.split("\n").length}</div>
    </div>
  );
}
