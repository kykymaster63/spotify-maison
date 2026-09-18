<template>
  <div class="tool-page">
    <header class="page-header">
      <h1>Import Spotify — aperçu</h1>
      <p class="page-sub">Colle un lien de playlist Spotify publique pour voir ce qui sera trouvé sur YouTube avant de vraiment l'importer.</p>
    </header>

    <div class="search-bar glass-card">
      <input
        v-model="url" placeholder="https://open.spotify.com/playlist/..."
        class="search-input" @keydown.enter="preview"
      />
      <button class="btn btn-primary sm" :disabled="!url.trim() || loading" @click="preview">
        <span v-if="loading" class="spinner-sm"></span>
        <span v-else>Aperçu</span>
      </button>
    </div>

    <p v-if="errorMsg" class="error-hint">{{ errorMsg }}</p>

    <div v-if="result" class="result">
      <div class="result-head">
        <div>
          <p class="page-type">Playlist Spotify</p>
          <h2>{{ result.playlistName }}</h2>
          <p class="page-sub">{{ result.foundCount }} / {{ result.total }} morceaux trouvables sur YouTube</p>
        </div>
        <button class="btn btn-primary" :disabled="confirming" @click="confirmImport">
          <span v-if="confirming" class="spinner-sm"></span>
          <span v-else>Confirmer l'import</span>
        </button>
      </div>

      <div class="track-rows">
        <div v-for="(t, i) in result.tracks" :key="i" class="track-row">
          <img v-if="t.matchThumbnail" :src="t.matchThumbnail" class="thumb" alt="" />
          <div v-else class="thumb thumb-empty"></div>
          <div class="meta">
            <span class="title">{{ t.title }}</span>
            <span class="sub">{{ t.artist }}</span>
          </div>
          <span class="status" :class="t.status">
            <template v-if="t.status === 'found'">✓ Trouvé</template>
            <template v-else-if="t.status === 'in_library'">✓ Déjà en bibliothèque</template>
            <template v-else>✗ Introuvable</template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useToastStore } from '../stores/toast.js'

const router = useRouter()
const toast = useToastStore()

const url = ref('')
const loading = ref(false)
const confirming = ref(false)
const errorMsg = ref('')
const result = ref(null)

async function preview() {
  if (!url.value.trim() || loading.value) return
  loading.value = true
  errorMsg.value = ''
  result.value = null
  try {
    const { data } = await axios.post('/api/import/spotify-playlist/preview', { url: url.value.trim() })
    result.value = data
  } catch (e) {
    errorMsg.value = e.response?.data?.error || 'Aperçu impossible'
  } finally {
    loading.value = false
  }
}

async function confirmImport() {
  if (confirming.value) return
  confirming.value = true
  try {
    const { data } = await axios.post('/api/import/spotify-playlist', { url: url.value.trim() })
    toast.success(`Playlist "${data.name}" créée — import en arrière-plan`)
    router.push(`/playlist/${data.id}`)
  } catch (e) {
    toast.error(e.response?.data?.error || "Impossible de lancer l'import")
  } finally {
    confirming.value = false
  }
}
</script>

<style scoped>
.tool-page { padding: 24px 20px; max-width: 720px; margin: 0 auto; }
.page-header { margin-bottom: 20px; }
h1 { font-size: 22px; font-weight: 800; }
.page-sub { font-size: 13px; color: var(--text-2); margin-top: 4px; }

.search-bar { display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 16px; margin-bottom: 16px; }
.search-input { border: none; background: none; padding: 0; flex: 1; font-size: 15px; outline: none; box-shadow: none; }
.search-input:focus { border: none; box-shadow: none; }
.btn.sm { padding: 9px 18px; font-size: 12px; flex-shrink: 0; }

.error-hint { color: #f87171; font-size: 13px; margin-bottom: 16px; }

.result { margin-top: 20px; }
.result-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 20px; }
.page-type { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-3); }
h2 { font-size: 20px; font-weight: 800; margin: 2px 0; }

.track-rows { display: flex; flex-direction: column; gap: 6px; }
.track-row {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 10px; border-radius: var(--r-sm);
}
.track-row:hover { background: var(--glass-hover); }
.thumb { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; background: var(--bg-3); }
.thumb-empty { }
.meta { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 2px; }
.title { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { font-size: 11px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.status { font-size: 12px; font-weight: 600; flex-shrink: 0; white-space: nowrap; }
.status.found { color: var(--accent-2); }
.status.in_library { color: var(--text-2); }
.status.not_found { color: #f87171; }

.spinner-sm {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3);
  border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
