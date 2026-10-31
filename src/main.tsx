import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/fraunces/400-italic.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "@fontsource/noto-sans-devanagari/800.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { StatusProvider } from "./lib/api";
import { PrefsProvider } from "./lib/prefs";
import { ThemeProvider } from "./lib/theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <PrefsProvider>
          <StatusProvider>
            <App />
          </StatusProvider>
        </PrefsProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Offline shell for weak networks (production only — the dev server should always be live).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
