<template>
  <div class="now-playing" :style="dragStyle">
    <div class="backdrop" :style="{ backgroundImage: player.currentTrack?.cover_url ? `url(${player.currentTrack.cover_url})` : 'none' }"></div>
    <div class="backdrop-veil"></div>

    <div
      class="handle-zone"
      @pointerdown="onDragStart" @pointermove="onDragMove" @pointerup="onDragEnd" @pointercancel="onDragEnd"
    >
      <div class="handle"></div>
    </div>

    <button class="close-btn" @click="player.collapse()" title="Réduire">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <div class="content">
      <Transition :name="'slide-' + slideDirection" mode="out-in">
        <div class="track-face" :key="player.currentTrack?.id">
          <div
            class="cover-big"
            :style="coverDragStyle"
            @pointerdown="onDragStart" @pointermove="onDragMove" @pointerup="onDragEnd" @pointercancel="onDragEnd"
          >
            <img v-if="player.currentTrack?.cover_url" :src="player.currentTrack.cover_url" alt="" />
            <div v-else class="cover-empty">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <path d="M9 18V6l12-2v12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                <circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.3"/>
                <circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.3"/>
              </svg>
            </div>
          </div>

          <div class="meta-row">
            <div class="meta-text">
              <span class="title">{{ player.currentTrack?.title }}</span>
              <span class="artist">{{ player.currentTrack?.artist || 'Artiste inconnu' }}</span>
            </div>
            <button class="fav-btn big" :class="{ active: player.currentTrack && favorites.isFavorite(player.currentTrack.id), pop: popping }" @click="toggleFav">
              <svg width="22" height="22" viewBox="-1 -1 26 26" :fill="player.currentTrack && favorites.isFavorite(player.currentTrack.id) ? 'currentColor' : 'none'">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </Transition>

      <div
        class="seek-wrap"
        @pointerdown="onSeekStart" @pointermove="onSeekMove" @pointerup="onSeekEnd" @pointercancel="onSeekEnd"
      >
        <div class="seek-track">
          <div class="seek-fill" :style="{ width: player.progressPercent + '%' }"></div>
          <div class="seek-thumb" :style="{ left: player.progressPercent + '%' }"></div>
        </div>
      </div>
      <div class="time-row">
        <span>{{ player.formatTime(player.progress) }}</span>
        <span>{{ player.formatTime(player.duration) }}</span>
      </div>

      <div class="controls-big">
        <button class="ctrl-small" :class="{ active: player.shuffle }" @click="player.toggleShuffle()" title="Aléatoire">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h3.5c1.5 0 2.3.8 3.2 2l1.6 2M3 18h3.5c1.5 0 2.3-.8 3.2-2l.6-.8M14 6h3c1 0 1.6.4 2.2 1.1M14 18h3c1 0 1.6-.4 2.2-1.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18.5 4l2.5 2.5-2.5 2.5M18.5 15.5l2.5 2.5-2.5 2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="ctrl-big" @click="goPrev" title="Précédent">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
        </button>
        <button class="ctrl-big play" @click="guarded(player.togglePlay)">
          <svg v-if="!player.isPlaying" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>
        </button>
        <button class="ctrl-big" @click="goNext" title="Suivant">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z"/></svg>
        </button>
        <button class="ctrl-small" :class="{ active: player.repeatMode !== 'off' }" @click="guarded(player.cycleRepeat)" title="Répétition">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M7 7h10a2 2 0 012 2v3M17 17H7a2 2 0 01-2-2v-3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9.5 4.5L7 7l2.5 2.5M14.5 19.5L17 17l-2.5-2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span v-if="player.repeatMode === 'one'" class="repeat-one-badge">1</span>
        </button>
      </div>

      <div class="volume-row desktop-only">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="vol-icon">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
        <input type="range" min="0" max="1" step="0.01"
          :value="player.volume" @input="player.setVolume(+$event.target.value)" class="vol-slider" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useFavoritesStore } from '../stores/favorites.js'
