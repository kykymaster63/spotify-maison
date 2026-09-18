<template>
  <div class="album-page">
    <header class="page-header">
      <div class="album-cover">
        <img v-if="album?.coverUrl" :src="album.coverUrl" alt="" />
        <div v-else class="cover-fallback">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path d="M9 18V6l12-2v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </div>
      </div>
      <div>
        <p class="page-type">Album</p>
        <h1>{{ album?.isSingles ? 'Singles' : album?.album }}</h1>
        <p class="page-sub">
          <router-link :to="`/artist/${encodeURIComponent(artistName)}`" class="artist-link">{{ artistName }}</router-link>
          <template v-if="album">
            · {{ album.tracks.length }} morceau{{ album.tracks.length > 1 ? 'x' : '' }} · {{ fmtDuration(album.totalDuration) }}
          </template>
        </p>
      </div>
    </header>

    <button v-if="album?.tracks.length" class="btn btn-primary play-all" @click="playAll">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      Lecture
    </button>

    <TrackList v-if="album" :tracks="album.tracks" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import TrackList from '../components/TrackList.vue'
import { usePlayerStore } from '../stores/player.js'
import { useJamStore } from '../stores/jam.js'

const route = useRoute()
const player = usePlayerStore()
const jam = useJamStore()
const artistName = computed(() => route.params.artist)
const albumKey = computed(() => route.params.album)
const album = ref(null)

function fmtDuration(seconds) {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${(m % 60).toString().padStart(2, '0')}`
}

async function load() {
  album.value = null
  const { data } = await axios.get(`/api/artists/${encodeURIComponent(artistName.value)}/albums/${encodeURIComponent(albumKey.value)}`)
  album.value = data
}

function playAll() {
  if (!album.value?.tracks.length) return
  if (jam.isFollower) jam.leave()
  player.play(album.value.tracks[0], album.value.tracks)
}

onMounted(load)
watch([artistName, albumKey], load)
</script>

<style scoped>
.album-page { padding: 24px 20px; max-width: 860px; margin: 0 auto; }
.page-header { display: flex; align-items: center; gap: 18px; margin-bottom: 20px; }
.album-cover {
  width: 88px; height: 88px; border-radius: var(--r-lg); flex-shrink: 0;
  background: var(--bg-3); overflow: hidden;
  display: flex; align-items: center; justify-content: center; color: var(--text-3);
  box-shadow: 0 12px 32px rgba(0,0,0,0.35);
}
.album-cover img { width: 100%; height: 100%; object-fit: cover; }
.page-type { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-3); }
h1 { font-size: 24px; font-weight: 800; margin: 2px 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.page-sub { font-size: 13px; color: var(--text-2); }
.artist-link { color: var(--text-2); text-decoration: none; }
.artist-link:hover { color: var(--text); text-decoration: underline; }

.play-all { margin-bottom: 20px; gap: 8px; }
</style>
