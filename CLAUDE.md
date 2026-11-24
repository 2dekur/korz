# KORZ Music — mémoire projet

Lecteur musical desktop Windows. Tauri v2 + Rust + React 19 + TypeScript strict + Tailwind v4 + SQLite.
Version actuelle : **v0.0.1** (reboot du 24/11/2026, voir `ROADMAP.md`). Dépôt `https://github.com/2dekur/korz` (public), branche `main`.
L'ancienne base (v0.0.1 → v0.0.8 : streaming YouTube via relais, catalogue Deezer, paroles, licences) est conservée sous le tag git `legacy-v0.0.8`.

## Règles d'or (non négociables)

- **Design sur-mesure, zéro « UI IA » :** fond `#09090b`, surfaces `#121214`/`#1b1b1f`, accent unique `#c6f432` réservé aux actions de lecture et à l'état actif. Inter (UI) + Plus Jakarta Sans (titres), icônes Lucide, pas d'emoji, pas de dégradés décoratifs, bordures fines.
- **Aucun faux bouton :** tout contrôle affiché fonctionne. Ce qui n'existe pas encore est absent ou présenté comme non disponible.
- **Aucun contournement :** jamais d'extraction ni de téléchargement de contenu protégé, jamais de contournement d'anti-bot (PO token, Botguard, clients choisis pour y échapper), jamais de scraping. Intégrations externes = API officielles uniquement.
- **Logique métier en Rust :** bibliothèque, file d'attente, lecture, favoris, playlists, historique. Le front affiche et envoie des commandes.
- **Fichiers de l'utilisateur intouchables :** KORZ lit, ne déplace, ne renomme, ne modifie rien. Retirer un dossier retire seulement les entrées de la base.
- **Zéro erreur :** avant validation, `npm run build`, `npm test`, `cargo test` et `cargo check` (dans `src-tauri/`) passent, et l'app est testée en vrai (`npm run tauri dev`).
- **Incrémental strict + anti-amnésie :** `CLAUDE.md` et `ROADMAP.md` à jour à chaque fin de version, puis commit `vX.Y.Z`.

## Architecture

```
src-tauri/src/
  lib.rs            KORZ CORE : plugins, état (AppState), protocole korzcover, commandes, arrêt propre (RunEvent::Exit)
  error.rs          AppError (thiserror) → { code, message } côté front
  db.rs             SQLite (rusqlite bundled, WAL, clés étrangères), migrations ordonnées via PRAGMA user_version, réglages clé/valeur
  commands.rs       commandes Tauri : validation des arguments + appel ; travail bloquant via spawn_blocking
  library/          KORZ LIBRARY
    models.rs       DTO serde camelCase (Track, Album, Artist, Folder, Playlist, …)
    queries.rs      SQL (recherche sur colonne `search` repliée — minuscules, sans accents, via fold() —, albums/artistes par GROUP BY, favoris, historique ≤ 5 000, playlists) + tests
    scan.rs         parcours de dossier (sans suivre les liens), tags lofty, pochettes en cache par hash, scan incrémental (taille + mtime) + tests
  audio/            KORZ AUDIO ENGINE
    mod.rs          thread dédié (la sortie audio n'est pas Send) ; commandes par canal ; un rodio::Player par titre ; événements player://state et player://position (250 ms)
    queue.rs        file d'attente pure + tests
  smartlink.rs      KORZ SMART LINK : reconnaissance hors ligne des liens Spotify/YouTube/Deezer/Apple Music/SoundCloud + tests
  updates.rs        mise à jour auto : vérification et installation de la release GitHub signée
src/
  main.tsx          init lecteur + écouteurs d'événements, puis render
  App.tsx           routeur → pages, Espace = lecture/pause
  types/            miroir des DTO Rust + Route
  services/api.ts   enveloppes typées des commandes, événements, coverUrl()
  store/            navigation (routeur mémoire), player (miroir en lecture seule du moteur), library (révision + scan), ui
  hooks/useQuery    lecture backend, relancée quand la révision de la bibliothèque change
  components/       ui/ (Slider, IconButton, Artwork, Button, Menu, States, Tooltip, Switch, Logo), layout/, track/, player/, library/
  pages/            Accueil, Recherche, Bibliothèque (albums/artistes/titres), Album, Artiste, Playlists, Playlist, Favoris, Importer un lien, Services connectés, Paramètres
```

Données : `%APPDATA%\com.korz.app\korz.db` ; pochettes : `%LOCALAPPDATA%\com.korz.app\covers\<hash>` ; journaux : dossier de logs de l'app (`KORZ Music.log`, 2 Mo).

## Choix techniques

