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
  body {
    margin: 0;
    padding: 0;
    background: #008080;
    overflow: hidden;
    user-select: none;
    font-family: 'ms_sans_serif';
    font-size: 12px;
  }
  #root { width: 100vw; height: 100vh; }
`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={original}>
      <GlobalStyles />
      <App />
    </ThemeProvider>
  </StrictMode>
);
