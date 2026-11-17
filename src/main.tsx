import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./index.css";
import App from "./App";
import { useSettings } from "@/store/settings";
import { usePlayer } from "@/store/player";
import { useLibrary } from "@/store/library";

// Local store reads take a few ms; awaiting them avoids a flash of default profile/volume/library.
await Promise.all([useSettings.getState().hydrate(), usePlayer.getState().hydrate(), useLibrary.getState().hydrate()]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
