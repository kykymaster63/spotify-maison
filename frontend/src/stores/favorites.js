import { defineStore } from 'pinia'
import { reactive } from 'vue'
import axios from 'axios'

// Source unique de vérité pour l'état "favori" d'un morceau : chaque vue
// (Home, Library, Search, Favorites, Playlist...) et le player récupèrent
// leur PROPRE copie de l'objet track via axios, donc muter `track.is_favorite`
// localement ne se répercute jamais ailleurs. On centralise ici la liste des
// ids favoris pour que tous les coeurs affichés (bottom bar, plein écran,
// listes) restent synchronisés quel que soit l'endroit où on clique.
export const useFavoritesStore = defineStore('favorites', () => {
  const ids = reactive(new Set())

  function isFavorite(trackId) {
    return ids.has(trackId)
  }

  async function load() {
    try {
      const { data } = await axios.get('/api/favorites')
      ids.clear()
      data.forEach(t => ids.add(t.id))
    } catch {
      // pas grave : les coeurs retomberont sur is_favorite venu de l'API tant que non chargé
    }
  }

  async function toggle(track) {
    const wasFav = ids.has(track.id)
    const next = !wasFav
    if (next) ids.add(track.id)
    else ids.delete(track.id)
    track.is_favorite = next // gardé pour compat / optimisme visuel immédiat sur l'objet cliqué

    try {
      if (next) await axios.post(`/api/tracks/${track.id}/favorite`)
      else await axios.delete(`/api/tracks/${track.id}/favorite`)
    } catch {
      if (next) ids.delete(track.id)
      else ids.add(track.id)
      track.is_favorite = wasFav
    }
  }

  function clear() {
    ids.clear()
  }

  return { ids, isFavorite, load, toggle, clear }
})
