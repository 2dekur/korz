import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./index.css";
import App from "./App";
import { useSettings } from "@/store/settings";
import { usePlayer } from "@/store/player";
import { useLibrary } from "@/store/library";
import { hydrateStreamIds } from "@/services/audioProviders";
import { hydrateTranslations } from "@/store/lyrics";
import { hydrateCredits } from "@/store/credits";
import { useUpdates } from "@/store/updates";

// Local store reads take a few ms; awaiting them avoids a flash of default profile/volume/library.
await Promise.all([useSettings.getState().hydrate(), usePlayer.getState().hydrate(), useLibrary.getState().hydrate(), hydrateStreamIds(), hydrateTranslations(), hydrateCredits()]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Checked after startup so it never competes with the first render or the first track.
setTimeout(() => void useUpdates.getState().check({ fromLaunch: true }), 3000);
