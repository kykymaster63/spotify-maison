<template>
  <div class="app-shell">
    <TopBar v-if="auth.isLoggedIn" />
    <ToastStack />
    <div class="page-content" :class="{ 'with-topbar': auth.isLoggedIn }">
      <Transition name="page" mode="out-in">
        <router-view />
      </Transition>
    </div>
    <Player v-if="auth.isLoggedIn" />
    <Navbar v-if="auth.isLoggedIn" />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from './stores/auth.js'
import { usePlayerStore } from './stores/player.js'
import { useToastStore } from './stores/toast.js'
import { useFavoritesStore } from './stores/favorites.js'
import { useJamStore } from './stores/jam.js'
import { useThemeStore } from './stores/theme.js'
import Player from './components/Player.vue'
import Navbar from './components/Navbar.vue'
import TopBar from './components/TopBar.vue'
import ToastStack from './components/ToastStack.vue'

const auth = useAuthStore()
const player = usePlayerStore()
const toast = useToastStore()
const favorites = useFavoritesStore()
const jam = useJamStore()
useThemeStore() // applique le thème sauvegardé dès le montage de l'app

function onOffline() { toast.error('Hors ligne — seuls les morceaux téléchargés sont disponibles') }
function onOnline() { toast.success('Connexion rétablie') }

// Raccourcis clavier (marchent aussi avec les boutons programmables d'une
// souris/clavier Logitech une fois mappés sur ces touches dans Logitech Options)
function onKeydown(e) {
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (!player.currentTrack) return

  // Pendant un Jam suivi, seul l'hôte contrôle la transport (lecture/pause,
  // avance/retour, piste suivante/précédente) — le volume reste local à
  // chacun donc n'est pas concerné.
  const transportKeys = ['Space', 'ArrowRight', 'ArrowLeft', 'KeyN', 'KeyP']
  if (transportKeys.includes(e.code) && jam.isFollower) {
    e.preventDefault()
    jam.guardControl()
    return
  }

  switch (e.code) {
    case 'Space':
      e.preventDefault()
      player.togglePlay()
      break
    case 'ArrowRight':
      e.preventDefault()
      player.seek(player.progress + 10)
      break
    case 'ArrowLeft':
      e.preventDefault()
      player.seek(player.progress - 10)
      break
    case 'ArrowUp':
      e.preventDefault()
      player.setVolume(Math.min(1, Math.round((player.volume + 0.1) * 100) / 100))
      break
    case 'ArrowDown':
      e.preventDefault()
      player.setVolume(Math.max(0, Math.round((player.volume - 0.1) * 100) / 100))
      break
    case 'KeyN':
      player.next()
      break
    case 'KeyP':
      player.prev()
      break
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('offline', onOffline)
  window.addEventListener('online', onOnline)
  if (auth.isLoggedIn) {
    player.restoreLastTrack()
    favorites.load()
  }
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('offline', onOffline)
  window.removeEventListener('online', onOnline)
})
</script>

<style>
.app-shell {
  display: flex; flex-direction: column;
  height: 100dvh; overflow: hidden;
}
.page-content {
  flex: 1; overflow-y: auto;
  padding-bottom: calc(var(--player-height) + var(--nav-height) + var(--safe-bottom) + 8px);
}
.page-content.with-topbar { padding-top: calc(var(--topbar-height) + var(--safe-top)); }

/* Transitions de page */
.page-enter-active, .page-leave-active { transition: opacity .18s, transform .18s; }
.page-enter-from { opacity: 0; transform: translateY(6px); }
.page-leave-to   { opacity: 0; transform: translateY(-6px); }
</style>
