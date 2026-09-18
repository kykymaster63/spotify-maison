import { defineStore } from 'pinia'
import { ref } from 'vue'

let uid = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref([])

  function push(text, type = 'info', duration = 3800) {
    const id = ++uid
    toasts.value.push({ id, text, type })
    setTimeout(() => dismiss(id), duration)
  }

  function dismiss(id) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    success: (text) => push(text, 'success'),
    error: (text) => push(text, 'error'),
    info: (text) => push(text, 'info'),
    dismiss
  }
})
