<template>
  <div class="track-list">
    <div v-for="(track, i) in tracks" :key="track.id"
      class="track-row"
      :class="{ active: player.currentTrack?.id === track.id, disabled: track.status !== 'ready' }"
      :style="{ animationDelay: Math.min(i * 25, 300) + 'ms' }"
      @click="playTrack(track)"
    >
      <!-- Numéro / lecture en cours -->
      <div class="track-num">
        <span v-if="player.currentTrack?.id !== track.id" class="num-text">{{ i + 1 }}</span>
        <div v-else class="bars">
          <span :class="{ playing: player.isPlaying }"></span>
          <span :class="{ playing: player.isPlaying }"></span>
          <span :class="{ playing: player.isPlaying }"></span>
        </div>
      </div>

      <!-- Cover -->
      <div class="track-cover">
        <img v-if="track.cover_url" :src="track.cover_url" alt="" />
        <div v-else class="cover-placeholder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18V6l12-2v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </div>
      </div>

      <!-- Méta -->
      <div class="track-meta">
        <span class="track-name">{{ track.title }}</span>
        <span class="track-sub">
          {{ track.artist || 'Artiste inconnu' }}
          <template v-if="addedInfo(track)"> · <span class="added-by">{{ addedInfo(track) }}</span></template>
        </span>
      </div>

      <!-- Badge statut si pas ready -->
      <div v-if="track.status !== 'ready'" class="status-badge" :class="track.status">
        {{ track.status === 'pending' ? 'En attente' : track.status === 'downloading' ? '⬇ Téléchargement' : 'Erreur' }}
      </div>

      <!-- Favori -->
      <button v-else class="fav-btn" :class="{ active: favorites.isFavorite(track.id), pop: poppingId === track.id }" @click.stop="toggleFav(track)" title="Favori">
        <svg width="15" height="15" viewBox="-1 -1 26 26" :fill="favorites.isFavorite(track.id) ? 'currentColor' : 'none'">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- Durée -->
      <div class="track-duration">{{ fmt(track.duration_seconds) }}</div>

      <!-- Menu pour un morceau en erreur : juste réessayer / supprimer -->
      <div v-if="track.status === 'error'" class="row-menu">
        <button class="menu-btn" @click.stop="toggleMenu(track)" title="Plus d'options">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>
          </svg>
        </button>
        <div v-if="openMenuId === track.id" class="menu-popover" @click.stop>
          <button class="menu-item" @click="retryTrack(track)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Réessayer
          </button>
          <button v-if="track.uploaded_by === auth.user?.id" class="menu-item danger" @click="removeTrack(track)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0-.8 12.1a2 2 0 01-2 1.9H8.8a2 2 0 01-2-1.9L6 7h12z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Supprimer
          </button>
        </div>
      </div>

      <!-- Menu (hors-ligne / ajouter à une playlist / supprimer) -->
      <div v-else-if="track.status === 'ready'" class="row-menu">
        <button class="menu-btn" @click.stop="toggleMenu(track)" title="Plus d'options">
          <svg v-if="player.isOfflineAvailable(track.id)" width="15" height="15" viewBox="0 0 24 24" fill="none" class="offline-dot">
            <circle cx="12" cy="12" r="10" fill="currentColor"/>
            <path d="M8.5 12.5l2.5 2.5 5-5" stroke="var(--bg)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>
          </svg>
        </button>
        <div v-if="openMenuId === track.id" class="menu-popover" @click.stop>
          <button class="menu-item" @click="openAddModal(track)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M15 6H3M15 12H3M9 18H3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M19 8v8M15 12h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
            Ajouter à une playlist
          </button>
          <button v-if="jam.isActive" class="menu-item" @click="addToJam(track)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M4 18V9m4 9V5m4 13v-6m4 6V3m4 15v-9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
            Ajouter au Jam
          </button>
          <button
            v-if="!player.isOfflineAvailable(track.id)" class="menu-item"
            :disabled="player.isDownloading(track.id)" @click="downloadOffline(track)"
          >
            <span v-if="player.isDownloading(track.id)" class="spinner-xs"></span>
            <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ player.isDownloading(track.id) ? 'Téléchargement...' : 'Écouter hors-ligne' }}
          </button>
          <button v-else class="menu-item" @click="removeOfflineTrack(track)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            Retirer le hors-ligne
          </button>
          <button v-if="track.uploaded_by === auth.user?.id" class="menu-item danger" @click="removeTrack(track)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0-.8 12.1a2 2 0 01-2 1.9H8.8a2 2 0 01-2-1.9L6 7h12z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Supprimer
          </button>
        </div>
      </div>
      <div v-else class="row-menu-spacer"></div>
    </div>

    <AddToPlaylistModal :track="modalTrack" @close="modalTrack = null" />

    <div v-if="!tracks.length" class="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" opacity=".3">
        <path d="M9 18V6l12-2v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <span>Aucun morceau</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { usePlayerStore } from '../stores/player.js'
