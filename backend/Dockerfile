FROM node:20-alpine

# yt-dlp + ffmpeg pour l'extraction audio YouTube, + deno : yt-dlp en a besoin
# pour résoudre le défi JS ("n-parameter") que YouTube impose sur une partie
# des vidéos — sans ça, celles-ci échouent en 403 Forbidden au téléchargement
# alors que les autres passent (deno est le seul runtime auto-détecté).
RUN apk add --no-cache python3 py3-pip ffmpeg curl deno && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
