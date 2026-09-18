import { defineStore } from 'pinia'
import { ref } from 'vue'

const THEME_KEY = 'spm_theme'

// Chaque thème ne recolore que l'accent et le fond (voir les surcharges
// `[data-theme="..."]` dans assets/main.css) : le reste du design (verre,
// textes, rayons...) reste identique quel que soit le thème choisi.
export const THEMES = [
  { id: 'violet', name: 'Violet', swatch: 'linear-gradient(135deg, #7c5cfc 0%, #06d6c7 100%)', themeColor: '#0d0d1a' },
  { id: 'ocean', name: 'Océan', swatch: 'linear-gradient(135deg, #22b8d6 0%, #3b82f6 100%)', themeColor: '#0a0f1a' },
  { id: 'sunset', name: 'Coucher de soleil', swatch: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)', themeColor: '#1a0d0d' },
  { id: 'emerald', name: 'Émeraude', swatch: 'linear-gradient(135deg, #10b981 0%, #22c55e 100%)', themeColor: '#0a1a12' },
  { id: 'ruby', name: 'Rubis', swatch: 'linear-gradient(135deg, #ef4444 0%, #f43f5e 100%)', themeColor: '#1a0a0d' },
  { id: 'gold', name: 'Or', swatch: 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)', themeColor: '#1a1305' },
  { id: 'indigo', name: 'Indigo', swatch: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)', themeColor: '#0a0a1a' },
  { id: 'lavender', name: 'Lavande', swatch: 'linear-gradient(135deg, #a78bfa 0%, #f0abfc 100%)', themeColor: '#130f1a' },
  { id: 'mono', name: 'Graphite', swatch: 'linear-gradient(135deg, #a1a1aa 0%, #71717a 100%)', themeColor: '#0a0a0a' },
  { id: 'neon', name: 'Néon', swatch: 'linear-gradient(135deg, #ec4899 0%, #22d3ee 100%)', themeColor: '#10081a' }
]

export const useThemeStore = defineStore('theme', () => {
  const current = ref(localStorage.getItem(THEME_KEY) || 'violet')

  function apply(id) {
    const theme = THEMES.find(t => t.id === id) || THEMES[0]
    current.value = theme.id
    localStorage.setItem(THEME_KEY, theme.id)

    if (theme.id === 'violet') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme.id)

    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.themeColor)
  }

  apply(current.value) // applique le thème sauvegardé dès la création du store

  return { current, themes: THEMES, apply }
})
