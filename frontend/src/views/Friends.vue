<template>
  <div class="friends-page">
    <header class="page-header">
      <h1>Amis</h1>
    </header>

    <div class="search-bar glass-card">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="search-icon">
        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6"/>
        <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <input v-model="query" @input="onInput" placeholder="Chercher un pseudo..." class="search-input" />
    </div>

    <section v-if="query && results.length" class="section">
      <div v-for="u in results" :key="u.id" class="user-row glass-card">
        <div class="avatar">{{ u.username[0]?.toUpperCase() }}</div>
        <span class="username">{{ u.username }}</span>
        <button v-if="u.relation === 'none'" class="btn btn-primary sm" @click="sendRequest(u)">Ajouter</button>
        <span v-else-if="u.relation === 'pending_sent'" class="hint">Demande envoyée</span>
        <span v-else-if="u.relation === 'pending_received'" class="hint">T'a envoyé une demande</span>
        <span v-else-if="u.relation === 'friends'" class="hint ok">Déjà ami</span>
      </div>
    </section>
    <p v-else-if="query && searched" class="empty-hint">Aucun utilisateur trouvé.</p>

    <section v-if="friends.incoming.length" class="section">
      <p class="section-title">Demandes reçues</p>
      <div v-for="u in friends.incoming" :key="u.id" class="user-row glass-card">
        <div class="avatar">{{ u.username[0]?.toUpperCase() }}</div>
        <span class="username">{{ u.username }}</span>
        <button class="icon-action ok" @click="accept(u)" title="Accepter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
        </button>
        <button class="icon-action" @click="removeRelation(u)" title="Refuser">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
    </section>

    <section class="section">
      <p class="section-title">Mes amis</p>
      <div v-if="!friends.accepted.length" class="empty-hint">Aucun ami pour l'instant — cherche un pseudo ci-dessus.</div>
      <div v-for="u in friends.accepted" :key="u.id" class="user-row glass-card">
        <div class="avatar">{{ u.username[0]?.toUpperCase() }}</div>
        <div class="friend-info">
          <span class="username">{{ u.username }}</span>
          <span v-if="listeningMap[u.id]" class="now-playing">
            🎵 {{ listeningMap[u.id].title }} <span v-if="listeningMap[u.id].artist">· {{ listeningMap[u.id].artist }}</span>
          </span>
          <span v-else class="hint">Rien en écoute</span>
        </div>
        <img v-if="listeningMap[u.id]?.cover_url" :src="listeningMap[u.id].cover_url" class="mini-cover" alt="" />
        <button class="icon-action" @click="removeRelation(u)" title="Retirer">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
    </section>

    <section v-if="friends.outgoing.length" class="section">
      <p class="section-title">Demandes envoyées</p>
      <div v-for="u in friends.outgoing" :key="u.id" class="user-row glass-card">
        <div class="avatar">{{ u.username[0]?.toUpperCase() }}</div>
        <span class="username">{{ u.username }}</span>
        <span class="hint">En attente</span>
        <button class="icon-action" @click="removeRelation(u)" title="Annuler">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()

const query = ref('')
const results = ref([])
const searched = ref(false)
let debounceTimer

const friends = reactive({ accepted: [], incoming: [], outgoing: [] })
const listeningMap = reactive({})
let pollTimer

function onInput() {
  clearTimeout(debounceTimer)
  if (!query.value.trim()) { results.value = []; searched.value = false; return }
  debounceTimer = setTimeout(search, 300)
}

async function search() {
  const { data } = await axios.get('/api/users/search', { params: { q: query.value.trim() } })
  results.value = data
  searched.value = true
}

async function loadFriends() {
  const { data } = await axios.get('/api/friends')
  friends.accepted = data.accepted
  friends.incoming = data.incoming
  friends.outgoing = data.outgoing
}

async function loadListening() {
  const { data } = await axios.get('/api/friends/listening')
  for (const key of Object.keys(listeningMap)) delete listeningMap[key]
  for (const row of data) {
    if (row.track_id) {
      listeningMap[row.user_id] = { title: row.title, artist: row.artist, cover_url: row.cover_url }
    }
  }
}

async function sendRequest(u) {
  try {
    await axios.post('/api/friends/request', { user_id: u.id })
    u.relation = 'pending_sent'
    toast.success(`Demande envoyée à ${u.username}`)
    loadFriends()
  } catch (e) {
    toast.error(e.response?.data?.error || 'Impossible d\'envoyer la demande')
  }
}

async function accept(u) {
  try {
    await axios.post(`/api/friends/${u.id}/accept`)
    toast.success(`${u.username} est maintenant ton ami`)
    loadFriends()
    loadListening()
  } catch {
    toast.error('Impossible d\'accepter cette demande')
  }
}

async function removeRelation(u) {
  try {
    await axios.delete(`/api/friends/${u.id}`)
    loadFriends()
  } catch {
    toast.error('Une erreur est survenue')
  }
}

onMounted(() => {
  loadFriends()
  loadListening()
  pollTimer = setInterval(loadListening, 10000)
})
onUnmounted(() => clearInterval(pollTimer))
</script>

<style scoped>
.friends-page { padding: 24px 20px; max-width: 640px; margin: 0 auto; }
.page-header { margin-bottom: 20px; }
h1 { font-size: 24px; font-weight: 800; }

.search-bar { display: flex; align-items: center; gap: 10px; padding: 14px 16px; margin-bottom: 24px; }
.search-icon { color: var(--text-3); flex-shrink: 0; }
.search-input { border: none; background: none; padding: 0; flex: 1; font-size: 16px; outline: none; box-shadow: none; }
.search-input:focus { border: none; box-shadow: none; }

.section { margin-bottom: 28px; }

.user-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; margin-bottom: 8px;
}
.avatar {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
  background: var(--logo-gradient); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700;
}
.username { font-size: 14px; font-weight: 600; }
.friend-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.now-playing { font-size: 12px; color: var(--accent-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hint { font-size: 12px; color: var(--text-3); margin-left: auto; }
.hint.ok { color: var(--accent-2); }
.mini-cover { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }

.btn.sm { padding: 7px 14px; font-size: 12px; margin-left: auto; }

.icon-action {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  background: none; border: none; cursor: pointer; color: var(--text-3);
  transition: color .15s, background .15s;
}
.icon-action:hover { color: var(--text); background: var(--glass-hover); }
.icon-action.ok:hover { color: var(--accent-2); }

.empty-hint { color: var(--text-3); font-size: 13px; }
</style>
