<template>
  <Transition name="modal">
    <div v-if="track" class="overlay" @click.self="$emit('close')">
      <div class="modal glass-card">
        <div class="modal-head">
          <h3>Ajouter à une playlist</h3>
          <button class="close-btn" @click="$emit('close')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <p class="track-name">{{ track.title }}</p>

        <!-- Créer une nouvelle playlist -->
        <form class="new-row" @submit.prevent="createAndAdd">
          <input v-model="newName" placeholder="Nouvelle playlist..." />
          <button class="btn btn-primary" type="submit" :disabled="!newName.trim() || creating">
            <span v-if="creating" class="spinner-xs"></span>
            <span v-else>Créer</span>
          </button>
        </form>

        <div v-if="loading" class="loading-hint">Chargement...</div>
        <div v-else-if="!playlists.length" class="empty-hint">Aucune playlist pour l'instant.</div>
        <ul v-else class="playlist-list">
          <li v-for="p in playlists" :key="p.id" class="playlist-row" @click="addTo(p)">
            <span class="pl-name">{{ p.name }}</span>
            <span v-if="state[p.id] === 'added'" class="pl-status ok">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
              Ajouté
            </span>
            <span v-else-if="state[p.id] === 'exists'" class="pl-status">Déjà présent</span>
            <span v-else-if="state[p.id] === 'loading'" class="spinner-xs"></span>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" class="pl-add">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </li>
        </ul>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import axios from 'axios'
import { useToastStore } from '../stores/toast.js'

const props = defineProps({ track: { type: Object, default: null } })
const emit = defineEmits(['close'])
const toast = useToastStore()

const playlists = ref([])
const loading = ref(false)
const newName = ref('')
const creating = ref(false)
const state = reactive({})

async function load() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/playlists')
    playlists.value = data.owned || []
  } finally {
    loading.value = false
  }
}

async function addTo(playlist) {
  if (state[playlist.id]) return
  state[playlist.id] = 'loading'
  try {
    await axios.post(`/api/playlists/${playlist.id}/tracks`, { track_id: props.track.id })
    state[playlist.id] = 'added'
    toast.success(`Ajouté à "${playlist.name}"`)
  } catch (e) {
    if (e.response?.status === 409) {
      state[playlist.id] = 'exists'
    } else {
      delete state[playlist.id]
      toast.error("Impossible d'ajouter ce morceau")
    }
  }
}

async function createAndAdd() {
  const name = newName.value.trim()
  if (!name) return
  creating.value = true
  try {
    const { data: playlist } = await axios.post('/api/playlists', { name })
    playlists.value.unshift(playlist)
    newName.value = ''
    await addTo(playlist)
  } catch {
    toast.error('Impossible de créer la playlist')
  } finally {
    creating.value = false
  }
}

watch(() => props.track, (t) => {
  if (t) { load(); Object.keys(state).forEach(k => delete state[k]) }
})
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 20px; backdrop-filter: blur(6px);
}
.modal { width: 100%; max-width: 380px; padding: 24px; display: flex; flex-direction: column; gap: 16px; max-height: 80vh; }
.modal-head { display: flex; align-items: center; justify-content: space-between; }
.modal-head h3 { font-size: 17px; font-weight: 700; }
.close-btn {
  background: none; border: none; color: var(--text-2); cursor: pointer;
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s; flex-shrink: 0;
}
.close-btn:hover { background: var(--glass-hover); }

.track-name { font-size: 13px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: -8px; }

.new-row { display: flex; gap: 8px; }
.new-row .btn { flex-shrink: 0; padding: 0 16px; font-size: 12px; }

.loading-hint, .empty-hint { color: var(--text-3); font-size: 13px; text-align: center; padding: 16px 0; }

.playlist-list { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; margin: 0 -8px; }
.playlist-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 8px; border-radius: var(--r-sm); cursor: pointer; transition: background .15s;
}
.playlist-row:hover { background: var(--glass-hover); }
.pl-name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pl-add { color: var(--text-3); flex-shrink: 0; }
.pl-status { font-size: 12px; color: var(--text-3); display: flex; align-items: center; gap: 4px; flex-shrink: 0; white-space: nowrap; }
.pl-status.ok { color: var(--accent-2); }

.spinner-xs {
  width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.25);
  border-top-color: var(--text); border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.modal-enter-active, .modal-leave-active { transition: opacity .2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
