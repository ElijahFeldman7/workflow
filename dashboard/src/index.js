import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { DarkModeProvider } from "./context/DarkModeContext";
import { applyPalette, readPalette } from "./lib/theme";

// Before first paint, so the saved palette doesn't flash the default one.
applyPalette(readPalette());

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <DarkModeProvider>
      <App />
    </DarkModeProvider>
  </React.StrictMode>
);

reportWebVitals();
