# Korz — mémoire projet

Lecteur de streaming musical desktop. Tauri v2 + React 19 + TypeScript strict + Tailwind v4.
Version actuelle : **v0.0.3** (voir `ROADMAP.md`). Dépôt git, branche `main`.

## Règles d'or (non négociables)

- **Design sur-mesure, zéro « UI IA » :** palette sombre profonde (`#09090b` fond, `#121214` surfaces), contrastes subtils, espacements précis, typo Inter (UI) + Plus Jakarta Sans (titres), `backdrop-blur` maîtrisé. Pas de gros boutons bleus, pas de bordures épaisses. Accent unique : `--color-accent` (`#c6f432`).
- **Zéro contournement sale :** pas d'Electron, pas de scrapers, pas de résultats pollués (karaoké, tribute, 8D, slowed, nightcore, sped up, remix, reprises peu populaires, doublons) sauf si la requête les demande.
- **Instant-UI :** navigation = état Zustand (`store/navigation.ts`). Données distantes en cache mémoire (`store/catalog.ts`), préchargement des artistes au survol. Recherche : debounce 200 ms + cache + filtrage strict.
- **Zéro erreur :** avant toute validation : `npm run build`, `npm test`, `cargo check` (dans `src-tauri/`) et `npm run tauri dev` doivent passer.
- **Incrémental strict :** v0.0.1 → v0.0.2 → … → v0.1.0 → v1.0.0. Jamais de version suivante tant que la courante n'est pas propre, compilée et validée.
- **Anti-amnésie :** mettre à jour `CLAUDE.md` et `ROADMAP.md` à chaque fin de version, puis commit `vX.Y.Z`.

## Stack et plugins installés

| Rôle | Paquets |
|---|---|
| Desktop | `@tauri-apps/api`, `@tauri-apps/cli` (Tauri 2, feature Rust `protocol-asset`) |
| Plugins Tauri | `plugin-store`, `plugin-fs`, `plugin-dialog`, `plugin-os`, `plugin-window-state`, `plugin-http`, `plugin-persisted-scope` (feature `protocol-asset`), `plugin-opener` (template) |
| Front | React 19, Vite 8, TypeScript 6 (`strict`, `noUncheckedIndexedAccess`), Tailwind CSS 4 (`@tailwindcss/vite`) |
| État / perf | `zustand`, `@tanstack/react-virtual` |
| Design | `lucide-react`, `framer-motion`, `clsx` + `tailwind-merge` (`cn()`), `sonner`, Radix (`slider`, `dialog`, `switch`, `tooltip`), `@fontsource-variable/inter`, `@fontsource-variable/plus-jakarta-sans` |

Lecture complète : `src-tauri/src/stream.rs` (Rust) résout chaque titre Deezer vers sa piste officielle YouTube Music (recherche Piped `music_songs`, repli recherche Invidious), puis sert l'audio par plages via le protocole `korzstream://localhost/<videoId>` (proxy Invidious avec en-têtes navigateur). Instances classées par latence, bascule automatique, annuaires publics interrogés au démarrage.

Permissions : `src-tauri/capabilities/default.json` (http limité à `api.deezer.com` et `itunes.apple.com`, `fs:allow-read-dir`, `fs:allow-stat`) + `desktop.json` (window-state). Asset protocol activé avec scope vide : seuls les dossiers choisis via le dialogue sont accessibles (le dialogue ajoute le scope, persisted-scope le conserve).

## Architecture

