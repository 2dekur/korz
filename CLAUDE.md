# Resonance — mémoire projet

Lecteur de streaming musical desktop. Tauri v2 + React 19 + TypeScript strict + Tailwind v4.
Version actuelle : **v0.0.1** (voir `ROADMAP.md`).

## Règles d'or (non négociables)

- **Design sur-mesure, zéro « UI IA » :** palette sombre profonde (`#09090b` fond, `#121214` surfaces), contrastes subtils, espacements précis, typo Inter (UI) + Plus Jakarta Sans (titres), `backdrop-blur` maîtrisé. Pas de gros boutons bleus, pas de bordures épaisses. Accent unique : `--color-accent` (`#c6f432`).
- **Zéro contournement sale :** pas d'Electron, pas de scrapers lents bloquants, pas de résultats pollués (remix/doublons non demandés).
- **Instant-UI :** navigation = état Zustand (`store/navigation.ts`), aucun rechargement. Recherche = cache local + debounce 200 ms + filtrage strict (tous les tokens doivent matcher, sans accents).
- **Zéro erreur :** avant toute validation : `npm run build`, `npm test` et `cargo check` (dans `src-tauri/`) doivent passer.
- **Incrémental strict :** v0.0.1 → v0.0.2 → … → v0.1.0 → v1.0.0. Jamais de version suivante tant que la courante n'est pas propre, compilée et validée.
- **Anti-amnésie :** mettre à jour `CLAUDE.md` et `ROADMAP.md` à chaque fin de version.

## Stack et plugins installés

| Rôle | Paquets |
|---|---|
| Desktop | `@tauri-apps/api`, `@tauri-apps/cli` (Tauri 2) |
| Plugins Tauri | `plugin-store`, `plugin-fs`, `plugin-dialog`, `plugin-os`, `plugin-window-state`, `plugin-opener` (template) |
| Front | React 19, Vite 8, TypeScript 6 (`strict`, `noUncheckedIndexedAccess`), Tailwind CSS 4 (`@tailwindcss/vite`) |
| État / perf | `zustand`, `@tanstack/react-virtual` |
| Design | `lucide-react`, `framer-motion`, `clsx` + `tailwind-merge` (`cn()`), `sonner`, Radix (`slider`, `dialog`, `switch`, `tooltip`), `@fontsource-variable/inter`, `@fontsource-variable/plus-jakarta-sans` |

Plugins Rust enregistrés dans `src-tauri/src/lib.rs`. Permissions : `src-tauri/capabilities/default.json` (+ `desktop.json` pour window-state).

## Architecture

```
src/
  main.tsx              hydrate settings + volume (await) puis render
  App.tsx               switch de route -> page, Toaster, TooltipProvider, MotionConfig
  index.css             tokens @theme (couleurs, polices), scrollbar, reduced-motion
  types/                Track, Artist, Settings, Route
  lib/                  cn(), formatTime(), normalize() (+ tests node:test)
  services/
    audio.ts            UNIQUE <audio> partagé
    catalog.ts          catalogue de test + search() mémoïsé
    persist.ts          readKey/writeKey : plugin-store en Tauri, localStorage en navigateur
  store/
    navigation.ts       routeur mémoire avec historique (back/forward)
    player.ts           file, lecture, position (rAF), volume persistant, Media Session
    settings.ts         préférences + sanitize() à la lecture du fichier
  hooks/useDebounce.ts
  components/
    ui/                 Slider, Switch, Tooltip, IconButton, Artwork (pochettes générées)
    layout/             AppShell, Sidebar, TopBar, ScrollContext
    player/PlayerBar    lecteur persistant bas d'écran
    track/TrackList     liste virtualisée sur le conteneur de scroll de la page
  pages/                Home, Search, Library, Artist, Settings
src-tauri/src/lib.rs    plugins + création de la fenêtre `main` (accélération matérielle)
```

## Conventions

- Imports via alias `@/` (Vite + tsconfig `paths`).
- Composants : fonctions nommées, un composant principal par fichier, props typées inline.
- Zustand : sélecteurs étroits (`usePlayer((s) => s.x)`) ; actions via `useX.getState()` quand pas de rendu nécessaire.
- Couleurs uniquement via tokens Tailwind (`bg-bg`, `bg-surface`, `bg-raised`, `text-fg`, `text-muted`, `text-faint`, `border-line`, `accent`). Pas de hex en dur dans les composants.
- Tout bouton icône a un `aria-label` (`IconButton` l'impose).
- Données lues sur disque (store) = non fiables : valider (`sanitize`).
- Persistance : clé `settings` (objet `Settings`) et `volume` dans `settings.json` (dossier app data).
- Fenêtre `main` : `create: false` dans `tauri.conf.json`, construite dans `setup()` pour appliquer `--disable-gpu` (Windows/WebView2) si l'accélération matérielle est coupée. Effet au prochain lancement.
- Raccourcis assumés : commentés `shortcut: <limite>, <quand corriger>`.

## Commandes

```bash
npm run dev          # front seul dans le navigateur (persistance = localStorage)
npm run tauri dev    # app desktop
npm run build        # tsc + vite build
npm test             # tests unitaires node:test
cd src-tauri && cargo check
```

Note Windows : si le chemin du projet est très long, l'éditeur de liens échoue (`LNK1104`). Utiliser un `CARGO_TARGET_DIR` court ou déplacer le projet.