| Besoin | Choix | Pourquoi |
|---|---|---|
| Décodage + sortie | `rodio` 0.23 (symphonia), features `playback mp3 flac wav vorbis mp4 symphonia-alac` | pur Rust, seek pris en charge |
| Métadonnées | `lofty` 0.25 | tags, pochettes et durée pour tous les formats ciblés |
| Base | `rusqlite` 0.43 `bundled` | SQLite embarqué, aucune installation |
| Erreurs / logs | `thiserror`, `log` + `tauri-plugin-log` | erreurs typées, journal fichier |
| Mise à jour | `tauri-plugin-updater` (API Rust) | installeur signé vérifié avant installation |
| Front | React 19, Zustand, `@tanstack/react-virtual`, Radix (slider, switch, tooltip), `sonner`, Lucide | listes de milliers de titres, accessibilité |

Formats vérifiés sur de vrais fichiers (test `formats_read_decode_and_seek`) : MP3, FLAC, WAV, AAC (ADTS), M4A AAC, M4A ALAC, OGG Vorbis — tags, durée, pochette, décodage, seek. Non pris en charge : Opus, WMA.

## Conventions

- Imports via alias `@/` sauf `src/lib/` (imports relatifs, exécuté par `node --test`).
- Toute lecture backend dans un composant passe par `useQuery` ; toute écriture appelle `useLibrary.getState().bump()` pour rafraîchir les vues.
- Le lecteur se pilote uniquement par `api.*` (commandes Rust) ; `store/player.ts` ne fait que refléter les événements du moteur.
- Les pochettes ne sont servies que par nom de hash (32 hex) via `korzcover` : aucun chemin ne vient du front.
- La lecture se fait par identifiant de titre ; le chemin est résolu côté Rust depuis la base.
- Couleurs via tokens Tailwind (`bg-bg`, `bg-surface`, `bg-raised`, `text-fg`, `text-muted`, `text-faint`, `border-line`, `accent`). Tout bouton icône a un `aria-label`.
- Nouvelles tables/colonnes : ajouter une migration à la fin de `MIGRATIONS` (`db.rs`), ne jamais modifier une migration publiée.

## Commandes

```bash
npm run tauri dev    # app desktop
npm run build        # tsc + vite build
npm test             # tests node:test (src/lib)
cd src-tauri && cargo test && cargo check
# formats réels (fichiers générés avec ffmpeg) :
KORZ_FIXTURES=<dossier> cargo test formats -- --ignored --nocapture
```

Pilotage de l'app pour les tests : lancer avec `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`, puis protocole DevTools sur `127.0.0.1:9333`. Niveau de sortie audio réel : session Core Audio du processus `korz.exe` (IAudioMeterInformation). Les dialogues Windows se pilotent au clavier (le champ « Dossier : » n'est pas exposé à UI Automation).

## Mises à jour et releases

- Mise à jour auto en Rust (`src-tauri/src/updates.rs` : `update_check`, `update_install`), endpoint `https://github.com/2dekur/korz/releases/latest/download/latest.json`, clé publique dans `tauri.conf.json` (`plugins.updater.pubkey`), installation Windows `passive`. Vérification silencieuse 4 s après le lancement (`store/updates.ts`), notification avec « Installer », et Paramètres > Mises à jour.
- `install()` lance l'installeur puis quitte le processus (`RunEvent::Exit` ne passe pas) : le moteur audio est arrêté juste avant.
- **Clé privée de signature : `C:Usersalpha.taurikorz.key` (sans mot de passe). Jamais dans le dépôt, jamais lue ni affichée.** La perdre = plus aucune mise à jour possible pour les installations existantes.
- Notes de version = section `### vX.Y.Z` de `ROADMAP.md` (`scripts/release-notes.mjs`) : la rédiger pour l'utilisateur final.
- Publication locale (aucun secret de signature sur GitHub, le workflow `release.yml` s'arrête alors de lui-même) :
  1. version identique dans `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` ;
  2. `TAURI_SIGNING_PRIVATE_KEY=<chemin de la clé> TAURI_SIGNING_PRIVATE_KEY_PASSWORD= npm run tauri build` ;
  3. `node scripts/latest-json.mjs X.Y.Z` → `src-tauri/target/release/bundle/release/` (installeurs sans espace + `latest.json`) ;
  4. `git push`, puis `gh release create vX.Y.Z --target main --latest` avec les 3 fichiers de ce dossier.
- Les noms de fichiers publiés ne doivent pas contenir d'espace : GitHub les renomme et l'URL de `latest.json` casserait.
- Les installations Korz 0.0.6/0.0.7 (ancienne base) ne passent pas à 0.0.1 : version inférieure.

## Limites connues (v0.0.1)

- AAC brut (.aac) : pas d'index, durée estimée d'après le débit (écart de quelques %).
- Pas encore d'aléatoire, de répétition, de réorganisation de la file ni de playlists réordonnables.
- Pas de surveillance des dossiers : « Réanalyser » dans Paramètres après des ajouts.
- Smart Link reconnaît les liens sans contacter les services ; KORZ CONNECT (API officielles) n'est pas implémenté.
- Base illisible au démarrage = l'app ne démarre pas (message dans le journal).
