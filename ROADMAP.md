# Roadmap — Korz

**Version actuelle : v0.0.8** (validée : `npm run build`, `npm test`, `cargo check`, `cargo test` dont tests réseau, lecture native Werenoi/Avie)

## Historique

### v0.0.6 — Paroles et mises à jour automatiques
- [x] Paroles synchronisées : bouton Paroles dans le lecteur, défilement en temps réel, clic sur une ligne pour y aller.
- [x] Traduction française sous chaque ligne (interrupteur dans les paroles et dans les Paramètres), gardée sur l'ordinateur.
- [x] Mises à jour automatiques : notification discrète au lancement, installation en un clic, version ignorable ; section Mises à jour dans les Paramètres.
- [x] Installeur Windows téléchargeable depuis les Releases GitHub.

### v0.0.5 — Albums, file d'attente, démarrage et bascule rapides
- [x] Page album (Deezer `/album/{id}`, repli iTunes) : pochette, type, année, titres, durée totale, label ; ouverte depuis la discographie et la colonne Album.
- [x] File d'attente : panneau « En cours / À suivre », saut, retrait, ajout depuis les listes, aléatoire (ordre d'origine restauré), répétition (tout / titre).
- [x] Pré-chargement : 3 premiers résultats (recherche, menu, album, artiste), survol ≥ 120 ms, titre suivant à chaque changement de file, amorce de 128 Ko en mémoire.
- [x] Bascule : 1,5 s max pour le premier octet par relais, relais suivant aussitôt ; extrait 30 s seulement si aucune source complète ne démarre.
- [x] Paramètres : « Lecteur Global » et « Extraits en dernier recours » (activé par défaut), sans jargon.
- [x] Refusé : moteur `yt-dlp` `player_client=android_vr` (choisi pour échapper au PO token = contournement anti-bot).
- [x] Testé en natif : album Werenoi « Diamant Noir » (3:50 complet, démarrage < 2 s), file + aléatoire. Couverture de l'album : 15/18 en version complète (1 sans correspondance ±4 s, 2 refusés par le seul relais actif → extrait).

