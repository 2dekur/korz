# Roadmap — KORZ Music

**Version actuelle : v0.0.2** (Smart Link). L'historique 0.0.1 → 0.0.8 de l'ancienne base est sous le tag git `legacy-v0.0.8`.

## Historique

### v0.0.1 — Nouvelle fondation
- Nouveau moteur audio intégré : lecture de vos fichiers MP3, FLAC, WAV, AAC, M4A (AAC et ALAC) et OGG, avec pause, reprise, précédent, suivant, déplacement dans le titre et volume mémorisé.
- Bibliothèque locale : ajoutez vos dossiers, KORZ lit les tags et les pochettes sans jamais toucher aux fichiers. Albums, artistes et titres, analyse incrémentale.
- Favoris, historique d'écoute (Accueil : écoutés récemment, ajouts récents) et playlists (créer, renommer, supprimer, ajouter, retirer).
- Recherche instantanée dans la bibliothèque, sans tenir compte des accents ni des majuscules (« cote ouest » trouve « Côte Ouest »), Ctrl+K ; file d'attente ; Espace pour lecture/pause.
- « Importer un lien » reconnaît les liens Spotify, YouTube, Deezer, Apple Music et SoundCloud (identification seulement pour l'instant).
- Base de données locale SQLite, journal d'erreurs consultable depuis les Paramètres.
- Mises à jour automatiques : KORZ vérifie au lancement si une nouvelle version est publiée et l'installe en un clic (aussi dans Paramètres > Mises à jour).
- Retirés par rapport aux versions précédentes : lecture en ligne YouTube (contraire aux conditions de YouTube), catalogue Deezer, paroles, licences. Les anciennes versions Korz 0.0.x ne se mettent pas à jour vers KORZ Music : désinstallez-les puis installez celle-ci.

### v0.0.2 — Smart Link
- Collez un lien dans la barre de recherche (ou sur « Importer un lien ») : KORZ reconnaît sa provenance et agit selon votre réglage.
- Liens audio directs (MP3, FLAC, WAV, AAC, M4A, OGG) : lecture immédiate, ajout à la file d'attente ou import permanent dans votre bibliothèque. Les pages web et les faux fichiers sont refusés, les doublons détectés, et un téléchargement interrompu ne laisse jamais de fichier abîmé.
- Liens YouTube et Spotify : KORZ lit leurs informations publiques (titre, artiste, pochette) et retrouve le morceau dans votre bibliothèque. Il ne lit ni ne télécharge jamais le contenu de ces services.
- Carte de confirmation : pochette, source, format, niveau de certitude, choix parmi plusieurs correspondances.
- Nouveau réglage « Liens » : Automatique (par défaut), Toujours confirmer ou Lecture immédiate, et choix du dossier d'import.

## À suivre — Lecteur complet
- [ ] Aléatoire et répétition (moteur Rust), réorganisation et retrait dans la file d'attente.
- [ ] Surveillance des dossiers (ajouts / suppressions détectés sans réanalyse manuelle).
- [ ] Réordonner les titres d'une playlist (glisser-déposer).
- [ ] Contrôles multimédia Windows (touches clavier, SMTC).

## Ensuite
- v0.0.3 : genres, tri et filtres de la bibliothèque, édition non destructive des métadonnées affichées.
- v0.0.4 : KORZ CONNECT — premier service via API officielle (métadonnées et playlists), KORZ COMPLIANCE (capacités par service).
