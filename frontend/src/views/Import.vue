<template>
  <div class="import-page">
    <header class="page-header">
      <h1>Importer de la musique</h1>
      <p class="page-sub">Cherche un titre ou colle un lien, écoute un aperçu, puis ajoute-le à ta bibliothèque.</p>
    </header>

    <!-- Sélecteur de plateforme -->
    <div class="source-row">
      <button class="source-pill" :class="{ active: source === 'youtube' }" @click="setSource('youtube')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" stroke="currentColor" stroke-width="1.6"/>
          <path d="M10.5 9.2v5.6l5-2.8z" fill="currentColor" stroke="none"/>
        </svg>
        YouTube
      </button>
      <button class="source-pill" :class="{ active: source === 'soundcloud' }" @click="setSource('soundcloud')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M6 19h11.5a3.5 3.5 0 000-7 5 5 0 00-9.6-1.8A3 3 0 006 16" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <g stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
            <path d="M9 15.5v-2.3"/><path d="M11 15.5v-3.6"/><path d="M13 15.5v-4.4"/>
          </g>
        </svg>
        SoundCloud
      </button>
    </div>

    <div class="search-bar glass-card">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="search-icon">
        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6"/>
        <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <input
        v-model="query" @input="onInput" @keydown.enter="runSearch"
        :placeholder="`Titre, artiste... ou une URL ${sourceLabel}`" class="search-input" autofocus
      />
      <span v-if="loading" class="spinner-sm"></span>
      <button v-else-if="query" @click="clear" class="clear-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <p v-if="errorMsg" class="error-hint">{{ errorMsg }}</p>

    <!-- Résultat unique (lien direct) -->
    <div v-if="singlePreview" class="results single">
      <MediaCard :item="singlePreview" :playing="isPlaying(singlePreview.url)" :adding="isAdding(singlePreview.url)" :added="isAdded(singlePreview.url)"
        @preview="togglePreview(singlePreview)" @add="addTrack(singlePreview)" large />
    </div>

    <!-- Résultats de recherche -->
    <div v-else-if="results.length" class="results grid">
      <MediaCard v-for="r in results" :key="r.id || r.url" :item="r"
        :playing="isPlaying(r.url)" :adding="isAdding(r.url)" :added="isAdded(r.url)"
        @preview="togglePreview(r)" @add="addTrack(r)" />
    </div>

    <div v-else-if="!loading && searched" class="empty-search">
      <p>Aucun résultat pour "{{ query }}"</p>
    </div>

    <div v-else-if="!query" class="empty-search">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" opacity=".2">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <p>Tape un titre d'artiste ou colle une URL {{ sourceLabel }}</p>
    </div>

    <!-- Imports en cours -->
    <section v-if="pending.length" class="section pending-section">
      <p class="section-title">Imports en cours</p>
      <div v-for="t in pending" :key="t.id" class="pending-row glass-card">
        <img v-if="t.cover_url" :src="t.cover_url" class="pending-cover" alt="" />
        <div class="pending-meta">
          <span class="pending-title">{{ t.title }}</span>
          <span class="pending-status" :class="t.status">
            {{ t.status === 'downloading' ? '⬇ Téléchargement...' : t.status === 'error' ? '❌ Erreur' : '⏳ En attente...' }}
          </span>
        </div>
      </div>
    </section>

    <audio ref="previewAudio" @ended="stopPreview" @error="onAudioError" hidden></audio>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import axios from 'axios'
import { useToastStore } from '../stores/toast.js'
import MediaCard from '../components/MediaCard.vue'

const toast = useToastStore()

const source = ref('youtube')
const sourceLabel = computed(() => source.value === 'soundcloud' ? 'SoundCloud' : 'YouTube')

const query = ref('')
const results = ref([])
const singlePreview = ref(null)
const loading = ref(false)
const searched = ref(false)
const errorMsg = ref('')
let debounceTimer

const previewAudio = ref(null)
const currentPreviewUrl = ref(null)

const adding = reactive(new Set())
const added = reactive(new Set())

const pending = ref([])
let pollTimer

