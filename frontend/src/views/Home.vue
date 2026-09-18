<template>
  <div class="home-page">
    <header class="page-header">
      <div class="greeting">
        <p class="greeting-sub">{{ greet() }},</p>
        <h1>{{ auth.user?.username }}</h1>
      </div>
    </header>

    <!-- Import -->
    <section class="section">
      <router-link to="/import" class="yt-promo glass-card">
        <div class="yt-promo-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="yt-promo-text">
          <span class="yt-promo-title">Importer de la musique</span>
          <span class="yt-promo-sub">Cherche, écoute un aperçu, puis ajoute à ta bibliothèque</span>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="yt-promo-arrow">
          <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </router-link>
    </section>

    <!-- Upload -->
    <section class="section">
      <p class="section-title">Uploader un fichier</p>
      <label class="upload-zone glass-card" :class="{ dragging }">
        <input type="file" accept="audio/*" @change="uploadFile" hidden multiple />
        <div class="upload-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 16V4m0 0L8 8m4-4l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 20h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="upload-label">Déposer des fichiers audio ici</span>
        <span class="upload-hint">MP3, FLAC, WAV — jusqu'à 200 Mo par fichier</span>
      </label>
    </section>

    <!-- Récemment écouté -->
    <section v-if="history.length" class="section">
      <div class="section-head">
        <p class="section-title" style="margin:0">Récemment écouté</p>
        <router-link to="/history" class="see-all">Tout voir</router-link>
      </div>
      <TrackList :tracks="history.slice(0, 5)" />
    </section>

    <!-- Ajoutés récemment -->
    <section class="section">
      <div class="section-head">
        <p class="section-title" style="margin:0">Ajoutés récemment</p>
        <router-link to="/library" class="see-all">Tout voir</router-link>
      </div>
      <TrackList :tracks="recentTracks" />
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth.js'
import { useToastStore } from '../stores/toast.js'
import TrackList from '../components/TrackList.vue'

const auth = useAuthStore()
const toast = useToastStore()
const tracks = ref([])
const recentTracks = computed(() => tracks.value.slice(0, 5))
const history = ref([])
const dragging = ref(false)
let pollTimer

function greet() {
  const h = new Date().getHours()
  if (h < 6) return 'Bonne nuit'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

async function load() {
  const { data } = await axios.get('/api/tracks')
  tracks.value = data
}

async function loadHistory() {
  const { data } = await axios.get('/api/me/history')
  history.value = data
}

async function uploadFile(e) {
  const files = [...e.target.files]
  for (const file of files) {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await axios.post('/api/tracks/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    tracks.value.unshift(data)
    toast.success(`"${data.title}" ajouté à ta bibliothèque`)
  }
}

// Réaffiche la liste régulièrement pour faire apparaître les imports YouTube
// terminés entre-temps (ajoutés depuis l'onglet YouTube)
onMounted(() => {
  load()
  loadHistory()
  pollTimer = setInterval(() => { load(); loadHistory() }, 6000)
})
onUnmounted(() => clearInterval(pollTimer))
</script>

<style scoped>
.home-page { padding: 24px 20px; max-width: 860px; margin: 0 auto; }

.page-header { margin-bottom: 32px; }
.greeting-sub { font-size: 13px; color: var(--text-2); margin-bottom: 4px; }
h1 { font-size: 28px; font-weight: 800; background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

.section { margin-bottom: 36px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.see-all { font-size: 12px; font-weight: 600; color: var(--accent); text-decoration: none; }
.see-all:hover { opacity: .8; }

/* Bandeau promo YouTube */
.yt-promo {
  display: flex; align-items: center; gap: 14px; padding: 16px 18px;
  text-decoration: none; color: var(--text); transition: background .15s, transform .15s;
}
.yt-promo:hover { background: var(--glass-hover); transform: translateY(-1px); }
.yt-promo-icon {
  width: 42px; height: 42px; border-radius: var(--r-sm); flex-shrink: 0;
  background: var(--gradient); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.yt-promo-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.yt-promo-title { font-size: 14px; font-weight: 600; }
.yt-promo-sub { font-size: 12px; color: var(--text-2); }
.yt-promo-arrow { color: var(--text-3); flex-shrink: 0; }

/* Upload */
.upload-zone {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 36px 20px; cursor: pointer; text-align: center;
  border: 1.5px dashed var(--border); transition: border-color .2s, background .2s;
}
.upload-zone:hover, .upload-zone.dragging {
  border-color: var(--accent); background: rgba(124,92,252,0.06);
}
.upload-icon { color: var(--accent); margin-bottom: 4px; }
.upload-label { font-size: 14px; font-weight: 500; }
.upload-hint { font-size: 12px; color: var(--text-3); }
</style>
