#!/bin/sh
# yt-dlp était téléchargé une seule fois à la construction de l'image Docker,
# qui reste en cache tant que le Dockerfile ne change pas — le binaire peut
# rester figé des semaines pendant que YouTube fait évoluer ses protections,
# ce qui finit par provoquer des 403 Forbidden sur certaines vidéos. On le
# met à jour à chaque démarrage du conteneur (backend comme worker) plutôt
# qu'uniquement au build.
yt-dlp -U 2>&1 || true

exec "$@"
