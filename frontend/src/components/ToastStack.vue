<template>
  <div class="toast-stack">
    <TransitionGroup name="toast">
      <div v-for="t in toast.toasts" :key="t.id" class="toast glass-card" :class="t.type" @click="toast.dismiss(t.id)">
        <span class="toast-dot"></span>
        <span class="toast-text">{{ t.text }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { useToastStore } from '../stores/toast.js'
const toast = useToastStore()
</script>

<style scoped>
.toast-stack {
  position: fixed;
  top: calc(var(--topbar-height) + 12px);
  left: 0; right: 0;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  z-index: 300; pointer-events: none;
  padding: 0 16px;
}
.toast {
  pointer-events: auto;
  display: flex; align-items: center; gap: 10px;
  padding: 11px 18px; max-width: 420px; width: 100%;
  font-size: 13px; font-weight: 500; color: var(--text);
  box-shadow: 0 10px 32px rgba(0,0,0,0.4);
  cursor: pointer;
}
.toast-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
.toast.success .toast-dot { background: var(--accent-2); }
.toast.error .toast-dot { background: #f87171; }

.toast-move, .toast-enter-active, .toast-leave-active { transition: all .25s ease; }
.toast-enter-from { opacity: 0; transform: translateY(-10px); }
.toast-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