### v0.0.4 — Moteur hybride
- [x] Recherche et correspondance en local avec `rustypipe` (YouTube Music direct, plus de Piped) : 0,3-0,9 s au lieu de 0,6-4 s.
- [x] Flux audio via relais Invidious conservé (YouTube coupe l'accès direct après le 1er segment sans jeton Botguard, que Korz ne génère pas).
- [x] Repli recherche via relais si YouTube Music est injoignable ; relais triés par latence, annuaire public au démarrage.
- [x] Cache (trackId→videoId persistant, formats, 8 premiers segments) et pré-chargement (suivant, survol, premiers titres affichés) inchangés.
- [x] Tests : correspondance, Content-Range jamais au-delà de la fin du fichier, test réseau qui sert un titre entier octet par octet.
- [x] Testé en natif : Werenoi (3:12, lecture continue), Avie « LUNA&MONICA » (2:39, démarrage < 2 s).
- [x] Nettoyage des fichiers de test, `rustypipe_cache.json` et `rustypipe_reports/` ajoutés au `.gitignore`.

### v0.0.3 — Lecture complète
- [x] Badge « Extrait » supprimé ; Deezer ne sert plus que de base de métadonnées.
- [x] `FullStreamResolver` Rust (`stream.rs`) : recherche Piped `music_songs` (pistes officielles YouTube Music), repli Invidious ; instances triées par latence, bascule après 5 s, annuaires publics au démarrage.
- [x] Correspondance stricte : piste officielle prioritaire, artiste principal obligatoire, ≥ 70 % des mots du titre, exclusion remix/slowed/reverb/nightcore/8d/karaoke/cover/live/clip/sped up/instrumental sauf si demandé, durée Deezer ±4 s.
- [x] Streaming direct par plages (protocole `korzstream://`), premier segment 256 Ko puis 1 Mo, `Content-Range` réécrit (corrige l'erreur média à 0:01 sur les WebM).
- [x] Cache : trackId→videoId persistant, formats et premiers segments en mémoire ; pré-résolution du titre suivant, des titres survolés et des premiers titres affichés.
- [x] `AudioProvider` : local, flux complet, extraits Deezer (désactivés par défaut) ; section « Sources audio » dans les Paramètres.
- [x] Testé en natif : Werenoi (3:12 complet), Avie « LUNA&MONICA » (2:39 complet), enchaînement suivant < 1,5 s.

### v0.0.2 — Vrai catalogue, recherche style Spotify, bibliothèque locale
- [x] Projet déplacé sur un chemin court (`E:\Korz`), dépôt git initialisé (commit v0.0.1).
- [x] Renommage en **Korz** : config Tauri, identifiant `com.korz.app`, crate `korz`, titre, logo (`app-icon.svg` + icônes générées).
- [x] `services/musicApi.ts` : API publique Deezer via `plugin-http` (Rust, sans CORS), repli iTunes Search. Vrais artistes, pochettes HD, durées, extraits audio.
- [x] Filtre strict : karaoké, tribute, 8D, slowed, nightcore, sped up, remix exclus sauf demande ; doublons supprimés ; reprises peu populaires d'un même titre écartées ; profils « squatteurs » de nom exclus.
- [x] Barre de recherche dans la top bar + menu flottant : suggestions texte, carte artiste (photo ronde, badge, S'abonner/Abonné), cartes titres (pochette, badge E, artistes, bouton +), navigation clavier ↑/↓/Entrée/Échap, debounce 200 ms, cache Zustand, stale-while-revalidate.
- [x] Page recherche complète (meilleur résultat artiste ou titre, titres, artistes, liste virtualisée).
- [x] Page artiste réelle : photo officielle, fond flouté, fans, top titres, discographie dédoublonnée, abonnement ; préchargement au survol.
- [x] Accueil : charts Deezer (titres + artistes du moment) et abonnements.
- [x] Bibliothèque : titres likés, artistes suivis, fichiers locaux (dialogue dossier, scan récursif MP3/FLAC/WAV/M4A/AAC/OGG/OPUS, lecture via asset protocol, accès conservé entre sessions).
- [x] Tests unitaires du filtre, du classement, des suggestions, de l'expiration des previews et du parsing de fichiers.

### v0.0.1 — Fondations
- [x] Tauri v2 + React + TS strict + Tailwind v4, plugins store/fs/dialog/os/window-state.
- [x] Layout sombre, lecteur persistant (Radix Slider), navigation instantanée, liste virtualisée, paramètres persistés, toggle accélération matérielle (Rust).

Limites connues v0.0.3 :
- Lecture complète dépendante de 1-2 instances publiques Piped/Invidious ; usage personnel uniquement (CGU YouTube).
- Fichiers locaux : métadonnées tirées du nom de fichier ; albums non cliquables.

### v0.0.7 — Featurings, robustesse du flux et paroles enrichies

- [x] Featurings affichés partout (lecteur, file, recherche, bibliothèque) : `featuredFromTitle`, `mergeArtists`, `allArtists`, store `credits.ts` (fetch Deezer contributors throttlé, persisté 3 000 titres).
- [x] Correctif délai relais : limite stricte 1,5 s au 1er essai seulement — évite le fallback extrait quand le seul relais répond en 1-2 s.
- [x] Préchargement des titres suivant+1 et suivant+2 ; annulation des prefetches obsolètes sur skip rapide (`cancelStalePrefetches`).
- [x] Fallback paroles YouTube Music : si LRCLIB ne trouve rien, essai `ytm_lyrics` via le backend Rust.
- [x] Recherche par extrait de paroles : requête > 15 caractères → section « Résultats paroles » en bas de la page de recherche (via `lyrics_search` Rust, YouTube Music).
- [x] Commandes Rust `ytm_lyrics` et `lyrics_search` exposées dans `lib.rs`.

### v0.0.8 — Korz Manager (système de licences)

- [x] Backend Cloudflare Workers + D1 + KV (`worker/`) : génération de clés `KORZ-XXXX-XXXX-XXXX-XXXX`, activation (liaison HWID), vérification/heartbeat, API admin protégée par bearer token.
- [x] Commande Rust `get_hwid` : lit `MachineGuid` depuis le registre Windows, hache en SHA-256 (32 hex), exposée dans `generate_handler!`.
- [x] Intégration client Korz : store `license.ts` (hydration, activation, heartbeat 2 min), écran d'activation `ActivationScreen.tsx`, gate dans `App.tsx`, mode grâce si réseau indisponible.
- [x] Panneau admin `admin-panel/` : app Tauri séparée, layout sidebar (Suivi Live) + générateur de clés (durée, quantité) + table des licences (statut, expiration, actions révoquer/+7j/copier), auto-refresh 10 s.

## Prochaine version : v0.0.9

- [ ] Paroles syllabiques (`@braccato/core` + `@braccato/parsers`).
- [ ] Discord Rich Presence.
- [ ] Mini-player flottant (multi-window Tauri).
- [ ] Import de playlists Spotify / Apple Music / Deezer.
