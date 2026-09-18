<template>
  <div class="artists-page">
    <header class="page-header">
      <h1>Artistes</h1>
    </header>

    <div v-if="artists.length" class="artists-grid">
      <MediaTile
        v-for="a in artists" :key="a.name"
        rounded
        :cover="a.coverUrl" :title="a.name" :subtitle="`${a.trackCount} morceau${a.trackCount > 1 ? 'x' : ''}`"
        @click="router.push(`/artist/${encodeURIComponent(a.name)}`)"
      />
    </div>

    <div v-else-if="!loading" class="empty-state">
      <span>Aucun artiste pour l'instant.</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import MediaTile from '../components/MediaTile.vue'

const router = useRouter()
const artists = ref([])
const loading = ref(true)

async function load() {
  loading.value = true
  const { data } = await axios.get('/api/artists')
  artists.value = data
  loading.value = false
}
onMounted(load)
</script>

<style scoped>
.artists-page { padding: 24px 20px; max-width: 860px; margin: 0 auto; }
.page-header { margin-bottom: 24px; }
h1 { font-size: 24px; font-weight: 800; }

.artists-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 20px 16px;
}

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  color: var(--text-3); padding: 48px 0; font-size: 13px; text-align: center;
}
</style>