function isUrl(s) { return /^https?:\/\//i.test(s.trim()) }
function isPlaying(url) { return currentPreviewUrl.value === url }
function isAdding(url) { return adding.has(url) }
function isAdded(url) { return added.has(url) }

function setSource(s) {
  if (source.value === s) return
  source.value = s
  if (query.value.trim() && !isUrl(query.value)) runSearch()
}

function onInput() {
  clearTimeout(debounceTimer)
  errorMsg.value = ''
  if (!query.value.trim()) { clear(); return }
  debounceTimer = setTimeout(runSearch, isUrl(query.value) ? 450 : 320)
}

function clear() {
  query.value = ''; results.value = []; singlePreview.value = null
  searched.value = false; errorMsg.value = ''
  stopPreview()
}

async function runSearch() {
  const q = query.value.trim()
  if (!q) return
  clearTimeout(debounceTimer)
  loading.value = true
  errorMsg.value = ''
  try {
    if (isUrl(q)) {
      const { data } = await axios.get('/api/import/preview', { params: { url: q } })
      singlePreview.value = { ...data, source: /soundcloud\.com/i.test(q) ? 'soundcloud' : 'youtube' }
      results.value = []
    } else {
      const { data } = await axios.get('/api/import/search', { params: { q, source: source.value } })
      results.value = data
      singlePreview.value = null
    }
  } catch (e) {
    errorMsg.value = e.response?.data?.error || 'Recherche impossible'
    results.value = []; singlePreview.value = null
  } finally {
    loading.value = false
    searched.value = true
  }
}

function togglePreview(item) {
  const audio = previewAudio.value
  if (!audio) return
  if (currentPreviewUrl.value === item.url) {
    stopPreview()
    return
  }
  const token = localStorage.getItem('token')
  audio.pause()
  audio.src = `/api/import/preview-audio?url=${encodeURIComponent(item.url)}&token=${encodeURIComponent(token || '')}`
  currentPreviewUrl.value = item.url
  audio.play().catch(() => {
    toast.error('Aperçu impossible pour ce morceau')
    if (currentPreviewUrl.value === item.url) currentPreviewUrl.value = null
  })
}
function stopPreview() {
  previewAudio.value?.pause()
  currentPreviewUrl.value = null
}
function onAudioError() {
  if (!currentPreviewUrl.value) return
  toast.error('Aperçu impossible pour ce morceau')
  currentPreviewUrl.value = null
}

async function addTrack(item) {
  if (adding.has(item.url) || added.has(item.url)) return
  adding.add(item.url)
  try {
    const { data } = await axios.post('/api/tracks/import', { url: item.url })
    added.add(item.url)
    toast.success(`"${data.title}" ajouté — téléchargement en cours...`)
    await refreshPending()
  } catch (e) {
    toast.error(e.response?.data?.error || "Impossible d'ajouter ce morceau")
  } finally {
    adding.delete(item.url)
  }
}

async function refreshPending() {
  try {
    const { data } = await axios.get('/api/tracks/pending')
    const prevStatus = new Map(pending.value.map(t => [t.id, t.status]))
    for (const t of data) {
      if (prevStatus.get(t.id) && prevStatus.get(t.id) !== 'error' && t.status === 'error') {
        toast.error(`Erreur lors du téléchargement de "${t.title}"`)
      }
    }
    // Ce qui a disparu de "pending" (donc devenu ready) déclenche un toast succès
    for (const t of pending.value) {
      if (!data.find(d => d.id === t.id) && t.status !== 'error') {
        toast.success(`🎵 "${t.title}" est prêt !`)
      }
    }
    pending.value = data
  } catch { /* silencieux */ }
}

onMounted(() => {
  refreshPending()
  pollTimer = setInterval(refreshPending, 3500)
})
onUnmounted(() => {
  clearInterval(pollTimer)
  stopPreview()
})
</script>

<style scoped>
.import-page { padding: 24px 20px 8px; max-width: 900px; margin: 0 auto; }
.page-header { margin-bottom: 20px; }
h1 { font-size: 24px; font-weight: 800; }
.page-sub { font-size: 13px; color: var(--text-2); margin-top: 4px; }

/* Sélecteur de plateforme */
.source-row { display: flex; gap: 8px; margin-bottom: 18px; }
.source-pill {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 50px;
  background: var(--glass); border: 1px solid var(--border);
  color: var(--text-2); font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all .15s; font-family: inherit;
}
.source-pill:hover { color: var(--text); border-color: var(--border-2); }
.source-pill.active { background: var(--gradient); color: #fff; border-color: transparent; }
.source-pill.active:hover { color: #fff; }

.search-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px; margin-bottom: 24px;
}
.search-icon { color: var(--text-3); flex-shrink: 0; }
.search-input { border: none; background: none; padding: 0; flex: 1; font-size: 16px; outline: none; box-shadow: none; }
.search-input:focus { border: none; box-shadow: none; }
.clear-btn {
  background: none; border: none; color: var(--text-3); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 50%; transition: color .15s;
}
.clear-btn:hover { color: var(--text); }
.spinner-sm {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.15);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin .7s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.error-hint { color: #f87171; font-size: 13px; margin-bottom: 16px; }

.results.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; margin-bottom: 8px; }
.results.single { max-width: 480px; margin-bottom: 8px; }

.empty-search {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 60px 0; color: var(--text-3); font-size: 14px; text-align: center;
}

.pending-section { margin-top: 32px; margin-bottom: 24px; }
.pending-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; margin-bottom: 8px;
}
.pending-cover { width: 36px; height: 36px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
.pending-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pending-title { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pending-status { font-size: 11px; color: var(--text-3); }
.pending-status.downloading { color: #fbbf24; }
.pending-status.error { color: #f87171; }
</style>
