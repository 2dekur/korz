import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./index.css";
import App from "./App";
import { initPlayer } from "@/store/player";
import { initLibraryEvents } from "@/store/library";

// Engine state and event listeners first, so the player bar never renders a stale default.
await Promise.all([initPlayer(), initLibraryEvents()]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
