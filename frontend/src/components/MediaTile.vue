<template>
  <button class="media-tile" @click="$emit('click')">
    <div class="tile-cover" :class="{ round: rounded }">
      <img v-if="cover" :src="cover" alt="" />
      <div v-else class="tile-fallback">
        <svg v-if="rounded" width="30" height="30" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
          <path d="M4 20c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <svg v-else width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M9 18V6l12-2v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </div>
    </div>
    <span class="tile-title">{{ title }}</span>
    <span v-if="subtitle" class="tile-subtitle">{{ subtitle }}</span>
  </button>
</template>

<script setup>
defineProps({
  cover: { type: String, default: null },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  rounded: { type: Boolean, default: false }
})
defineEmits(['click'])
</script>

<style scoped>
.media-tile {
  display: flex; flex-direction: column; gap: 8px;
  width: 128px; flex-shrink: 0;
  background: none; border: none; padding: 0; cursor: pointer; text-align: left;
  font-family: inherit;
}
.tile-cover {
  width: 128px; height: 128px; border-radius: var(--r-sm);
  background: var(--bg-3); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-3);
  transition: transform .15s;
}
.tile-cover.round { border-radius: 50%; }
.media-tile:active .tile-cover { transform: scale(0.95); }
.tile-cover img { width: 100%; height: 100%; object-fit: cover; }
.tile-title {
  font-size: 13px; font-weight: 600; color: var(--text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tile-subtitle {
  font-size: 11px; color: var(--text-2);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
</style>
