# Wenge OS — Windows 95 Web Desktop

React + TypeScript + `react95` + `styled-components` で構築された Windows 95 風デスクトップ Web UI。

## 特徴

- 背景 `#008080` ティール、MS Sans Serif フォント、`ThemeProvider` + `styleReset`
- タスクバー（スタートボタン / タスクボタン / システムトレイ時計）
- スタートメニュー、デスクトップアイコン縦並び（ダブルクリックで起動）
- ウィンドウ：タイトルバー、最小化・最大化・閉じる、ドラッグ移動、右下リサイズハンドル、`zIndex` 前面化、タスクバー連携
- レトロUIパーツ：`Button`, `TextInput`, `Checkbox`, `Radio`, `Select`, `Slider`, `ProgressBar`, `Fieldset`, `GroupBox` 等
- サウンド：`public/sounds/*.wav` 本物のWin95効果音（起動、操作、エラー、ごみ箱など）

## アプリ一覧

| アイコン | アプリ | 内容 |
|---|---|---|
| 💻 | マイ コンピュータ | ドライブ一覧・システム情報 |
| 📂 | エクスプローラ | 2ペインのファイル一覧 |
| 🗑️ | ごみ箱 | 削除アイテムのテーブル |
| 📝 | メモ帳 | テキスト編集 + ワードラップ + デモUIパーツ |
| 🎨 | ペイント | Canvas お絵かき |
| 🧮 | 電卓 | 四則演算 |
| 🌐 | Internet Explorer | レトロブラウザモック |
| 📁 | ファイル共有 | Cloudflare R2 連携 |
| 💬 | Wenge チャット | Vercel + Turso + Pusher リアルタイムチャット |
| ⚙️ | コントロールパネル | 背景・音量設定 |
| 💣 | マインスイーパ | 8x8 マイン探索 |
| ℹ️ | Wenge について | OS情報 |
| ▶️ | ファイル名を指定して実行 | Run ダイアログ |

## 開発

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run preview  # 本番プレビュー
```

## 環境変数

`.env.example` を `.env` にコピーして設定。

### チャット (Vercel API + Turso + Pusher)

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
PUSHER_APP_ID=...
PUSHER_KEY=...
PUSHER_SECRET=...
PUSHER_CLUSTER=ap3
VITE_PUSHER_KEY=...
VITE_PUSHER_CLUSTER=ap3
```

仕組み: ユーザ送信 → `POST /api/chat` → Turso保存 + Pusher `wenge-chat:new-message` → 全クライアント配信。未設定時は `localStorage` フォールバック。

Tursoテーブルは自動作成: `messages(id, user, text, createdAt)`

### ファイル共有 (Cloudflare R2)

```
R2_ENDPOINT=https://<accountId>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=wenge-files
R2_PUBLIC_URL=https://pub-xxx.r2.dev
VITE_R2_BUCKET=wenge-files
```

`GET /api/files?prefix=` で一覧、`POST /api/files` で presigned URL 発行（`{presign:true, key, contentType}` → PUT）。未設定時は `localStorage` モック。

## デプロイ (Vercel)

```bash
vercel --prod
# または GitHub 連携で自動デプロイ
```

`vercel.json` で SPA リライト（`/api` 除外）を設定済み。`public/sounds` は自動で `dist/sounds` にコピーされ `/sounds/*.wav` で配信。

## 構成

```
src/
  main.tsx                 # ThemeProvider + GlobalStyles
  App.tsx                  # デスクトップ・ウィンドウ管理・タスクバー
  components/WindowFrame.tsx # ドラッグ/リサイズ対応 Window
  hooks/useClock, useSound
  apps/ Notepad, MyComputer, RecycleBin, IE, FileShare, ChatApp, About, ControlPanel, Minesweeper
api/
  chat.ts  # Turso + Pusher
  files.ts # R2 (S3互換)
public/sounds/ # Win95 WAV
```

## ライセンス

MIT / React95 (MIT) / Windows 95 は Microsoft の商標です（オマージュ作品）。
