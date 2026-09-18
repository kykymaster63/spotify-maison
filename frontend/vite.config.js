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
        name: 'Spotify Maison',
        short_name: 'SpotifyMaison',
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/tracks\/.*\/stream/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }
            }
          }
        ]
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
        changeOrigin: true
      }
    }
  }
})