import { useAuthStore } from '../stores/auth.js'
import { useToastStore } from '../stores/toast.js'
import { useFavoritesStore } from '../stores/favorites.js'
import { useJamStore } from '../stores/jam.js'
import AddToPlaylistModal from './AddToPlaylistModal.vue'
const props = defineProps({ tracks: { type: Array, default: () => [] } })
const player = usePlayerStore()
const auth = useAuthStore()
const toast = useToastStore()
const favorites = useFavoritesStore()
const jam = useJamStore()
const modalTrack = ref(null)
const openMenuId = ref(null)
const poppingId = ref(null)

function toggleMenu(track) {
  openMenuId.value = openMenuId.value === track.id ? null : track.id
}
function closeMenu() { openMenuId.value = null }
onMounted(() => document.addEventListener('click', closeMenu))
onUnmounted(() => document.removeEventListener('click', closeMenu))

function openAddModal(track) {
  modalTrack.value = track
  openMenuId.value = null
}

function addToJam(track) {
  jam.addTrack(track)
  openMenuId.value = null
  toast.success(`"${track.title}" ajouté à la file du Jam`)
}

function playTrack(track) {
  if (track.status !== 'ready') return
  if (jam.isFollower) jam.leave() // choisir un autre morceau me sort du Jam que je suivais
  player.play(track, props.tracks.filter(t => t.status === 'ready'))
}
function fmt(s) {
  if (!s) return '--:--'
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}
function addedInfo(track) {
  if (track.added_by_username) return `ajouté par ${track.added_by_username}`
  if (track.uploader) return `importé par ${track.uploader}`
  return null
}
function toggleFav(track) {
  const wasFav = favorites.isFavorite(track.id)
  favorites.toggle(track)
  if (!wasFav) {
    // "Pop" seulement quand on like, pas quand on retire.
    poppingId.value = track.id
    setTimeout(() => { if (poppingId.value === track.id) poppingId.value = null }, 420)
  }
}

async function retryTrack(track) {
  openMenuId.value = null
  try {
    await axios.post(`/api/tracks/${track.id}/retry`)
    track.status = 'pending'
    toast.success(`Nouvelle tentative pour "${track.title}"`)
  } catch (e) {
    toast.error(e.response?.data?.error || 'Impossible de relancer ce morceau')
  }
}

async function downloadOffline(track) {
  openMenuId.value = null
  try {
    await player.downloadForOffline(track)
    toast.success(`"${track.title}" disponible hors-ligne`)
  } catch {
    toast.error('Téléchargement hors-ligne impossible')
  }
}

async function removeOfflineTrack(track) {
  openMenuId.value = null
  await player.removeOffline(track.id)
  toast.success(`"${track.title}" retiré du hors-ligne`)
}

async function removeTrack(track) {
  openMenuId.value = null
  if (!confirm(`Supprimer "${track.title}" définitivement ?`)) return
  try {
    await axios.delete(`/api/tracks/${track.id}`)
    const i = props.tracks.findIndex(t => t.id === track.id)
    if (i !== -1) props.tracks.splice(i, 1)
    if (player.currentTrack?.id === track.id) player.pause()
    toast.success(`"${track.title}" supprimé`)
  } catch (e) {
    toast.error(e.response?.data?.error || 'Suppression impossible')
  }
}
</script>