```
app-icon.svg            source du logo (npx tauri icon app-icon.svg régénère src-tauri/icons)
src/
  main.tsx              hydrate settings + volume + bibliothèque (await) puis render
  App.tsx               switch de route -> page, Toaster, TooltipProvider, MotionConfig
  index.css             tokens @theme, focus (dans @layer base), scrollbar, reduced-motion
  types/                Track, Artist, Album, SearchResults, Settings, Route
  lib/                  fonctions pures testées par node:test (imports relatifs .ts, pas d'alias @)
    format.ts           formatTime, normalize
    music.ts            filtre anti-pollution, dédoublonnage, top artiste, suggestions, expiration preview, parsing fichiers
  services/
    http.ts             getJson : plugin-http dans Tauri, proxy Vite (/proxy/*) dans le navigateur
    musicApi.ts         Deezer (principal) + iTunes (repli) : métadonnées, page artiste, charts ; playableSrc() = extrait 30 s
    audioProviders.ts   AudioProvider : local → flux complet (invoke Rust) → extrait (si activé) ; cache trackId→videoId persistant, prefetch
    localFiles.ts       dialogue dossier + scan récursif (plugin-fs)
    audio.ts            UNIQUE <audio> partagé
    persist.ts          readKey/writeKey : plugin-store en Tauri, localStorage (préfixe korz:) en navigateur
  store/
    catalog.ts          cache mémoire des lectures distantes (searches / artists / home), hooks useX
    search.ts           requête courante + demande de focus
    library.ts          titres likés, artistes suivis, dossiers, fichiers locaux (persistés)
    navigation.ts       routeur mémoire avec historique
    player.ts           file, lecture (src résolue async), position rAF, volume, Media Session
    settings.ts         préférences + sanitize()
  hooks/                useDebounce, useHoverPrefetch (survol + premiers titres visibles → pré-résolution)
  components/
    ui/                 Slider, Switch, Tooltip, IconButton, Artwork (image + dégradé), Badges, Logo, States
    layout/             AppShell, Sidebar (abonnements), TopBar (+ SearchBox), ScrollContext
    search/SearchBox    barre de recherche + menu flottant (combobox ARIA, flèches/Entrée/Échap)
    track/              TrackList (virtualisée), CompactTrackRow, ArtistCard/Grid, ArtistLinks, LikeButton, FollowButton
    player/PlayerBar    lecteur persistant
  pages/                Home (charts), Search, Library (onglets), Artist, Settings
src-tauri/src/lib.rs    plugins (persisted-scope après fs), protocole korzstream, commandes stream, fenêtre `main`
src-tauri/src/stream.rs résolveur flux complet : pool d'instances, correspondance stricte (±4 s, sans remix/live/cover/clip…), cache formats + premier segment, proxy Range
```

## Conventions

- Imports via alias `@/` sauf dans `src/lib/` (imports relatifs, exécutés par node).
- IDs préfixés par source : `dz-<id>` (Deezer), `it-<id>` (iTunes), `local:<chemin>`.
- Toute lecture distante passe par `store/catalog.ts` (cache) ; aucun fetch direct dans un composant.
- Toute lecture passe par `resolveSource()` (`services/audioProviders.ts`) ; jamais d'URL directe dans le lecteur.
- Le proxy Rust réécrit `Content-Range` d'après les octets reçus (certaines instances renvoient une fin au-delà du fichier, ce que Chromium rejette).
- Tests Rust réseau : `cargo test live_ -- --ignored --nocapture` (Deezer → résolution → octets audio).
- Zustand : sélecteurs étroits ; actions via `useX.getState()` quand pas de rendu nécessaire.
- Couleurs via tokens Tailwind (`bg-bg`, `bg-surface`, `bg-raised`, `text-fg`, `text-muted`, `text-faint`, `border-line`, `accent`).
- Tout bouton icône a un `aria-label`. Données lues sur disque = non fiables : valider.
- Le badge « vérifié » signifie ≥ 100 000 fans Deezer (Deezer n'expose pas de statut vérifié) ; le tooltip le dit.

## Commandes

```bash
npm run dev          # front seul dans le navigateur (proxy Vite pour l'API, pas de fichiers locaux)
npm run tauri dev    # app desktop
npm run build        # tsc + vite build
npm test             # tests node:test (src/lib)
cd src-tauri && cargo check && cargo test
```

## Limites connues

- La lecture complète dépend d'instances publiques Piped/Invidious (2 actives au 17/11/2026) : si toutes tombent, la lecture échoue (extraits 30 s activables dans Paramètres > Sources audio).
- Diffuser l'audio YouTube hors du lecteur officiel contrevient aux conditions d'utilisation de YouTube : usage personnel uniquement, ne pas distribuer de build public.
- Premier lancement d'un titre jamais vu : 1 à 3 s (recherche + format) ; les titres visibles/survolés/suivants sont pré-chargés.
- Quota Deezer : 50 requêtes / 5 s par IP ; le cache + debounce restent largement en dessous.
