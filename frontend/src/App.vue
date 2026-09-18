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
import Player from './components/Player.vue'
import Navbar from './components/Navbar.vue'
import TopBar from './components/TopBar.vue'
import ToastStack from './components/ToastStack.vue'

const auth = useAuthStore()
const player = usePlayerStore()

// Barre d'espace = lecture/pause, sauf si on tape dans un champ
function onKeydown(e) {
  if (e.code !== 'Space') return
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (!player.currentTrack) return
  e.preventDefault()
  player.togglePlay()
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  if (auth.isLoggedIn) player.restoreLastTrack()
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
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
