# Explorer fullscreen blank space fix (v2)

## 問題

`src/apps/ExplorerApp.tsx:341` のルート `div` に `flex: 1` がないため、親の `WindowFrame` から来た高さを Explorer が受け取っても、その中身（特にファイル一覧領域）が十分に広がらない。

## 原因

前回の修正でファイル一覧の親 `div`（401行目）を `flex: 1` にしたが、Explorer のルート `div` 自体が flex 子として伸びないため、親から与えられた高さを超えて広がれない。

## 修正内容

`src/apps/ExplorerApp.tsx:341` のルート `div` のスタイルを以下に変更：

```diff
- <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
+ <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0 }}>
```

## 影響範囲

- `src/apps/ExplorerApp.tsx` のみ

## 検証手順

1. Explorer を起動
2. 最大化ボタンをクリック
3. ファイル一覧領域が空白なく画面いっぱいに広がることを確認
