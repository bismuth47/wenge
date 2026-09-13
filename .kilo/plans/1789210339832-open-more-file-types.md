# Plan: 複数ファイル形式を対応アプリで開けるようにする

## 目的
Explorer / Desktop で `.html` / `.bat` 等のファイルをダブルクリックした際、適切なアプリ（Internet Explorer / MS-DOS Prompt 等）で開けるようにする。

## 現状の問題
- `src/lib/vfs/openWith.ts`: `TEXT_EXTS` に `html`, `bat` を含むため、これらは全て `notepad` にルーティングされる
- `src/apps/ExplorerApp.tsx`: ハードコードされた `FS` 内のファイルの多くに `app` が未設定で、ダブルクリック時に info 表示になるだけ
- `src/apps/InternetExplorer.tsx`: ファイルを渡す仕組みがなく、URL のみ扱う
- `src/apps/MsDos.tsx`: ファイルを渡す仕組みがなく、内蔵 FS のみ扱う
- `src/App.tsx` の `openVfsDoc`: `target` から `appId` への変換が `notepad / wordpad / image-viewer / media-player` のみ対応

## 変更範囲

### 1. `src/lib/vfs/openWith.ts`
- `VfsOpenTarget` 型に `"ie" | "msdos"` を追加
- `.html` 拡張子 → `"ie"` にルーティング
- `.bat` 拡張子 → `"msdos"` にルーティング
- その他のテキスト拡張子は従来通り `"notepad"` のまま

### 2. `src/apps/ExplorerApp.tsx`
- `FS` 内の該当ファイルに `app` を追加:
  - `AUTOEXEC.BAT`, `CONFIG.SYS` など `.bat` / `.sys` → `app: "msdos"`
  - `*.html` ファイル（存在する場合） → `app: "ie"`
  - その他テキストファイル（README.txt 等） → `app: "notepad"`（既に設定済みのものも統一）

### 3. `src/apps/MsDos.tsx`
- `file?: VfsFile | null` を prop で受け取る
- `consumePendingVfsFile()` を mount 時に呼び、ファイル内容があれば terminal に表示
- ファイルが無い場合は既存の内蔵 FS を表示（現行挙動を維持）

### 4. `src/apps/InternetExplorer.tsx`
- `file?: VfsFile | null` を prop で受け取る
- `consumePendingVfsFile()` を mount 時に呼び、HTML ファイルがあれば blob URL を iframe に表示
- ファイルが無い場合は既存の URL ナビゲーションを表示（現行挙動を維持）

### 5. `src/App.tsx`
- `openVfsDoc` の `target` → `appId` 変換に `"ie"` / `"msdos"` を追加
- ウィンドウレンダリング部（`APP_DEFS` 使用箇所）に `ie` / `msdos` の file prop 受け渡しを追加:
  - `w.id === "ie"` → `InternetExplorerApp` に file prop を渡す
  - `w.id === "msdos"` → `MsDosApp` に file prop を渡す

## 検証手順
- `npm run dev` で起動
- Explorer で `.html` ファイルをダブルクリック → IE が開く
- Explorer で `.bat` ファイルをダブルクリック → MS-DOS Prompt が開く
- Desktop にドロップした `.html` / `.bat` をダブルクリック → 同上
- 既存の `.txt` は Notepad で開くことを確認
