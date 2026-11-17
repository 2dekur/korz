# Roadmap — Korz

**Version actuelle : v0.0.5** (validée : `npm run build`, `npm test`, `cargo check`, `cargo test` dont tests réseau, lecture native Werenoi/Avie)

## Historique

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

## Prochaine version : v0.0.6 — Robustesse du flux et confort
- [ ] Indicateur discret de disponibilité du Lecteur Global dans Paramètres > Sources audio.
- [ ] Raccourcis clavier (Espace, ←/→, Ctrl+K).
- [ ] Tags et pochettes des fichiers locaux (`lofty`).
- [ ] Persistance de la file d'attente entre deux lancements.
