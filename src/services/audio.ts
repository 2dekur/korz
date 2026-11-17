/** Single audio element shared by the whole app; the player store drives it. */
export const audio = new Audio();
audio.preload = "auto";
// No crossOrigin: test sources send no CORS headers. Needed later only if audio is routed through Web Audio.