import { useJamStore } from '../stores/jam.js'

const player = usePlayerStore()
const favorites = useFavoritesStore()
const jam = useJamStore()
const popping = ref(false)

function guarded(fn) {
  if (jam.guardControl()) fn()
}

let seeking = false
function seekFromEvent(e) {
  if (jam.isFollower) return
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  player.seek(ratio * player.duration)
}
function onSeekStart(e) {
  if (!jam.guardControl()) return
  seeking = true
  try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* pointeur déjà relâché/invalide */ }
  seekFromEvent(e)
}
function onSeekMove(e) { if (seeking) seekFromEvent(e) }
function onSeekEnd() { seeking = false }

function toggleFav() {
  if (!player.currentTrack) return
  const wasFav = favorites.isFavorite(player.currentTrack.id)
  favorites.toggle(player.currentTrack)
  if (!wasFav) {
    popping.value = true
    setTimeout(() => { popping.value = false }, 420)
  }
}

// Glisser vers le bas (sur la poignée ou la pochette) ferme le plein écran ;
// glisser à droite/gauche sur la pochette change de morceau — l'axe dominant
// au-delà d'un petit seuil décide du geste, pour ne pas les confondre.
const dragY = ref(0)
const dragX = ref(0)
const slideDirection = ref('next')
let dragging = false
let startX = 0
let startY = 0
let axisLocked = null
function onDragStart(e) {
  dragging = true
  startX = e.clientX
  startY = e.clientY
  axisLocked = null
  try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* pointeur déjà relâché/invalide */ }
}
function onDragMove(e) {
  if (!dragging) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  if (!axisLocked && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
    axisLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
  }
  if (axisLocked === 'y') dragY.value = Math.max(0, dy)
  else if (axisLocked === 'x') dragX.value = dx
}
function onDragEnd() {
  if (!dragging) return
  dragging = false
  if (axisLocked === 'y' && dragY.value > 110) {
    player.collapse()
  } else if (axisLocked === 'x' && Math.abs(dragX.value) > 70) {
    if (dragX.value < 0) goNext()
    else goPrev()
  }
  dragX.value = 0
  dragY.value = 0
  axisLocked = null
}
const dragStyle = computed(() => dragY.value
  ? { transform: `translateY(${dragY.value}px)`, transition: 'none' }
  : {}
)
const coverDragStyle = computed(() => dragX.value
  ? { transform: `translateX(${dragX.value}px)`, transition: 'none' }
  : {}
)

// Même animation (glissée depuis la pochette) qu'on change de morceau au
// bouton ou en glissant — la direction pilote juste le sens du fondu.
function goNext() {
  slideDirection.value = 'next'
  guarded(player.next)
}
function goPrev() {
  slideDirection.value = 'prev'
  guarded(player.prev)
}
</script>

<style scoped>
.now-playing {
  position: fixed; inset: 0; z-index: 500;
  display: flex; flex-direction: column;
  background: var(--bg);
  transition: transform .25s ease;
  overflow: hidden;
}
.backdrop {
  position: absolute; inset: -10%; z-index: 0;
  background-size: cover; background-position: center;
  filter: blur(60px) saturate(1.4) brightness(.5);
  transform: scale(1.1);
}
.backdrop-veil { position: absolute; inset: 0; z-index: 0; background: rgba(5,5,10,0.55); }

.handle-zone {
  position: relative; z-index: 2;
  /* Décale sous la Dynamic Island / l'encoche : sinon la pochette démarre trop haut */
  padding: calc(var(--safe-top) + 10px) 0 4px;
  display: flex; justify-content: center; cursor: grab;
  touch-action: none;
}
.handle { width: 36px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.25); }

