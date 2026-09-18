<template>
  <div class="history-page">
    <header class="page-header">
      <div>
        <p class="page-type">Historique</p>
        <h1>Récemment écouté</h1>
      </div>
      <button v-if="tracks.length" class="link-btn" @click="clear">Effacer</button>
    </header>

    <TrackList :tracks="tracks" />

    <div v-if="!loading && !tracks.length" class="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" opacity=".3">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
        <path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span>Rien écouté pour l'instant.</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import TrackList from '../components/TrackList.vue'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()
const tracks = ref([])
const loading = ref(true)

async function load() {
  loading.value = true
  const { data } = await axios.get('/api/me/history')
  tracks.value = data
  loading.value = false
}

async function clear() {
  if (!confirm('Effacer tout ton historique d\'écoute ?')) return
  await axios.delete('/api/me/history')
  tracks.value = []
  toast.success('Historique effacé')
}

onMounted(load)
</script>

<style scoped>
.history-page { padding: 24px 20px; max-width: 860px; margin: 0 auto; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.page-type { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-3); }
h1 { font-size: 26px; font-weight: 800; margin: 2px 0; }

.link-btn {
  background: none; border: none; color: var(--accent); cursor: pointer;
  font-size: 12px; font-weight: 600; font-family: inherit; padding: 6px 0; flex-shrink: 0;
}
.link-btn:hover { opacity: .8; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  color: var(--text-3); padding: 48px 0; font-size: 13px; text-align: center;
}
</style>
