<template>
  <div class="favorites-page">
    <header class="page-header">
      <div class="header-cover">
        <svg width="30" height="30" viewBox="-1 -1 26 26" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </div>
      <div>
        <p class="page-type">Playlist</p>
        <h1>Favoris</h1>
        <p class="page-sub">{{ tracks.length }} morceau{{ tracks.length > 1 ? 's' : '' }} liké{{ tracks.length > 1 ? 's' : '' }}</p>
      </div>
    </header>

    <button v-if="tracks.length" class="btn btn-primary play-all" @click="playAll">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      Lecture
    </button>

    <TrackList :tracks="tracks" />

    <div v-if="!loading && !tracks.length" class="empty-state">
      <svg width="32" height="32" viewBox="-1 -1 26 26" fill="none" opacity=".3">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="1.4"/>
      </svg>
      <span>Aucun favori pour l'instant — clique sur le coeur d'un morceau.</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import axios from 'axios'
import TrackList from '../components/TrackList.vue'
import { usePlayerStore } from '../stores/player.js'
import { useJamStore } from '../stores/jam.js'
import { useFavoritesStore } from '../stores/favorites.js'

const tracks = ref([])
const loading = ref(true)
const player = usePlayerStore()
const jam = useJamStore()
const favorites = useFavoritesStore()

async function load() {
  loading.value = true
  const { data } = await axios.get('/api/favorites')
  tracks.value = data
  loading.value = false
}
function playAll() {
  if (!tracks.value.length) return
  if (jam.isFollower) jam.leave()
  player.play(tracks.value[0], tracks.value)
}
onMounted(load)
// Le nombre de favoris est la seule source commune à toute l'app (voir
// stores/favorites.js) : sans ça, liker un morceau depuis le lecteur (pas
// depuis cette page) ne le faisait apparaître ici qu'après un rechargement.
watch(() => favorites.ids.size, load)
</script>

<style scoped>
.favorites-page { padding: 24px 20px; max-width: 860px; margin: 0 auto; }
.page-header { display: flex; align-items: center; gap: 18px; margin-bottom: 20px; }
.header-cover {
  width: 88px; height: 88px; border-radius: var(--r-lg); flex-shrink: 0;
  background: linear-gradient(135deg, #ff5d8f 0%, #7c5cfc 100%);
  display: flex; align-items: center; justify-content: center; color: #fff;
  box-shadow: 0 12px 32px rgba(255,93,143,0.35);
}
.page-type { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-3); }
h1 { font-size: 26px; font-weight: 800; margin: 2px 0; }
.page-sub { font-size: 13px; color: var(--text-2); }

.play-all { margin-bottom: 20px; gap: 8px; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  color: var(--text-3); padding: 48px 0; font-size: 13px; text-align: center;
}
</style>
