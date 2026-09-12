import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "styled-components";
import original from "react95/dist/themes/original";
import GlobalStyle from "./styles/GlobalStyles";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={original}>
      <GlobalStyle />
      <App />
    </ThemeProvider>
  </StrictMode>
);