.close-btn {
  position: absolute; top: calc(var(--safe-top) + 10px); right: 16px; z-index: 3;
  width: 34px; height: 34px; border-radius: 50%;
  background: rgba(255,255,255,0.08); border: none; color: var(--text);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

.content {
  position: relative; z-index: 1;
  flex: 1; display: flex; flex-direction: column;
  justify-content: center;
  padding: 28px 28px calc(var(--safe-bottom) + 28px);
  max-width: 480px; width: 100%; margin: 0 auto;
  overflow-y: auto;
}

.track-face { width: 100%; }

/* Changement de morceau (bouton ou glissement) : la pochette+titre sortants
   et entrants glissent en sens inverse l'un de l'autre. */
.slide-next-enter-active, .slide-next-leave-active,
.slide-prev-enter-active, .slide-prev-leave-active {
  transition: transform .22s cubic-bezier(.32,.72,0,1), opacity .22s ease;
}
.slide-next-enter-from { transform: translateX(36px); opacity: 0; }
.slide-next-leave-to { transform: translateX(-36px); opacity: 0; }
.slide-prev-enter-from { transform: translateX(-36px); opacity: 0; }
.slide-prev-leave-to { transform: translateX(36px); opacity: 0; }

.cover-big {
  width: min(78vw, 340px); height: min(78vw, 340px); margin: 0 auto 32px;
  border-radius: var(--r-xl); overflow: hidden; flex-shrink: 0;
  background: var(--bg-3); box-shadow: 0 24px 60px rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  /* Glisser vers le bas depuis la pochette ferme aussi le plein écran */
  touch-action: none; cursor: grab;
}
.cover-big img { width: 100%; height: 100%; object-fit: cover; -webkit-user-drag: none; user-select: none; }
.cover-empty { color: var(--text-3); }

.meta-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 28px; }
.meta-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.title { font-size: 20px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; }
.artist { font-size: 14px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; }
.fav-btn.big { width: 40px; height: 40px; flex-shrink: 0; margin-top: 2px; }

.seek-wrap { padding: 10px 0; cursor: pointer; touch-action: none; }
.seek-track { height: 5px; border-radius: 3px; background: rgba(255,255,255,0.15); position: relative; }
.seek-fill { height: 100%; border-radius: 3px; background: var(--gradient); }
.seek-thumb {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  width: 13px; height: 13px; border-radius: 50%; background: #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
}
.time-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums; margin-bottom: 24px; }

.controls-big { display: flex; align-items: center; justify-content: center; gap: 28px; margin-bottom: 32px; }
.ctrl-big {
  display: flex; align-items: center; justify-content: center;
  width: 52px; height: 52px; border-radius: 50%;
  background: none; border: none; color: var(--text); cursor: pointer; transition: transform .15s;
}
.ctrl-big:active { transform: scale(0.9); }
.ctrl-big.play {
  width: 68px; height: 68px; background: var(--gradient);
  box-shadow: 0 8px 28px rgba(124,92,252,0.45);
}
.ctrl-small {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  background: none; border: none; color: var(--text-3); cursor: pointer; transition: color .15s;
}
.ctrl-small.active { color: var(--accent); }
.repeat-one-badge {
  position: absolute; top: 2px; right: 2px;
  width: 13px; height: 13px; border-radius: 50%;
  background: var(--accent); color: #fff;
  font-size: 9px; font-weight: 800; line-height: 13px; text-align: center;
}

.volume-row { align-items: center; gap: 10px; margin-top: auto; }
.volume-row.desktop-only { display: none; }
@media (min-width: 768px) {
  .volume-row.desktop-only { display: flex; }
}
.vol-icon { color: var(--text-3); flex-shrink: 0; }
.vol-slider {
  flex: 1; height: 4px; appearance: none; background: rgba(255,255,255,0.15);
  border-radius: 2px; cursor: pointer; outline: none; padding: 0; border: none;
}
.vol-slider::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #fff; cursor: pointer; }
</style>
