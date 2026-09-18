<template>
  <div class="player" :class="{ 'has-track': !!player.currentTrack }">
    <!-- Barre de progression (tout en haut du player) -->
    <div
      class="prog-bar-wrap"
      @pointerdown="onSeekStart" @pointermove="onSeekMove" @pointerup="onSeekEnd" @pointercancel="onSeekEnd"
    >
      <div class="prog-bar-track">
        <div class="prog-bar-fill" :style="{ width: player.progressPercent + '%' }"></div>
        <div class="prog-bar-thumb" :style="{ left: player.progressPercent + '%' }"></div>
      </div>
    </div>

    <div class="player-inner">
      <!-- Infos morceau -->
      <div class="player-track">
        <button class="cover-wrap" @click="player.expand()" title="Voir en plein écran">
          <img v-if="player.currentTrack?.cover_url" :src="player.currentTrack.cover_url" alt="" class="cover-img" />
          <div v-else class="cover-empty">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M9 18V6l12-2v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </div>
        </button>
        <div class="track-meta" @click="player.expand()">
          <span class="track-title">{{ player.currentTrack?.title || 'Rien en lecture' }}</span>
          <span class="track-artist">{{ player.currentTrack?.artist || '' }}</span>
        </div>
      </div>

      <!-- Contrôles -->
      <div class="player-controls">
        <button class="ctrl" @click="guarded(player.prev)" title="Précédent">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
          </svg>
        </button>
        <button class="ctrl play" @click="guarded(player.togglePlay)">
          <svg v-if="!player.isPlaying" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6zm8-14v14h4V5z"/>
          </svg>
        </button>
        <button class="ctrl" @click="guarded(player.next)" title="Suivant">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z"/>
          </svg>
        </button>
      </div>

      <!-- Temps + volume -->
      <div class="player-right">
        <button
          v-if="player.currentTrack"
          class="fav-btn" :class="{ active: favorites.isFavorite(player.currentTrack.id), pop: popping }"
          @click="toggleFav" title="Ajouter aux favoris"
        >
          <svg width="17" height="17" viewBox="-1 -1 26 26" :fill="favorites.isFavorite(player.currentTrack.id) ? 'currentColor' : 'none'">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="time-display">
          {{ player.formatTime(player.progress) }} / {{ player.formatTime(player.duration) }}
        </span>
        <div class="volume-wrap desktop-only">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="vol-icon">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
          <div class="vol-slider-wrap">
            <input type="range" min="0" max="1" step="0.01"
              :value="player.volume" @input="player.setVolume(+$event.target.value)"
              class="vol-slider" />
          </div>
        </div>
      </div>
    </div>
  </div>
  <Transition name="sheet">
    <NowPlaying v-if="player.isExpanded" />
  </Transition>
</template>

<script setup>
import { ref } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useFavoritesStore } from '../stores/favorites.js'
import { useJamStore } from '../stores/jam.js'
import NowPlaying from './NowPlaying.vue'

const player = usePlayerStore()
const favorites = useFavoritesStore()
const jam = useJamStore()
const popping = ref(false)
let dragging = false

// Pendant un Jam suivi (pas hôte), les contrôles de transport sont bloqués :
// seul l'hôte décide de ce qui joue.
function guarded(fn) {
  if (jam.guardControl()) fn()
}

function seekFromEvent(e) {
  if (jam.isFollower) return
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  player.seek(ratio * player.duration)
}
function onSeekStart(e) {
  if (!jam.guardControl()) return
  dragging = true
  e.currentTarget.setPointerCapture?.(e.pointerId)
  seekFromEvent(e)
}
function onSeekMove(e) {
  if (dragging) seekFromEvent(e)
}
function onSeekEnd() {
  dragging = false
}

function toggleFav() {
  if (!player.currentTrack) return
  const wasFav = favorites.isFavorite(player.currentTrack.id)
  favorites.toggle(player.currentTrack)
  if (!wasFav) {
    popping.value = true
    setTimeout(() => { popping.value = false }, 420)
  }
}
</script>

<style scoped>
.player {
  position: fixed;
  bottom: calc(var(--nav-height) + var(--safe-bottom));
  left: 0; right: 0;
  height: var(--player-height);
  background: rgba(7, 7, 15, 0.85);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid var(--border);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

/* Barre de progression */
.prog-bar-wrap {
  height: 3px;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
}
.prog-bar-track {
  position: absolute; inset: 0;
  background: rgba(255,255,255,0.07);
  overflow: visible;
}
.prog-bar-fill {
  height: 100%;
  background: var(--gradient);
  transition: width .1s linear;
}
.prog-bar-thumb {
  position: absolute;
  top: 50%; transform: translate(-50%, -50%);
  width: 10px; height: 10px;
  background: #fff;
  border-radius: 50%;
  opacity: 0;
  transition: opacity .15s;
}
.prog-bar-wrap:hover .prog-bar-thumb { opacity: 1; }
.prog-bar-wrap:hover .prog-bar-track { background: rgba(255,255,255,0.12); }

.player-inner {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 20px;
  gap: 16px;
}

/* Track info */
.player-track {
  display: flex; align-items: center; gap: 12px; min-width: 0;
}
.cover-wrap {
  width: 46px; height: 46px; border-radius: 8px;
  background: var(--bg-3); flex-shrink: 0;
  overflow: hidden; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  border: none; padding: 0; cursor: pointer; font-family: inherit;
  transition: transform .15s;
}
.cover-wrap:active { transform: scale(0.94); }
.cover-img { width: 100%; height: 100%; object-fit: cover; }
.cover-empty { color: var(--text-3); }
.track-meta { display: flex; flex-direction: column; min-width: 0; gap: 2px; cursor: pointer; }
.track-title {
  font-size: 13px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--text);
}
.track-artist { font-size: 11px; color: var(--text-2); }

/* Contrôles */
.player-controls {
  display: flex; align-items: center; gap: 8px;
}
.ctrl {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  background: none; border: none; border-radius: 50%;
  color: var(--text-2); cursor: pointer; transition: all .15s;
}
.ctrl:hover { color: var(--text); background: var(--glass); }
.ctrl.play {
  width: 44px; height: 44px;
  background: var(--gradient);
  color: #fff;
  box-shadow: 0 4px 18px rgba(124,92,252,0.4);
}
.ctrl.play:hover { transform: scale(1.06); box-shadow: 0 6px 24px rgba(124,92,252,0.55); }

/* Droite */
.player-right {
  display: flex; align-items: center; justify-content: flex-end; gap: 16px;
}
.time-display {
  font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; white-space: nowrap;
}
.volume-wrap {
  display: flex; align-items: center; gap: 6px;
}
.vol-icon { color: var(--text-3); flex-shrink: 0; }
.vol-slider-wrap { width: 72px; }
.vol-slider {
  width: 100%; height: 3px; appearance: none; background: rgba(255,255,255,0.1);
  border-radius: 2px; cursor: pointer; outline: none; padding: 0; border: none;
}
.vol-slider::-webkit-slider-thumb {
  appearance: none; width: 10px; height: 10px;
  border-radius: 50%; background: #fff; cursor: pointer;
}

.desktop-only { display: none; }
@media (min-width: 768px) {
  .desktop-only { display: flex; }
  .player-inner { grid-template-columns: 1fr auto 1fr; }
}
</style>
