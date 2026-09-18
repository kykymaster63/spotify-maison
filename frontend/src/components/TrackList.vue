<template>
  <div class="track-list">
    <div v-for="(track, i) in tracks" :key="track.id"
      class="track-row"
      :class="{ active: player.currentTrack?.id === track.id, disabled: track.status !== 'ready' }"
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
      <button v-else class="fav-btn" :class="{ active: track.is_favorite }" @click.stop="toggleFav(track)" title="Favori">
        <svg width="15" height="15" viewBox="0 0 24 24" :fill="track.is_favorite ? 'currentColor' : 'none'">
          <path d="M12 20s-7.5-4.6-9.7-9.1C.7 7.8 2.3 4.5 5.6 4.1c1.9-.2 3.5.7 4.4 2.1.9-1.4 2.5-2.3 4.4-2.1 3.3.4 4.9 3.7 3.3 6.8C19.5 15.4 12 20 12 20z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- Ajouter à une playlist -->
      <button
        class="add-pl-btn" :class="{ invisible: track.status !== 'ready' }"
        @click.stop="openAddModal(track)" title="Ajouter à une playlist"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M15 6H3M15 12H3M15 18H3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M19 8v8M15 12h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- Durée -->
      <div class="track-duration">{{ fmt(track.duration_seconds) }}</div>

      <!-- Supprimer (uploadeur uniquement) -->
      <button
        class="delete-btn" :class="{ invisible: track.uploaded_by !== auth.user?.id }"
        @click.stop="removeTrack(track)" title="Supprimer"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0-.8 12.1a2 2 0 01-2 1.9H8.8a2 2 0 01-2-1.9L6 7h12z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
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
import { ref } from 'vue'
import axios from 'axios'
import { usePlayerStore } from '../stores/player.js'
import { useAuthStore } from '../stores/auth.js'
import { useToastStore } from '../stores/toast.js'
import AddToPlaylistModal from './AddToPlaylistModal.vue'
const props = defineProps({ tracks: { type: Array, default: () => [] } })
const player = usePlayerStore()
const auth = useAuthStore()
const toast = useToastStore()
const modalTrack = ref(null)

function openAddModal(track) {
  modalTrack.value = track
}

function playTrack(track) {
  if (track.status !== 'ready') return
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
async function toggleFav(track) {
  const next = !track.is_favorite
  track.is_favorite = next // optimiste
  try {
    if (next) await axios.post(`/api/tracks/${track.id}/favorite`)
    else await axios.delete(`/api/tracks/${track.id}/favorite`)
  } catch {
    track.is_favorite = !next
  }
}

async function removeTrack(track) {
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
  grid-template-columns: 32px 40px 1fr auto auto auto auto;
  align-items: center; gap: 12px;
  padding: 8px 10px; border-radius: var(--r-sm);
  cursor: pointer; transition: background .15s;
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
.track-duration { font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums; }

/* Ajouter à une playlist */
.add-pl-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  background: none; border: none; cursor: pointer;
  color: var(--text-3); flex-shrink: 0; transition: color .15s, background .15s;
}
.add-pl-btn:hover { color: var(--accent); background: var(--glass-hover); }
.add-pl-btn.invisible { visibility: hidden; pointer-events: none; }

/* Supprimer */
.delete-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  background: none; border: none; cursor: pointer;
  color: var(--text-3); flex-shrink: 0; transition: color .15s, background .15s;
}
.delete-btn:hover { color: #f87171; background: rgba(248,113,113,0.1); }
.delete-btn.invisible { visibility: hidden; pointer-events: none; }

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
