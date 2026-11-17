# Roadmap — Korz

**Version actuelle : v0.0.3** (validée : `npm run build`, `npm test`, `cargo check`, `cargo test` dont tests réseau, lecture native Werenoi/Avie)

## Historique

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

## Prochaine version : v0.0.4 — Moteur autonome, albums, file d'attente
- [ ] Extraction YouTube Music directement en Rust (crate `rustypipe`) : plus de dépendance aux instances publiques.
- [ ] Page album (Deezer `/album/{id}`) depuis la discographie et les titres.
- [ ] File d'attente visible, aléatoire, répétition ; raccourcis clavier (Espace, ←/→, Ctrl+K).
- [ ] Tags et pochettes des fichiers locaux (`lofty`).
