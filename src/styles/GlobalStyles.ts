import { createGlobalStyle } from "styled-components";
import { styleReset } from "react95";
import ms_sans_serif from "react95/dist/fonts/ms_sans_serif.woff2";
import ms_sans_serif_bold from "react95/dist/fonts/ms_sans_serif_bold.woff2";

const ARROW_UP =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M8 5 L3 10 H13 Z' fill='black'/></svg>\")";
const ARROW_DOWN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M8 11 L3 6 H13 Z' fill='black'/></svg>\")";
const ARROW_LEFT =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M5 8 L10 3 V13 Z' fill='black'/></svg>\")";
const ARROW_RIGHT =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M11 8 L6 3 V13 Z' fill='black'/></svg>\")";

const GlobalStyle = createGlobalStyle`
  ${styleReset}
  @font-face {
    font-family: 'ms_sans_serif';
    src: url('${ms_sans_serif}') format('woff2');
    font-weight: 400;
    font-style: normal;
  }
  @font-face {
    font-family: 'ms_sans_serif';
    src: url('${ms_sans_serif_bold}') format('woff2');
    font-weight: bold;
    font-style: normal;
  }
  * { font-family: 'ms_sans_serif' !important; }
  /* Windows 95 cursors — arrow is default everywhere, specific controls override */
  html, body {
    cursor: url('/cursors/arrow.png') 0 0, default;
  }
  body, #root, div, span, p, img, table, th, td, frame, fieldset {
    cursor: inherit;
  }
  a, button, [role="button"] {
    cursor: url('/cursors/arrow.png') 0 0, pointer;
  }
  input[type="text"], input[type="password"], input[type="search"], textarea, [contenteditable="true"] {
    cursor: url('/cursors/beam.png') 10 12, text;
  }
  /* Crosshair for Paint canvas etc. will be overridden inline, but provide global fallback */
  .w95-crosshair, canvas {
    cursor: url('/cursors/cross.png') 15 15, crosshair;
  }
  .w95-help {
    cursor: url('/cursors/help.png') 0 0, help;
  }
  .w95-no, .w95-not-allowed {
    cursor: url('/cursors/no.png') 16 16, not-allowed;
  }
  .w95-move {
    cursor: url('/cursors/move.png') 16 16, move;
  }
  .w95-busy, .w95-busy * {
    cursor: url('/cursors/wait.png') 16 16, wait !important;
  }
  .w95-appstarting, .w95-appstarting * {
    cursor: url('/cursors/appstarting.png') 0 0, progress !important;
  }
  /* IE読込中: 窓内だけ待機カーソル (矢印+砂時計)。iframe文書入替の隙に
     OS標準カーソルへ戻るのを防ぐ。iframe内部は読込オーバーレイが覆うため
     親側のこの指定で全体がカバーされる。 */
  .w95-ie-loading, .w95-ie-loading * {
    cursor: url('/cursors/appstarting.png') 0 0, progress !important;
  }
  /* ===== macOS対策: ネイティブスクロールバーを完全に非表示化 =====
   * macOS (WebKit/Blink) では「スクロールバーを表示: スクロール時」がONだと
   * オーバーレイスクロールバーがOS描画され、::-webkit-scrollbar の幅・色・
   * ボタン指定が無視される。そのためデフォルトはネイティブを消し、
   * Win95風の見た目は div ベースの .win95-scrollbar (Win95Scroll.tsx) で
   * 描画する。div はOS設定の影響を受けないためmacOSでも強制適用できる。
   */
  :root { color-scheme: light; }
  html, body, * {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  html ::-webkit-scrollbar,
  html *::-webkit-scrollbar,
  *::-webkit-scrollbar {
    display: none !important;
    width: 0px !important;
    height: 0px !important;
    -webkit-appearance: none !important;
    background: transparent !important;
  }
  /* スクロール機能自体は残す (wheel / touch / keyboard でスクロール可) */
  .win95-viewport {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  .win95-viewport::-webkit-scrollbar {
    display: none !important;
    width: 0px !important;
    height: 0px !important;
    -webkit-appearance: none !important;
  }
  /* 独自Win95スクロールバーのベース (実体は Win95Scroll.tsx が描画) */
  .win95-scrollbar {
    background-color: #c0c0c0;
    border-top: 1px solid #dfdfdf;
    border-left: 1px solid #dfdfdf;
    border-right: 1px solid #0a0a0a;
    border-bottom: 1px solid #0a0a0a;
    box-shadow:
      inset 1px 1px 0 #ffffff,
      inset -1px -1px 0 #808080;
    user-select: none;
  }
  .win95-scrollbar-track {
    background-color: #dfdfdf;
    background-image: repeating-conic-gradient(#ffffff 0% 25%, #c0c0c0 0% 50%);
    background-size: 2px 2px;
  }
  /* オプトイン: Windows/Linux など非オーバーレイ環境でのみ
   * ネイティブWin95風を試したいコンテナに .win95-native-scroll を付与する。
   * macOSオーバーレイ時は無視されるため、確実性が必要なら Win95Scroll を使うこと。 */
  .win95-native-scroll {
    scrollbar-width: auto !important;
    scrollbar-color: #c0c0c0 #dfdfdf !important;
  }
  .win95-native-scroll::-webkit-scrollbar {
    display: block !important;
    width: 16px !important;
    height: 16px !important;
    -webkit-appearance: auto !important;
  }
  .win95-native-scroll::-webkit-scrollbar-track {
    background-color: #dfdfdf !important;
    background-image: repeating-conic-gradient(#ffffff 0% 25%, #c0c0c0 0% 50%) !important;
    background-size: 2px 2px !important;
  }
  .win95-native-scroll::-webkit-scrollbar-thumb {
    background: #c0c0c0 !important;
    border-top: 1px solid #dfdfdf !important;
    border-left: 1px solid #dfdfdf !important;
    border-right: 1px solid #0a0a0a !important;
    border-bottom: 1px solid #0a0a0a !important;
    box-shadow:
      inset 1px 1px 0 #ffffff !important,
      inset -1px -1px 0 #808080 !important;
    min-height: 16px !important;
    min-width: 16px !important;
  }
  .win95-native-scroll::-webkit-scrollbar-thumb:hover {
    background: #c8c8c8 !important;
  }
  .win95-native-scroll::-webkit-scrollbar-thumb:active {
    background: #c0c0c0 !important;
    border-top: 1px solid #0a0a0a !important;
    border-left: 1px solid #0a0a0a !important;
    border-right: 1px solid #dfdfdf !important;
    border-bottom: 1px solid #dfdfdf !important;
    box-shadow:
      inset 1px 1px 0 #808080 !important,
      inset -1px -1px 0 #ffffff !important;
  }
  .win95-native-scroll::-webkit-scrollbar-button:single-button {
    background-color: #c0c0c0 !important;
    border-top: 1px solid #dfdfdf !important;
    border-left: 1px solid #dfdfdf !important;
    border-right: 1px solid #0a0a0a !important;
    border-bottom: 1px solid #0a0a0a !important;
    box-shadow:
      inset 1px 1px 0 #ffffff !important,
      inset -1px -1px 0 #808080 !important;
    display: block !important;
    width: 16px !important;
    height: 16px !important;
    background-repeat: no-repeat !important;
    background-position: center center !important;
  }
  .win95-native-scroll::-webkit-scrollbar-button:single-button:active {
    border-top: 1px solid #0a0a0a !important;
    border-left: 1px solid #0a0a0a !important;
    border-right: 1px solid #dfdfdf !important;
    border-bottom: 1px solid #dfdfdf !important;
    box-shadow:
      inset 1px 1px 0 #808080 !important,
      inset -1px -1px 0 #ffffff !important;
    background-position: calc(50% + 1px) calc(50% + 1px) !important;
  }
  .win95-native-scroll::-webkit-scrollbar-button:single-button:vertical:decrement {
    background-image: ${ARROW_UP} !important;
  }
  .win95-native-scroll::-webkit-scrollbar-button:single-button:vertical:increment {
    background-image: ${ARROW_DOWN} !important;
  }
  .win95-native-scroll::-webkit-scrollbar-button:single-button:horizontal:decrement {
    background-image: ${ARROW_LEFT} !important;
  }
  .win95-native-scroll::-webkit-scrollbar-button:single-button:horizontal:increment {
    background-image: ${ARROW_RIGHT} !important;
  }
  .win95-native-scroll::-webkit-scrollbar-corner {
    background: #c0c0c0 !important;
  }
  .win95-native-scroll::-webkit-resizer {
    background: #c0c0c0 !important;
  }
  body {
    margin: 0;
    padding: 0;
    background: #008080;
    overflow: hidden;
    user-select: none;
    font-family: 'ms_sans_serif';
    font-size: 12px;
  }
  #root { width: 100vw; height: 100vh; height: 100dvh; cursor: inherit; }
  html { height: 100%; overflow: hidden; cursor: url('/cursors/arrow.png') 0 0, default; }
`;

export default GlobalStyle;
