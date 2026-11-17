# Roadmap — Korz

**Version actuelle : v0.0.2** (validée : `npm run build`, `npm test`, `cargo check`, `npm run tauri dev`)

## Historique

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

Limites connues v0.0.2 :
- Catalogue public = extraits de 30 s (badge « Extrait » dans le lecteur).
- Fichiers locaux : métadonnées tirées du nom de fichier (`Artiste - Titre.ext`) et du dossier ; pas encore de lecture des tags ni des pochettes intégrées.
- Albums affichés mais pas encore cliquables.

## Prochaine version : v0.0.3 — Albums, tags et file d'attente
- [ ] Page album (Deezer `/album/{id}`) depuis la discographie et les titres.
- [ ] Lecture des tags (titre, artiste, album, durée, pochette) des fichiers locaux côté Rust (`lofty`).
- [ ] File d'attente visible (panneau latéral), aléatoire et répétition.
- [ ] Raccourcis clavier globaux (Espace, ←/→, Ctrl+K pour la recherche).
- [ ] Test de charge : 10 000 titres locaux virtualisés, défilement mesuré.
- [ ] Barre de titre personnalisée (décorations natives désactivées) cohérente avec le thème.
