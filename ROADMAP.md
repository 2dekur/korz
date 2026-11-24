# Roadmap — KORZ Music

**Version actuelle : v0.0.1** (reboot de l'architecture). L'historique 0.0.1 → 0.0.8 de l'ancienne base est sous le tag git `legacy-v0.0.8`.

## Historique

### v0.0.1 — Nouvelle fondation
- Nouveau moteur audio intégré : lecture de vos fichiers MP3, FLAC, WAV, AAC, M4A (AAC et ALAC) et OGG, avec pause, reprise, précédent, suivant, déplacement dans le titre et volume mémorisé.
- Bibliothèque locale : ajoutez vos dossiers, KORZ lit les tags et les pochettes sans jamais toucher aux fichiers. Albums, artistes et titres, analyse incrémentale.
- Favoris, historique d'écoute (Accueil : écoutés récemment, ajouts récents) et playlists (créer, renommer, supprimer, ajouter, retirer).
- Recherche instantanée dans la bibliothèque (Ctrl+K), file d'attente, Espace pour lecture/pause.
- « Importer un lien » reconnaît les liens Spotify, YouTube, Deezer, Apple Music et SoundCloud (identification seulement pour l'instant).
- Base de données locale SQLite, journal d'erreurs consultable depuis les Paramètres.
- Retirés par rapport aux versions précédentes : lecture en ligne YouTube (contraire aux conditions de YouTube), catalogue Deezer, paroles, mises à jour automatiques, licences.

## Prochaine version : v0.0.2 — Lecteur complet
- [ ] Aléatoire et répétition (moteur Rust), réorganisation et retrait dans la file d'attente.
- [ ] Recherche insensible aux accents (colonne normalisée en base).
- [ ] Surveillance des dossiers (ajouts / suppressions détectés sans réanalyse manuelle).
- [ ] Réordonner les titres d'une playlist (glisser-déposer).
- [ ] Contrôles multimédia Windows (touches clavier, SMTC).

## Ensuite
- v0.0.3 : genres, tri et filtres de la bibliothèque, édition non destructive des métadonnées affichées.
- v0.0.4 : KORZ CONNECT — premier service via API officielle (métadonnées et playlists), KORZ COMPLIANCE (capacités par service).
- v0.0.5 : Smart Link → correspondance avec la bibliothèque locale.
- Mises à jour automatiques réactivées dès qu'une release ≥ 0.0.9 rend la numérotation cohérente (ou nouveau canal).
