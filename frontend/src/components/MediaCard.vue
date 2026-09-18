<template>
  <div class="media-card glass-card" :class="{ large }">
    <div class="thumb-wrap" @click="$emit('preview')">
      <img v-if="item.thumbnail" :src="item.thumbnail" alt="" class="thumb" />
      <div v-else class="thumb-fallback">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" stroke="currentColor" stroke-width="1.4"/>
        </svg>
      </div>
      <span v-if="item.duration" class="duration-badge">{{ fmt(item.duration) }}</span>
      <button class="preview-btn" :class="{ playing }">
        <svg v-if="!playing" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>
      </button>
    </div>

    <div class="info">
      <span class="title">{{ item.title }}</span>
      <span class="artist">{{ item.artist || (item.source === 'soundcloud' ? 'SoundCloud' : 'YouTube') }}</span>
    </div>

    <button class="btn add-btn" :class="added ? 'btn-ghost added' : 'btn-primary'" :disabled="adding || added" @click="$emit('add')">
      <span v-if="adding" class="spinner-xs"></span>
      <template v-else-if="added">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
        Ajouté
      </template>
      <span v-else>Ajouter</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  item: { type: Object, required: true },
  playing: { type: Boolean, default: false },
  adding: { type: Boolean, default: false },
  added: { type: Boolean, default: false },
  large: { type: Boolean, default: false }
})
defineEmits(['preview', 'add'])

function fmt(s) {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}
</script>

<style scoped>
.media-card { display: flex; flex-direction: column; gap: 10px; padding: 10px; }
.media-card.large { flex-direction: row; align-items: center; padding: 14px; gap: 16px; }
.media-card.large .thumb-wrap { width: 160px; flex-shrink: 0; }
.media-card.large .info { flex: 1; }

.thumb-wrap {
  position: relative; aspect-ratio: 16/9; border-radius: var(--r-sm); overflow: hidden;
  background: var(--bg-3); cursor: pointer; flex-shrink: 0;
}
.thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-3); }

.duration-badge {
  position: absolute; bottom: 6px; right: 6px;
  background: rgba(0,0,0,0.7); color: #fff; font-size: 10px; font-weight: 600;
  padding: 2px 6px; border-radius: 4px; font-variant-numeric: tabular-nums;
}

.preview-btn {
  position: absolute; inset: 0; margin: auto; width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.45); color: #fff; border: none; border-radius: 50%;
  cursor: pointer; opacity: 0; transition: opacity .15s, background .15s, transform .15s;
}
.thumb-wrap:hover .preview-btn { opacity: 1; }
.preview-btn.playing { opacity: 1; background: var(--accent); }
.preview-btn:hover { transform: scale(1.08); }

.info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.title { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.3; }
.media-card.large .title { font-size: 15px; }
.artist { font-size: 11px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.add-btn { width: 100%; padding: 8px 0; font-size: 12px; }
.media-card.large .add-btn { width: auto; padding: 9px 20px; }
.add-btn.added { color: var(--accent-2); }
.spinner-xs {
  width: 12px; height: 12px; border: 2px solid rgba(255,255,255,.3);
  border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
