import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // Le plugin est désactivé par défaut en mode dev (npm run dev), or c'est
      // justement ce serveur que le téléphone appelle pour tester la PWA :
      // sans ça, aucun manifest.webmanifest n'est servi -> iOS ne détecte pas
      // une "vraie" web app et ouvre l'icône comme un simple onglet Safari.
      devOptions: { enabled: true, type: 'module' },
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        id: '/',
        scope: '/',
        name: 'Hostify',
        short_name: 'Hostify',
        description: 'Votre musique, partout',
        theme_color: '#0d0d1a',
        background_color: '#07070f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      // Le cache audio hors-ligne est géré nous-mêmes (voir stores/player.js) :
      // l'endpoint /stream répond en 206 (Range) selon le lecteur, et laisser
      // Workbox le mettre en cache automatiquement risquerait de figer un
      // morceau sur un unique segment partiel plutôt que le fichier complet.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  server: {
    // Sous Docker Desktop (Windows/Mac), les événements fs des volumes montés
    // n'atteignent pas toujours chokidar -> on force le polling pour que le
    // hot-reload voie bien les fichiers modifiés depuis l'hôte.
    watch: { usePolling: true, interval: 300 },
    proxy: {
      '/api': {
        target: 'http://backend:3000',
        changeOrigin: true,
        ws: true // nécessaire pour que le canal temps réel du Jam (websocket) passe par le proxy dev
      }
    }
  }
})
