import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const LAST_TRACK_KEY = 'spm_last_track_id'
const LAST_PROGRESS_KEY = 'spm_last_progress'
const EQ_KEY = 'spm_eq_gains'
const SHUFFLE_KEY = 'spm_shuffle'

export const EQ_BANDS = [60, 250, 1000, 4000, 12000]

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
  const shuffle = ref(localStorage.getItem(SHUFFLE_KEY) === '1')
  const eqGains = ref(loadEqGains())
  let lastPersist = 0
  let shuffleOrder = []
  let shufflePos = 0

  // ─── Égaliseur (Web Audio API) ─────────────────────────────────────────
  let audioCtx = null
  let filters = []

  function loadEqGains() {
    try {
      const saved = JSON.parse(localStorage.getItem(EQ_KEY) || 'null')
      if (Array.isArray(saved) && saved.length === EQ_BANDS.length) return saved
    } catch { /* ignore */ }
    return EQ_BANDS.map(() => 0)
  }

  function setupEqualizer() {
    if (audioCtx) return
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      audioCtx = new AudioCtx()
      const source = audioCtx.createMediaElementSource(audio.value)
      filters = EQ_BANDS.map((freq, i) => {
        const f = audioCtx.createBiquadFilter()
        f.type = 'peaking'
        f.frequency.value = freq
        f.Q.value = 1
        f.gain.value = eqGains.value[i] || 0
        return f
      })
      let node = source
      for (const f of filters) { node.connect(f); node = f }
      node.connect(audioCtx.destination)
    } catch (e) {
      console.warn('Égaliseur indisponible :', e)
    }
  }

  function setEqGain(index, db) {
    eqGains.value[index] = db
    if (filters[index]) filters[index].gain.value = db
    localStorage.setItem(EQ_KEY, JSON.stringify(eqGains.value))
  }

  function resetEq() {
    EQ_BANDS.forEach((_, i) => setEqGain(i, 0))
  }

  // ─── Media Session (Centre de contrôle / écran verrouillé iOS) ────────
  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play', () => audio.value?.play())
    navigator.mediaSession.setActionHandler('pause', () => pause())
    navigator.mediaSession.setActionHandler('previoustrack', () => prev())
    navigator.mediaSession.setActionHandler('nexttrack', () => next())
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) seek(details.seekTime)
    })
  }

  function updateMediaMetadata() {
    if (!('mediaSession' in navigator) || !currentTrack.value) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.value.title || 'Titre inconnu',
      artist: currentTrack.value.artist || '',
      album: 'Spotify Maison',
      artwork: currentTrack.value.cover_url
        ? [{ src: currentTrack.value.cover_url, sizes: '512x512', type: 'image/jpeg' }]
        : []
    })
  }

  function updatePositionState() {
    if (!('mediaSession' in navigator) || !duration.value || !isFinite(duration.value)) return
    try {
      navigator.mediaSession.setPositionState({
        duration: duration.value,
        playbackRate: 1,
        position: Math.min(progress.value, duration.value)
      })
    } catch { /* valeurs transitoires invalides, sans conséquence */ }
  }

  function initAudio() {
    if (audio.value) return
    audio.value = new Audio()
    audio.value.volume = volume.value
    setupEqualizer()
    setupMediaSession()

    audio.value.addEventListener('timeupdate', () => {
      progress.value = audio.value.currentTime
      duration.value = audio.value.duration || 0
      updatePositionState()
      // Persiste la position de lecture de temps en temps (pas à chaque tick)
      const now = Date.now()
      if (now - lastPersist > 4000) {
        lastPersist = now
        localStorage.setItem(LAST_PROGRESS_KEY, String(audio.value.currentTime))
      }
    })
    audio.value.addEventListener('ended', () => next())
    audio.value.addEventListener('play', () => {
      isPlaying.value = true
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'
    })
    audio.value.addEventListener('pause', () => {
      isPlaying.value = false
      if (audio.value) localStorage.setItem(LAST_PROGRESS_KEY, String(audio.value.currentTime))
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
    })
  }

  function loadSource(track, resumeAt = 0) {
    const token = localStorage.getItem('token')
    audio.value.src = `/api/tracks/${track.id}/stream?token=${encodeURIComponent(token || '')}`
    localStorage.setItem(LAST_TRACK_KEY, track.id)
    localStorage.setItem(LAST_PROGRESS_KEY, String(resumeAt))
    updateMediaMetadata()
    if (resumeAt > 0) {
      const onReady = () => {
        audio.value.currentTime = resumeAt
        audio.value.removeEventListener('loadedmetadata', onReady)
      }
      audio.value.addEventListener('loadedmetadata', onReady)
    }
  }

  // ─── Ordre de lecture (mode aléatoire) ─────────────────────────────────
  function shuffleArray(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function rebuildShuffleOrder() {
    const rest = queue.value.map((_, i) => i).filter(i => i !== queueIndex.value)
    shuffleOrder = [queueIndex.value, ...shuffleArray(rest)]
    shufflePos = 0
  }

  function toggleShuffle() {
    shuffle.value = !shuffle.value
    localStorage.setItem(SHUFFLE_KEY, shuffle.value ? '1' : '0')
    if (shuffle.value) rebuildShuffleOrder()
  }

  async function play(track, newQueue = null) {
    initAudio()
    if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {})
    if (newQueue) {
      queue.value = newQueue
      queueIndex.value = newQueue.findIndex(t => t.id === track.id)
      if (shuffle.value) rebuildShuffleOrder()
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
    if (shuffle.value && shuffleOrder.length) {
      if (shufflePos < shuffleOrder.length - 1) {
        shufflePos++
        queueIndex.value = shuffleOrder[shufflePos]
        play(queue.value[queueIndex.value])
      }
      return
    }
    if (queueIndex.value < queue.value.length - 1) {
      queueIndex.value++
      play(queue.value[queueIndex.value])
    }
  }

  function prev() {
    if (progress.value > 3) {
      audio.value.currentTime = 0
      return
    }
    if (shuffle.value && shuffleOrder.length) {
      if (shufflePos > 0) {
        shufflePos--
        queueIndex.value = shuffleOrder[shufflePos]
        play(queue.value[queueIndex.value])
      }
      return
    }
    if (queueIndex.value > 0) {
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
    shuffle, eqGains,
    play, pause, togglePlay, next, prev, seek, setVolume, formatTime, restoreLastTrack, expand, collapse,
    toggleShuffle, setEqGain, resetEq
  }
})
