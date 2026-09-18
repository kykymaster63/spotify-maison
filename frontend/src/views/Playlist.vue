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
            <button v-if="playlist.is_owner" class="btn btn-ghost invite-btn" @click="showInvite = true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
                <path d="M2.5 18.5c0-2.8 2.8-4.5 6.5-4.5s6.5 1.7 6.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M18 8v4M16 10h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
              Inviter
            </button>
          </div>
          <div v-if="playlist.collaborators?.length" class="collab-row">
            <span class="collab-label">Partagée avec</span>
            <div v-for="c in playlist.collaborators" :key="c.id" class="collab-chip">
              {{ c.username }}
              <button @click="removeCollaborator(c)" title="Retirer">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tracks -->
      <TrackList :tracks="playlist.tracks || []" />
    </div>

    <div v-else class="loading">
      <div class="spin"></div>
    </div>

    <!-- Inviter -->
    <Transition name="modal">
      <div v-if="showInvite" class="overlay" @click.self="showInvite = false">
        <div class="modal glass-card">
          <div class="modal-head">
            <h3>Inviter sur "{{ playlist.name }}"</h3>
            <button class="close-btn" @click="showInvite = false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="search-bar">
            <input v-model="inviteQuery" @input="onInviteInput" placeholder="Chercher un pseudo..." />
          </div>
          <ul v-if="inviteResults.length" class="invite-list">
            <li v-for="u in inviteResults" :key="u.id" class="invite-row">
              <span class="username">{{ u.username }}</span>
              <button class="btn btn-primary sm" @click="invite(u)">Inviter</button>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import TrackList from '../components/TrackList.vue'
import { usePlayerStore } from '../stores/player.js'
import { useToastStore } from '../stores/toast.js'

const route = useRoute()
const player = usePlayerStore()
const toast = useToastStore()
const playlist = ref(null)
const readyTracks = computed(() => playlist.value?.tracks?.filter(t => t.status === 'ready') || [])

const showInvite = ref(false)
const inviteQuery = ref('')
const inviteResults = ref([])
let debounceTimer

function playAll() {
  if (!readyTracks.value.length) return
  player.play(readyTracks.value[0], readyTracks.value)
}

async function load() {
  const { data } = await axios.get(`/api/playlists/${route.params.id}`)
  playlist.value = data
}

function onInviteInput() {
  clearTimeout(debounceTimer)
  if (!inviteQuery.value.trim()) { inviteResults.value = []; return }
  debounceTimer = setTimeout(async () => {
    const { data } = await axios.get('/api/users/search', { params: { q: inviteQuery.value.trim() } })
    inviteResults.value = data.filter(u => !playlist.value.collaborators?.some(c => c.id === u.id))
  }, 300)
}

async function invite(u) {
  try {
    await axios.post(`/api/playlists/${route.params.id}/collaborators`, { user_id: u.id, role: 'editor' })
    toast.success(`${u.username} peut maintenant modifier cette playlist`)
    inviteQuery.value = ''
    inviteResults.value = []
    await load()
  } catch (e) {
    toast.error(e.response?.data?.error || "Impossible d'inviter cette personne")
  }
}

async function removeCollaborator(c) {
  try {
    await axios.delete(`/api/playlists/${route.params.id}/collaborators/${c.id}`)
    await load()
  } catch {
    toast.error('Une erreur est survenue')
  }
}

onMounted(load)
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
.pl-actions { margin-top: 12px; display: flex; gap: 10px; }
.play-all { gap: 8px; }
.invite-btn { gap: 6px; }

.collab-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.collab-label { font-size: 12px; color: var(--text-3); }
.collab-chip {
  display: flex; align-items: center; gap: 6px;
  background: var(--glass); border: 1px solid var(--border); border-radius: 50px;
  padding: 4px 6px 4px 12px; font-size: 12px; color: var(--text-2);
}
.collab-chip button {
  display: flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 50%;
  background: none; border: none; color: var(--text-3); cursor: pointer;
}
.collab-chip button:hover { color: #f87171; background: rgba(248,113,113,0.15); }

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
  .pl-actions { justify-content: center; }
  .collab-row { justify-content: center; }
}

/* Modal inviter */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 20px; backdrop-filter: blur(6px);
}
.modal { width: 100%; max-width: 380px; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.modal-head { display: flex; align-items: center; justify-content: space-between; }
.modal-head h3 { font-size: 16px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.close-btn {
  background: none; border: none; color: var(--text-2); cursor: pointer;
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s;
}
.close-btn:hover { background: var(--glass-hover); }
.search-bar input { font-size: 15px; }

.invite-list { display: flex; flex-direction: column; gap: 4px; }
.invite-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 4px; }
.invite-row .username { font-size: 14px; font-weight: 500; }
.btn.sm { padding: 7px 14px; font-size: 12px; flex-shrink: 0; }

.modal-enter-active, .modal-leave-active { transition: opacity .2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
