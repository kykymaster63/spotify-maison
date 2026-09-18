<template>
  <div class="favorites-page">
    <header class="page-header">
      <div class="header-cover">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 20s-7.5-4.6-9.7-9.1C.7 7.8 2.3 4.5 5.6 4.1c1.9-.2 3.5.7 4.4 2.1.9-1.4 2.5-2.3 4.4-2.1 3.3.4 4.9 3.7 3.3 6.8C19.5 15.4 12 20 12 20z"/>
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
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" opacity=".3">
        <path d="M12 20s-7.5-4.6-9.7-9.1C.7 7.8 2.3 4.5 5.6 4.1c1.9-.2 3.5.7 4.4 2.1.9-1.4 2.5-2.3 4.4-2.1 3.3.4 4.9 3.7 3.3 6.8C19.5 15.4 12 20 12 20z" stroke="currentColor" stroke-width="1.4"/>
      </svg>
      <span>Aucun favori pour l'instant — clique sur le coeur d'un morceau.</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import TrackList from '../components/TrackList.vue'
import { usePlayerStore } from '../stores/player.js'

const tracks = ref([])
const loading = ref(true)
const player = usePlayerStore()

async function load() {
  loading.value = true
  const { data } = await axios.get('/api/favorites')
  tracks.value = data
  loading.value = false
}
function playAll() {
  if (tracks.value.length) player.play(tracks.value[0], tracks.value)
}
onMounted(load)
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
