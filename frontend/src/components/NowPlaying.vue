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
      <div class="cover-big">
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
        <button class="fav-btn big" :class="{ active: player.currentTrack?.is_favorite }" @click="toggleFav">
          <svg width="22" height="22" viewBox="0 0 24 24" :fill="player.currentTrack?.is_favorite ? 'currentColor' : 'none'">
            <path d="M12 20s-7.5-4.6-9.7-9.1C.7 7.8 2.3 4.5 5.6 4.1c1.9-.2 3.5.7 4.4 2.1.9-1.4 2.5-2.3 4.4-2.1 3.3.4 4.9 3.7 3.3 6.8C19.5 15.4 12 20 12 20z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

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
        <button class="ctrl-big" @click="player.prev()" title="Précédent">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
        </button>
        <button class="ctrl-big play" @click="player.togglePlay()">
          <svg v-if="!player.isPlaying" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>
        </button>
        <button class="ctrl-big" @click="player.next()" title="Suivant">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z"/></svg>
        </button>
        <button class="ctrl-small" style="visibility:hidden" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24"></svg>
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
import axios from 'axios'
import { usePlayerStore } from '../stores/player.js'

const player = usePlayerStore()

let seeking = false
function seekFromEvent(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  player.seek(ratio * player.duration)
}
function onSeekStart(e) { seeking = true; e.currentTarget.setPointerCapture?.(e.pointerId); seekFromEvent(e) }
function onSeekMove(e) { if (seeking) seekFromEvent(e) }
function onSeekEnd() { seeking = false }

async function toggleFav() {
  const track = player.currentTrack
  if (!track) return
  const next = !track.is_favorite
  track.is_favorite = next
  try {
    if (next) await axios.post(`/api/tracks/${track.id}/favorite`)
    else await axios.delete(`/api/tracks/${track.id}/favorite`)
  } catch {
    track.is_favorite = !next
  }
}

// Glisser vers le bas pour fermer (comme les bottom-sheets natifs)
const dragY = ref(0)
let dragging = false
let startY = 0
function onDragStart(e) {
  dragging = true
  startY = e.clientY
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onDragMove(e) {
  if (!dragging) return
  dragY.value = Math.max(0, e.clientY - startY)
}
function onDragEnd() {
  if (!dragging) return
  dragging = false
  if (dragY.value > 110) player.collapse()
  dragY.value = 0
}
const dragStyle = computed(() => dragY.value
  ? { transform: `translateY(${dragY.value}px)`, transition: 'none' }
  : {}
)
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
  padding: 28px 28px calc(var(--safe-bottom) + 28px);
  max-width: 480px; width: 100%; margin: 0 auto;
  overflow-y: auto;
}

.cover-big {
  width: min(78vw, 340px); height: min(78vw, 340px); margin: 12px auto 32px;
  border-radius: var(--r-xl); overflow: hidden; flex-shrink: 0;
  background: var(--bg-3); box-shadow: 0 24px 60px rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
}
.cover-big img { width: 100%; height: 100%; object-fit: cover; }
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
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  background: none; border: none; color: var(--text-3); cursor: pointer; transition: color .15s;
}
.ctrl-small.active { color: var(--accent); }

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
