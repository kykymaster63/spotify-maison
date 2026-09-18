<template>
  <div class="library-page">
    <header class="page-header">
      <h1>Bibliothèque</h1>
      <button class="btn btn-primary create-btn" @click="showCreate = true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Playlist
      </button>
    </header>

    <!-- Modal -->
    <Transition name="modal">
      <div v-if="showCreate" class="overlay" @click.self="showCreate = false">
        <div class="modal glass-card">
          <div class="modal-head">
            <h3>Nouvelle playlist</h3>
            <button class="close-btn" @click="showCreate = false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="field"><label>Nom</label><input v-model="np.name" placeholder="Ma playlist" /></div>
            <div class="field"><label>Description</label><textarea v-model="np.description" placeholder="Optionnel" rows="2"></textarea></div>
            <label class="toggle-label">
              <span>Publique</span>
              <div class="toggle" :class="{ on: np.is_public }" @click="np.is_public = !np.is_public">
                <div class="toggle-thumb"></div>
              </div>
            </label>
          </div>
          <button class="btn btn-primary" style="width:100%" @click="create" :disabled="!np.name.trim()">Créer</button>
        </div>
      </div>
    </Transition>

    <!-- Mes playlists -->
    <section class="section">
      <p class="section-title">Mes playlists</p>
      <div v-if="playlists.owned?.length" class="playlist-grid">
        <router-link v-for="p in playlists.owned" :key="p.id" :to="`/playlist/${p.id}`" class="playlist-card glass-card">
          <div class="pl-cover">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M9 18V6l12-2v12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              <circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.4"/>
              <circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.4"/>
            </svg>
          </div>
          <span class="pl-name">{{ p.name }}</span>
          <span class="pl-tag">{{ p.is_public ? 'Publique' : 'Privée' }}</span>
        </router-link>
      </div>
      <div v-else class="empty-hint">Aucune playlist pour l'instant.</div>
    </section>

    <!-- Partagées -->
    <section v-if="playlists.shared?.length" class="section">
      <p class="section-title">Partagées avec moi</p>
      <div class="playlist-grid">
        <router-link v-for="p in playlists.shared" :key="p.id" :to="`/playlist/${p.id}`" class="playlist-card glass-card">
          <div class="pl-cover shared">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </div>
          <span class="pl-name">{{ p.name }}</span>
          <span class="pl-tag">Partagée</span>
        </router-link>
      </div>
    </section>

    <!-- Tous les morceaux -->
    <section class="section">
      <div class="section-head">
        <p class="section-title" style="margin:0">Tous les morceaux</p>
        <span class="count">{{ tracks.length }}</span>
      </div>
      <TrackList :tracks="tracks" />
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import TrackList from '../components/TrackList.vue'

const playlists = ref({ owned: [], shared: [] })
const tracks = ref([])
const showCreate = ref(false)
const np = ref({ name: '', description: '', is_public: false })

async function load() {
  const { data } = await axios.get('/api/playlists')
  playlists.value = data
}
async function loadTracks() {
  const { data } = await axios.get('/api/tracks')
  tracks.value = data
}
async function create() {
  await axios.post('/api/playlists', np.value)
  showCreate.value = false
  np.value = { name: '', description: '', is_public: false }
  load()
}
onMounted(() => { load(); loadTracks() })
</script>

<style scoped>
.library-page { padding: 24px 20px; max-width: 860px; margin: 0 auto; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
h1 { font-size: 24px; font-weight: 800; }
.create-btn { padding: 9px 16px; font-size: 13px; }
.section { margin-bottom: 36px; }
.section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.count { font-size: 11px; color: var(--text-3); background: var(--glass); border: 1px solid var(--border); border-radius: 4px; padding: 2px 6px; }

/* Grille playlists */
.playlist-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
.playlist-card {
  text-decoration: none; color: var(--text);
  display: flex; flex-direction: column; gap: 8px;
  padding: 14px; transition: background .15s, transform .15s;
}
.playlist-card:hover { background: var(--glass-hover); transform: translateY(-2px); }
.pl-cover {
  width: 100%; aspect-ratio: 1; border-radius: var(--r-sm);
  background: var(--gradient-soft);
  display: flex; align-items: center; justify-content: center;
  color: var(--accent); margin-bottom: 2px;
}
.pl-cover.shared { background: rgba(6,214,199,0.1); color: var(--accent-2); }
.pl-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pl-tag { font-size: 11px; color: var(--text-3); }

.empty-hint { color: var(--text-3); font-size: 13px; }

/* Modal */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 20px; backdrop-filter: blur(6px);
}
.modal { width: 100%; max-width: 360px; padding: 24px; display: flex; flex-direction: column; gap: 20px; }
.modal-head { display: flex; align-items: center; justify-content: space-between; }
.modal-head h3 { font-size: 17px; font-weight: 700; }
.close-btn {
  background: none; border: none; color: var(--text-2); cursor: pointer;
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s;
}
.close-btn:hover { background: var(--glass-hover); }
.modal-body { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; }
label { font-size: 12px; font-weight: 600; color: var(--text-2); }
textarea { resize: none; }

/* Toggle */
.toggle-label { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
.toggle-label > span { font-size: 13px; font-weight: 500; }
.toggle {
  width: 38px; height: 22px; border-radius: 11px;
  background: var(--bg-3); border: 1px solid var(--border);
  position: relative; transition: background .2s;
}
.toggle.on { background: var(--accent); border-color: var(--accent); }
.toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff; transition: transform .2s;
}
.toggle.on .toggle-thumb { transform: translateX(16px); }

/* Transitions */
.modal-enter-active, .modal-leave-active { transition: opacity .2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
