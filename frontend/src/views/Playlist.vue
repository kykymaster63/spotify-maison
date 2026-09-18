<template>
  <div class="playlist-page">
    <div v-if="playlist" class="content">
      <!-- Header -->
      <div class="pl-header">
        <div class="pl-cover">
          <img v-if="playlist.cover_url" :src="playlist.cover_url" alt="" />
          <div v-else class="cover-default">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M9 18V6l12-2v12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              <circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.2"/>
              <circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.2"/>
            </svg>
          </div>
        </div>
        <div class="pl-info">
          <p class="pl-type">Playlist</p>
          <h1>{{ playlist.name }}</h1>
          <p v-if="playlist.description" class="pl-desc">{{ playlist.description }}</p>
          <div class="pl-meta">
            <span>{{ playlist.tracks?.length || 0 }} morceaux</span>
            <span class="dot">·</span>
            <span>{{ playlist.is_public ? 'Publique' : 'Privée' }}</span>
          </div>
          <div class="pl-actions">
            <button class="btn btn-primary play-all" @click="playAll" :disabled="!readyTracks.length">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Lecture
            </button>
          </div>
        </div>
      </div>

      <!-- Tracks -->
      <TrackList :tracks="playlist.tracks || []" />
    </div>

    <div v-else class="loading">
      <div class="spin"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import TrackList from '../components/TrackList.vue'
import { usePlayerStore } from '../stores/player.js'

const route = useRoute()
const player = usePlayerStore()
const playlist = ref(null)
const readyTracks = computed(() => playlist.value?.tracks?.filter(t => t.status === 'ready') || [])

function playAll() {
  if (!readyTracks.value.length) return
  player.play(readyTracks.value[0], readyTracks.value)
}

onMounted(async () => {
  const { data } = await axios.get(`/api/playlists/${route.params.id}`)
  playlist.value = data
})
</script>

<style scoped>
.playlist-page { padding: 24px 20px; max-width: 860px; margin: 0 auto; }

.pl-header {
  display: flex; gap: 24px; align-items: flex-end; margin-bottom: 36px;
}
.pl-cover {
  width: 200px; height: 200px; flex-shrink: 0; border-radius: var(--r-lg);
  background: var(--gradient-soft); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
}
.pl-cover img { width: 100%; height: 100%; object-fit: cover; }
.cover-default { color: var(--accent); }

.pl-info { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.pl-type { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent); }
h1 { font-size: 32px; font-weight: 800; line-height: 1.1; margin: 4px 0; }
.pl-desc { font-size: 14px; color: var(--text-2); }
.pl-meta { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-3); }
.dot { color: var(--text-3); }
.pl-actions { margin-top: 12px; }
.play-all { gap: 8px; }

.loading { display: flex; align-items: center; justify-content: center; height: 200px; }
.spin {
  width: 28px; height: 28px; border: 2px solid rgba(255,255,255,.1);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 600px) {
  .pl-header { flex-direction: column; align-items: center; text-align: center; }
  .pl-cover { width: 160px; height: 160px; }
  h1 { font-size: 24px; }
  .pl-meta { justify-content: center; }
}
</style>
