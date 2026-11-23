# Korz — mémoire projet

Lecteur de streaming musical desktop. Tauri v2 + React 19 + TypeScript strict + Tailwind v4.
Version actuelle : **v0.0.8** (voir `ROADMAP.md`). Dépôt git `https://github.com/2dekur/korz` (public), branche `main`.

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
| Plugins Tauri | `plugin-store`, `plugin-fs`, `plugin-dialog`, `plugin-os`, `plugin-window-state`, `plugin-http`, `plugin-persisted-scope` (feature `protocol-asset`), `plugin-updater`, `plugin-process` (relaunch), `plugin-opener` (template) |
| Front | React 19, Vite 8, TypeScript 6 (`strict`, `noUncheckedIndexedAccess`), Tailwind CSS 4 (`@tailwindcss/vite`) |
| État / perf | `zustand`, `@tanstack/react-virtual` |
| Moteur audio (Rust) | `rustypipe` 0.11 (**GPL-3.0** : un binaire distribué devrait l'être sous GPL-3.0), `tokio` (dev, tests async) |
| Design | `lucide-react`, `framer-motion`, `clsx` + `tailwind-merge` (`cn()`), `sonner`, Radix (`slider`, `dialog`, `switch`, `tooltip`), `@fontsource-variable/inter`, `@fontsource-variable/plus-jakarta-sans` |

Lecture complète (moteur hybride, `src-tauri/src/stream.rs`) :
- **Recherche + correspondance en local** avec `rustypipe` (YouTube Music Innertube depuis le PC de l'utilisateur, aucun serveur tiers, 0,3-0,9 s). Repli : recherche via relais Invidious si YouTube Music est injoignable.
- **Flux audio via relais Invidious** servi par plages sur `korzstream://localhost/<videoId>` (en-têtes navigateur, relais triés par latence, bascule, annuaire public au démarrage). YouTube refuse l'accès direct au flux au-delà du premier segment sans jeton Botguard (PO token).
- **Bascule** : le premier segment (128 Ko) doit arriver en 1,5 s depuis un relais, sinon ce relais est rétrogradé et le suivant est essayé aussitôt ; côté front, une source qui échoue avant le premier son passe la main à la suivante (local → Lecteur Global → extrait 30 s en dernier recours).
- **Interdit : ne jamais générer de PO token ni lancer de solveur Botguard** (`rustypipe-botguard` ou équivalent), **ni choisir un client YouTube parce qu'il échappe au PO token** (ex. `yt-dlp --extractor-args youtube:player_client=android_vr`) : c'est du contournement de détection anti-bot. `RustyPipe::builder().no_botguard()` est obligatoire.
- Interface : le moteur s'appelle « Lecteur Global » ; ne jamais afficher « Invidious » dans l'UI.

Permissions : `src-tauri/capabilities/default.json` (http limité à `api.deezer.com`, `itunes.apple.com`, `lrclib.net`, `api.mymemory.translated.net` ; `process:allow-restart`, `fs:allow-read-dir`, `fs:allow-stat`) + `desktop.json` (window-state, updater). Asset protocol activé avec scope vide : seuls les dossiers choisis via le dialogue sont accessibles (le dialogue ajoute le scope, persisted-scope le conserve).

## Mises à jour et releases

- `tauri-plugin-updater` : endpoint `https://github.com/2dekur/korz/releases/latest/download/latest.json`, clé publique dans `tauri.conf.json` (`plugins.updater.pubkey`), `bundle.createUpdaterArtifacts: true`, installation Windows `passive`.
- **Clé privée de signature : `C:\Users\alpha\.tauri\korz.key` (sans mot de passe). Jamais dans le dépôt, jamais lue ni affichée.** La perdre = plus aucune mise à jour possible pour les installations existantes.
- Vérification 3 s après le lancement (`store/updates.ts`) ; popup `UpdateToast` sauf si la version a été fermée (`ignoredUpdates` persisté) ; Paramètres > Mises à jour permet toujours d'installer.
- Notes de version = section `### vX.Y.Z` de `ROADMAP.md` (`scripts/release-notes.mjs`) : la rédiger pour l'utilisateur final.
- Publication : tag `vX.Y.Z` → `.github/workflows/release.yml` (tauri-action) si les secrets `TAURI_SIGNING_PRIVATE_KEY` / `_PASSWORD` existent ; sinon build local signé (`TAURI_SIGNING_PRIVATE_KEY=<chemin de la clé> npm run tauri build`, ~18 min à froid, 2-4 min ensuite), `node scripts/latest-json.mjs X.Y.Z`, puis `gh release create vX.Y.Z --target main` avec l'installeur NSIS, le MSI et `latest.json`.
- **Un dépôt privé bloque l'auto-update** : les fichiers de release d'un dépôt privé ne sont pas téléchargeables sans authentification.

## Paroles

- LRCLIB (`/api/get` exact titre+artiste+album+durée, repli `/api/search` ±3 s, synchronisées préférées) ; parseur LRC pur `src/lib/lyrics.ts` (testé).
- Traduction FR : MyMemory (`langpair=autodetect|fr`), lots ≤ 450 octets joints par `\n`, une requête par lot ; source française détectée (ou refus « DISTINCT LANGUAGES ») = pas de traduction. Cache persistant `lyricsTranslations` (300 titres max). Quota anonyme ≈ 5 000 caractères/jour.
- Panneau latéral unique (`store/ui.ts` : `panel` = file ou paroles), ligne active calculée par sélecteur (re-rendu seulement au changement de ligne), clic = seek, molette = pause du suivi 3 s.

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
    music.ts            filtre anti-pollution, dédoublonnage, top artiste, suggestions, expiration preview, parsing fichiers ; splitArtistNames, featuredFromTitle, mergeArtists, allArtists
  services/
    http.ts             getJson : plugin-http dans Tauri, proxy Vite (/proxy/*) dans le navigateur
    musicApi.ts         Deezer (principal) + iTunes (repli) : métadonnées, page artiste, charts ; playableSrc() = extrait 30 s
    audioProviders.ts   AudioProvider : local → Lecteur Global (invoke Rust) → extrait (dernier recours) ; candidateProviders(), cache trackId→videoId persistant, prefetch
    localFiles.ts       dialogue dossier + scan récursif (plugin-fs)
    audio.ts            UNIQUE <audio> partagé
    persist.ts          readKey/writeKey : plugin-store en Tauri, localStorage (préfixe korz:) en navigateur
  store/
    license.ts          état licence (status, key, expiresAt), hydrateLicense, activateLicense, startHeartbeat
    catalog.ts          cache mémoire des lectures distantes (searches / artists / albums / home), hooks useX
    search.ts           requête courante + demande de focus
    library.ts          titres likés, artistes suivis, dossiers, fichiers locaux (persistés)
    navigation.ts       routeur mémoire avec historique
    player.ts           file d'attente (aléatoire, répétition, ajout/retrait/saut), bascule de sources, pré-chargement du suivant, position rAF, volume, Media Session
    ui.ts               panneaux (file d'attente ouverte/fermée)
    settings.ts         préférences + sanitize()
    credits.ts          fetch Deezer contributors throttlé (3 concurrent, 150 ms), persisté (3 000 titres max) ; useTrackArtists, trackArtists
  hooks/                useDebounce, useHoverPrefetch (survol 120 ms + 3 premiers titres visibles → pré-résolution)
  components/
    activation/         ActivationScreen (gate plein écran si licence invalide)
    ui/                 Slider, Switch, Tooltip, IconButton, Artwork (image + dégradé), Badges, Logo, States
    layout/             AppShell, Sidebar (abonnements), TopBar (+ SearchBox), ScrollContext
    search/SearchBox    barre de recherche + menu flottant (combobox ARIA, flèches/Entrée/Échap)
    track/              TrackList (virtualisée), CompactTrackRow, ArtistCard/Grid, ArtistLinks, LikeButton, FollowButton, TrackArtists (featurings)
    player/             PlayerBar (aléatoire, répétition, file), QueuePanel (En cours / À suivre)
  pages/                Home (charts), Search, Library (onglets), Artist (discographie cliquable), Album, Settings
src-tauri/src/lib.rs    plugins (persisted-scope après fs), protocole korzstream, commandes stream, fenêtre `main`
src-tauri/src/stream.rs moteur hybride : recherche rustypipe locale, correspondance stricte (±4 s, sans remix/live/cover/clip…), relais Invidious, cache formats + premiers segments, proxy Range
```

## Conventions

- Imports via alias `@/` sauf dans `src/lib/` (imports relatifs, exécutés par node).
- IDs préfixés par source : `dz-<id>` (Deezer), `it-<id>` (iTunes), `local:<chemin>`.
- Toute lecture distante passe par `store/catalog.ts` (cache) ; aucun fetch direct dans un composant.
- Affichage des artistes (featurings inclus) toujours via `<TrackArtists track={t} />` ou `trackArtists(t)` (`store/credits.ts`) — jamais `track.artists` directement dans l'UI.
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

- Le flux audio dépend encore de relais publics Invidious (1 actif au 17/11/2026) ; la recherche, elle, est locale. Si tous les relais tombent, la lecture échoue (extraits 30 s activables dans Paramètres > Sources audio).
- Données rustypipe de l'app : dossier cache de l'app (`<app cache>/rustypipe`). Les tests tournent sans stockage ; `rustypipe_cache.json` / `rustypipe_reports/` sont ignorés par git.
- Diffuser l'audio YouTube hors du lecteur officiel contrevient aux conditions d'utilisation de YouTube : usage personnel uniquement, ne pas distribuer de build public.
- Premier lancement d'un titre jamais vu : 1 à 3 s (recherche + format) ; les titres visibles/survolés/suivants sont pré-chargés.
- Quota Deezer : 50 requêtes / 5 s par IP ; le cache + debounce restent largement en dessous.
