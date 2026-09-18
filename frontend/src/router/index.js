import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue'), meta: { public: true } },
  { path: '/', name: 'Home', component: () => import('../views/Home.vue') },
  { path: '/library', name: 'Library', component: () => import('../views/Library.vue') },
  { path: '/search', name: 'Search', component: () => import('../views/Search.vue') },
  { path: '/import', name: 'Import', component: () => import('../views/Import.vue') },
  { path: '/favorites', name: 'Favorites', component: () => import('../views/Favorites.vue') },
  { path: '/settings', name: 'Settings', component: () => import('../views/Settings.vue') },
  { path: '/friends', name: 'Friends', component: () => import('../views/Friends.vue') },
  { path: '/history', name: 'History', component: () => import('../views/History.vue') },
  { path: '/artists', name: 'Artists', component: () => import('../views/Artists.vue') },
  { path: '/artist/:artist', name: 'ArtistDetail', component: () => import('../views/ArtistDetail.vue') },
  { path: '/artist/:artist/album/:album', name: 'AlbumDetail', component: () => import('../views/AlbumDetail.vue') },
  { path: '/playlist/:id', name: 'Playlist', component: () => import('../views/Playlist.vue') },
  { path: '/spotify-import', name: 'SpotifyImportTool', component: () => import('../views/SpotifyImportTool.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.token) return { name: 'Login' }
})

export default router
