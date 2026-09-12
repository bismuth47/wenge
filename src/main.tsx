import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createGlobalStyle, ThemeProvider } from "styled-components";
import { styleReset } from "react95";
import original from "react95/dist/themes/original";
import ms_sans_serif from "react95/dist/fonts/ms_sans_serif.woff2";
import ms_sans_serif_bold from "react95/dist/fonts/ms_sans_serif_bold.woff2";
import App from "./App.tsx";

const GlobalStyles = createGlobalStyle`
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
  /* ===== Windows 95 scrollbars (WebKit / Blink + Firefox fallback) ===== */
  :root { color-scheme: light; }
  * { scrollbar-width: auto; scrollbar-color: #c0c0c0 #dfdfdf; }
  ::-webkit-scrollbar { width: 16px; height: 16px; }
  ::-webkit-scrollbar-track {
    background-color: #dfdfdf;
    background-image: repeating-conic-gradient(#ffffff 0% 25%, #c0c0c0 0% 50%);
    background-size: 2px 2px;
  }
  ::-webkit-scrollbar-thumb {
    background: #c0c0c0;
    border-top: 1px solid #dfdfdf;
    border-left: 1px solid #dfdfdf;
    border-right: 1px solid #0a0a0a;
    border-bottom: 1px solid #0a0a0a;
    box-shadow: inset 1px 1px 0 #ffffff, inset -1px -1px 0 #808080;
    min-height: 16px;
    min-width: 16px;
  }
  ::-webkit-scrollbar-thumb:hover { background: #c8c8c8; }
  ::-webkit-scrollbar-thumb:active {
    background: #c0c0c0;
    border-top: 1px solid #0a0a0a;
    border-left: 1px solid #0a0a0a;
    border-right: 1px solid #dfdfdf;
    border-bottom: 1px solid #dfdfdf;
    box-shadow: inset 1px 1px 0 #808080, inset -1px -1px 0 #ffffff;
  }
  ::-webkit-scrollbar-button:single-button {
    background-color: #c0c0c0;
    border-top: 1px solid #dfdfdf;
    border-left: 1px solid #dfdfdf;
    border-right: 1px solid #0a0a0a;
    border-bottom: 1px solid #0a0a0a;
    box-shadow: inset 1px 1px 0 #ffffff, inset -1px -1px 0 #808080;
    display: block;
    width: 16px;
    height: 16px;
    background-repeat: no-repeat;
    background-position: center center;
  }
  ::-webkit-scrollbar-button:single-button:active {
    border-top: 1px solid #0a0a0a;
    border-left: 1px solid #0a0a0a;
    border-right: 1px solid #dfdfdf;
    border-bottom: 1px solid #dfdfdf;
    box-shadow: inset 1px 1px 0 #808080, inset -1px -1px 0 #ffffff;
    background-position: calc(50% + 1px) calc(50% + 1px);
  }
  ::-webkit-scrollbar-button:single-button:vertical:decrement {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M8 5 L3 10 H13 Z' fill='black'/></svg>");
  }
  ::-webkit-scrollbar-button:single-button:vertical:increment {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M8 11 L3 6 H13 Z' fill='black'/></svg>");
  }
  ::-webkit-scrollbar-button:single-button:horizontal:decrement {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M5 8 L10 3 V13 Z' fill='black'/></svg>");
  }
  ::-webkit-scrollbar-button:single-button:horizontal:increment {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M11 8 L6 3 V13 Z' fill='black'/></svg>");
  }
  ::-webkit-scrollbar-corner { background: #c0c0c0; }
  ::-webkit-resizer { background: #c0c0c0; }
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={original}>
      <GlobalStyles />
      <App />
    </ThemeProvider>
  </StrictMode>
);