<style scoped>
.track-list { display: flex; flex-direction: column; }
.track-row {
  display: grid;
  /* Colonne durée en largeur fixe (pas "auto") : chaque ligne est sa
     propre grille indépendante, donc une durée à 2 chiffres de minutes
     (10min+) élargit la colonne "auto" et décale les colonnes suivantes
     (coeur, menu) par rapport aux lignes plus courtes. */
  grid-template-columns: 32px 40px 1fr auto 44px auto;
  align-items: center; gap: 12px;
  padding: 8px 10px; border-radius: var(--r-sm);
  cursor: pointer; transition: background .15s;
  animation: row-in .32s ease backwards;
}
.track-row:hover { background: var(--glass-hover); }
.track-row.active .track-name { color: var(--accent); }
.track-row.disabled { opacity: .5; cursor: default; }

/* Numéro */
.track-num { display: flex; align-items: center; justify-content: center; }
.num-text { font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums; }

/* Barres d'égaliseur animées */
.bars { display: flex; align-items: flex-end; gap: 2px; height: 14px; }
.bars span {
  display: block; width: 3px; background: var(--accent); border-radius: 1px;
  height: 6px; transition: height .3s;
}
.bars span.playing:nth-child(1) { animation: eq1 .8s ease-in-out infinite alternate; }
.bars span.playing:nth-child(2) { animation: eq2 .6s ease-in-out infinite alternate; }
.bars span.playing:nth-child(3) { animation: eq3 .9s ease-in-out infinite alternate; }
@keyframes eq1 { from { height: 4px; } to { height: 14px; } }
@keyframes eq2 { from { height: 8px; } to { height: 5px; } }
@keyframes eq3 { from { height: 12px; } to { height: 4px; } }

/* Cover */
.track-cover {
  width: 40px; height: 40px; border-radius: 6px;
  background: var(--bg-3); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.track-cover img { width: 100%; height: 100%; object-fit: cover; }
.cover-placeholder { color: var(--text-3); }

/* Méta */
.track-meta { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
.track-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track-sub { font-size: 11px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.added-by { color: var(--text-3); }

/* Durée */
.track-duration { font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums; text-align: right; }

/* Menu "..." (ajouter à une playlist / supprimer) */
.row-menu { position: relative; }
.row-menu-spacer { width: 28px; }
.menu-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  background: none; border: none; cursor: pointer;
  color: var(--text-3); flex-shrink: 0; transition: color .15s, background .15s;
}
.menu-btn:hover { color: var(--text); background: var(--glass-hover); }
.offline-dot { color: var(--accent-2); }
.menu-item[disabled] { opacity: .6; cursor: default; }
.spinner-xs {
  width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.25);
  border-top-color: var(--text); border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
.menu-popover {
  position: absolute; top: calc(100% + 4px); right: 0; z-index: 20;
  min-width: 190px; padding: 6px;
  background: var(--bg-3); border: 1px solid var(--border-2); border-radius: var(--r-sm);
  box-shadow: 0 12px 32px rgba(0,0,0,0.5);
  display: flex; flex-direction: column; gap: 2px;
}
.menu-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 6px;
  background: none; border: none; cursor: pointer; text-align: left;
  color: var(--text); font-size: 13px; font-family: inherit; white-space: nowrap;
  transition: background .15s;
}
.menu-item:hover { background: var(--glass-hover); }
.menu-item.danger { color: #f87171; }

/* Badge */
.status-badge {
  font-size: 10px; padding: 3px 8px; border-radius: 4px; white-space: nowrap;
  background: rgba(255,255,255,0.06); color: var(--text-2);
}
.status-badge.downloading { color: #fbbf24; }
.status-badge.error { color: #f87171; }

/* Empty */
.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  color: var(--text-3); padding: 48px 0; font-size: 13px;
}
</style>
