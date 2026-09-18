import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const LAST_TRACK_KEY = 'spm_last_track_id'
const LAST_PROGRESS_KEY = 'spm_last_progress'

export const usePlayerStore = defineStore('player', () => {
  const audio = ref(null)
  const currentTrack = ref(null)
  const queue = ref([])
  const queueIndex = ref(0)
  const isPlaying = ref(false)
  const progress = ref(0)
  const duration = ref(0)
  const volume = ref(parseFloat(localStorage.getItem('volume') || '1'))
  const isExpanded = ref(false)
  let lastPersist = 0

  function initAudio() {
    if (audio.value) return
    audio.value = new Audio()
    audio.value.volume = volume.value

    audio.value.addEventListener('timeupdate', () => {
      progress.value = audio.value.currentTime
      duration.value = audio.value.duration || 0
      // Persiste la position de lecture de temps en temps (pas à chaque tick)
      const now = Date.now()
      if (now - lastPersist > 4000) {
        lastPersist = now
        localStorage.setItem(LAST_PROGRESS_KEY, String(audio.value.currentTime))
      }
    })
    audio.value.addEventListener('ended', () => next())
    audio.value.addEventListener('play', () => isPlaying.value = true)
    audio.value.addEventListener('pause', () => {
      isPlaying.value = false
      if (audio.value) localStorage.setItem(LAST_PROGRESS_KEY, String(audio.value.currentTime))
    })
  }

  function loadSource(track, resumeAt = 0) {
    const token = localStorage.getItem('token')
    audio.value.src = `/api/tracks/${track.id}/stream?token=${encodeURIComponent(token || '')}`
    localStorage.setItem(LAST_TRACK_KEY, track.id)
    localStorage.setItem(LAST_PROGRESS_KEY, String(resumeAt))
    if (resumeAt > 0) {
      const onReady = () => {
        audio.value.currentTime = resumeAt
        audio.value.removeEventListener('loadedmetadata', onReady)
      }
      audio.value.addEventListener('loadedmetadata', onReady)
    }
  }

  async function play(track, newQueue = null) {
    initAudio()
    if (newQueue) {
      queue.value = newQueue
      queueIndex.value = newQueue.findIndex(t => t.id === track.id)
    }
    if (currentTrack.value?.id !== track.id) {
      currentTrack.value = track
      loadSource(track)
    }
    await audio.value.play()
  }

  // Recharge le dernier morceau écouté (sans lancer la lecture) pour le
  // retrouver au prochain lancement de l'app, à la position où on s'était arrêté.
  async function restoreLastTrack() {
    const trackId = localStorage.getItem(LAST_TRACK_KEY)
    if (!trackId || currentTrack.value) return
    const resumeAt = parseFloat(localStorage.getItem(LAST_PROGRESS_KEY) || '0')
    try {
      const { data: track } = await axios.get(`/api/tracks/${trackId}`)
      if (track.status !== 'ready') return
      initAudio()
      currentTrack.value = track
      queue.value = [track]
      queueIndex.value = 0
      loadSource(track, resumeAt)
      progress.value = resumeAt
    } catch { /* morceau supprimé ou inaccessible : on ignore */ }
  }

  function pause() {
    audio.value?.pause()
  }

  function togglePlay() {
    if (isPlaying.value) pause()
    else audio.value?.play()
  }

  function next() {
    if (queueIndex.value < queue.value.length - 1) {
      queueIndex.value++
      play(queue.value[queueIndex.value])
    }
  }

  function prev() {
    if (progress.value > 3) {
      audio.value.currentTime = 0
    } else if (queueIndex.value > 0) {
      queueIndex.value--
      play(queue.value[queueIndex.value])
    }
  }

  function seek(time) {
    if (!audio.value || !isFinite(time)) return
    audio.value.currentTime = Math.max(0, Math.min(time, duration.value || time))
    progress.value = audio.value.currentTime
  }

  function setVolume(v) {
    volume.value = v
    if (audio.value) audio.value.volume = v
    localStorage.setItem('volume', String(v))
  }

  function expand() { if (currentTrack.value) isExpanded.value = true }
  function collapse() { isExpanded.value = false }

  const progressPercent = computed(() => duration.value ? (progress.value / duration.value) * 100 : 0)

  function formatTime(s) {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  return {
    currentTrack, queue, isPlaying, progress, duration, volume, progressPercent, isExpanded,
    play, pause, togglePlay, next, prev, seek, setVolume, formatTime, restoreLastTrack, expand, collapse
  }
})
