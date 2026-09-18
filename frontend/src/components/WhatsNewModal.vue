<template>
  <Teleport to="body">
    <div v-if="modelValue" class="wn-overlay" @click.self="close">
      <div class="wn-sheet glass-card">
        <div class="wn-head">
          <h2>Nouveautés</h2>
          <button class="close-btn" @click="close" title="Fermer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="wn-body">
          <div v-for="(entry, i) in changelog.entries" :key="entry.id" class="wn-entry">
            <div class="wn-entry-head">
              <span class="wn-dot" :class="{ new: i === 0 }"></span>
              <h3>{{ entry.title }}</h3>
            </div>
            <ul>
              <li v-for="(item, j) in entry.items" :key="j">{{ item }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { watch } from 'vue'
import { useChangelogStore } from '../stores/changelog.js'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])

const changelog = useChangelogStore()

function close() { emit('update:modelValue', false) }

// Marqué comme vu à l'ouverture, pas juste au clic sur la cloche — sinon le
// point resterait affiché tant qu'on n'a pas explicitement "validé".
watch(() => props.modelValue, (open) => { if (open) changelog.markSeen() })
</script>

<style scoped>
.wn-overlay {
  position: fixed; inset: 0; z-index: 600;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: flex-end; justify-content: center;
}
@media (min-width: 640px) {
  .wn-overlay { align-items: center; }
}
.wn-sheet {
  width: 100%; max-width: 440px;
  max-height: 80vh; overflow-y: auto;
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  padding: 22px 20px calc(var(--safe-bottom) + 22px);
}
@media (min-width: 640px) {
  .wn-sheet { border-radius: var(--r-xl); }
}
.wn-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.wn-head h2 { font-size: 19px; font-weight: 800; }
.close-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--glass); border: none; color: var(--text); cursor: pointer;
}

.wn-body { display: flex; flex-direction: column; gap: 22px; }
.wn-entry-head { display: flex; align-items: center; gap: 9px; margin-bottom: 8px; }
.wn-entry-head h3 { font-size: 15px; font-weight: 700; }
.wn-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border-2); flex-shrink: 0; }
.wn-dot.new { background: var(--accent-2); }
.wn-entry ul { display: flex; flex-direction: column; gap: 6px; padding-left: 18px; }
.wn-entry li { font-size: 13px; color: var(--text-2); line-height: 1.4; }
</style>
