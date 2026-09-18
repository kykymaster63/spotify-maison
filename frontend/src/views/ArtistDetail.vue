<template>
  <div class="artist-page">
    <header class="page-header">
      <div class="artist-cover">
        <img v-if="coverUrl" :src="coverUrl" alt="" />
        <div v-else class="cover-fallback">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
            <path d="M4 20c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
      <div>
        <p class="page-type">Artiste</p>
        <h1>{{ artistName }}</h1>
      </div>
    </header>

    <div v-if="albums.length" class="albums-grid">
      <MediaTile
        v-for="a in albums" :key="a.albumKey"
        :cover="a.coverUrl" :title="a.isSingles ? 'Singles' : a.album"
        :subtitle="`${a.trackCount} morceau${a.trackCount > 1 ? 'x' : ''} · ${fmtDuration(a.totalDuration)}`"
        @click="router.push(`/artist/${encodeURIComponent(artistName)}/album/${encodeURIComponent(a.albumKey)}`)"
      />
    </div>

    <div v-else-if="!loading" class="empty-state">
      <span>Aucun morceau pour cet artiste.</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import MediaTile from '../components/MediaTile.vue'

const route = useRoute()
const router = useRouter()
const artistName = computed(() => route.params.artist)
const albums = ref([])
const loading = ref(true)

const coverUrl = computed(() => albums.value.find(a => a.coverUrl)?.coverUrl || null)

function fmtDuration(seconds) {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${(m % 60).toString().padStart(2, '0')}`
}

async function load() {
  loading.value = true
  const { data } = await axios.get(`/api/artists/${encodeURIComponent(artistName.value)}/albums`)
  albums.value = data
  loading.value = false
}
onMounted(load)
watch(artistName, load)
</script>

<style scoped>
.artist-page { padding: 24px 20px; max-width: 860px; margin: 0 auto; }
.page-header { display: flex; align-items: center; gap: 18px; margin-bottom: 28px; }
.artist-cover {
  width: 88px; height: 88px; border-radius: 50%; flex-shrink: 0;
  background: var(--bg-3); overflow: hidden;
  display: flex; align-items: center; justify-content: center; color: var(--text-3);
}
.artist-cover img { width: 100%; height: 100%; object-fit: cover; }
.page-type { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-3); }
h1 { font-size: 26px; font-weight: 800; margin: 2px 0; }

.albums-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 20px 16px;
}

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  color: var(--text-3); padding: 48px 0; font-size: 13px; text-align: center;
}
</style>
