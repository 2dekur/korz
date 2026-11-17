# Roadmap — Resonance

**Version actuelle : v0.0.1** (validée : `npm run build`, `npm test`, `cargo check` OK)

## Historique

### v0.0.1 — Fondations
- [x] Projet Tauri v2 + React + TS strict + Tailwind v4 initialisé.
- [x] Plugins Tauri : store, fs, dialog, os, window-state (Rust + JS + capabilities).
- [x] Dépendances : zustand, react-virtual, lucide, framer-motion, clsx, tailwind-merge, sonner, Radix (slider, dialog, switch, tooltip), polices Inter + Plus Jakarta Sans locales.
- [x] Architecture `src/{components/{ui,player,layout,track},pages,store,services,types,hooks,lib}`.
- [x] Layout sombre : sidebar fixe (Accueil, Recherche, Bibliothèque, artistes, profil → Paramètres), top bar back/forward.
- [x] Lecteur persistant : play/pause, précédent/suivant, progression fluide (rAF), seek au relâchement, volume + mute persistés, Media Session (touches média OS).
- [x] Navigation instantanée (Zustand) avec historique ; vue artiste dédiée.
- [x] Recherche locale : debounce 200 ms, cache par requête, filtrage strict insensible aux accents.
- [x] Liste de titres virtualisée (`@tanstack/react-virtual`).
- [x] Paramètres : qualité audio, accélération matérielle (appliquée côté Rust au démarrage), profil local (nom, couleur), réinitialisation (Radix Dialog), infos système (plugin-os). Sauvegarde automatique via plugin-store.

Limites connues v0.0.1 :
- Pistes de test = MP3 de démo SoundHelix (réseau requis). Le réglage « qualité audio » est stocké mais n'a pas encore d'effet.
- Durées affichées seulement après chargement des métadonnées d'un titre.
- Fenêtre native (`tauri dev`) non testée visuellement ; front validé dans le navigateur, Rust validé par `cargo check`.

## Prochaine version : v0.0.2 — Bibliothèque locale
- [ ] Import de dossiers audio via `plugin-dialog` + lecture des fichiers via `plugin-fs` / `convertFileSrc` (scope fs restreint au dossier choisi).
- [ ] Lecture des tags (titre, artiste, album, durée, pochette) côté Rust (`lofty`) pour des durées et métadonnées immédiates.
- [ ] Cache de la bibliothèque dans plugin-store ; rescan incrémental.
- [ ] Remplacer le catalogue de test par la bibliothèque locale (garder le catalogue démo si vide).
- [ ] Test de charge : 10 000 titres virtualisés, défilement fluide mesuré.
- [ ] Raccourcis clavier (Espace, ←/→, Ctrl+F).
- [ ] Valider `tauri dev` sur Windows (fenêtre, window-state, toggle GPU).
