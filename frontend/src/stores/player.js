import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { useToastStore } from './toast.js'

const LAST_TRACK_KEY = 'spm_last_track_id'
const LAST_PROGRESS_KEY = 'spm_last_progress'
const EQ_KEY = 'spm_eq_gains'
const SHUFFLE_KEY = 'spm_shuffle'
const OFFLINE_IDS_KEY = 'spm_offline_ids'
const OFFLINE_META_KEY = 'spm_offline_meta'
const OFFLINE_CACHE = 'hostify-offline-audio'

export const EQ_BANDS = [60, 250, 1000, 4000, 12000]

function offlineCacheKey(trackId) {
  // Clé stable (sans token, qui expire) pour retrouver le fichier en cache.
  return `/offline-track/${trackId}`
}

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
  const isOnline = ref(navigator.onLine)
  const offlineIds = ref(loadOfflineIds())
  const downloadingIds = ref(new Set())
  let lastPersist = 0
  let shuffleOrder = []
  let shufflePos = 0
  let currentBlobUrl = null

  window.addEventListener('online', () => isOnline.value = true)
  window.addEventListener('offline', () => isOnline.value = false)

  function loadOfflineIds() {
    try {
      const saved = JSON.parse(localStorage.getItem(OFFLINE_IDS_KEY) || '[]')
      if (Array.isArray(saved)) return new Set(saved)
    } catch { /* ignore */ }
    return new Set()
  }
  function persistOfflineIds() {
    localStorage.setItem(OFFLINE_IDS_KEY, JSON.stringify([...offlineIds.value]))
  }

  function isOfflineAvailable(trackId) { return offlineIds.value.has(trackId) }
  function isDownloading(trackId) { return downloadingIds.value.has(trackId) }

  // Télécharge le fichier complet (sans Range) et le stocke dans le cache du
  // navigateur pour qu'il reste jouable sans réseau.
  async function downloadForOffline(track) {
    if (!('caches' in window) || offlineIds.value.has(track.id) || downloadingIds.value.has(track.id)) return
    downloadingIds.value.add(track.id)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/tracks/${track.id}/stream?token=${encodeURIComponent(token || '')}`)
      if (!res.ok) throw new Error('download failed')
      const cache = await caches.open(OFFLINE_CACHE)
      await cache.put(offlineCacheKey(track.id), res)
      offlineIds.value.add(track.id)
      persistOfflineIds()

      // Sauvegarde les métadonnées essentielles pour pouvoir reprendre la
      // lecture même sans réseau (l'API /tracks/:id ne répondrait pas hors-ligne).
      const meta = JSON.parse(localStorage.getItem(OFFLINE_META_KEY) || '{}')
      meta[track.id] = {
        id: track.id, title: track.title, artist: track.artist,
        cover_url: track.cover_url, duration_seconds: track.duration_seconds, status: 'ready'
      }
      localStorage.setItem(OFFLINE_META_KEY, JSON.stringify(meta))
    } finally {
      downloadingIds.value.delete(track.id)
    }
  }

  async function removeOffline(trackId) {
    if ('caches' in window) {
      const cache = await caches.open(OFFLINE_CACHE)
      await cache.delete(offlineCacheKey(trackId))
    }
    offlineIds.value.delete(trackId)
    persistOfflineIds()
    const meta = JSON.parse(localStorage.getItem(OFFLINE_META_KEY) || '{}')
    delete meta[trackId]
    localStorage.setItem(OFFLINE_META_KEY, JSON.stringify(meta))
  }

  function getOfflineMeta(trackId) {
    try {
      const meta = JSON.parse(localStorage.getItem(OFFLINE_META_KEY) || '{}')
      return meta[trackId] || null
    } catch { return null }
  }

  async function getOfflineUrl(trackId) {
    if (!('caches' in window) || !offlineIds.value.has(trackId)) return null
    try {
      const cache = await caches.open(OFFLINE_CACHE)
      const res = await cache.match(offlineCacheKey(trackId))
      if (!res) return null
      const blob = await res.blob()
      return URL.createObjectURL(blob)
    } catch { return null }
  }

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
      album: 'Hostify',
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
    audio.value.addEventListener('error', () => {
      if (!isOnline.value && currentTrack.value && !offlineIds.value.has(currentTrack.value.id)) {
        useToastStore().error(`"${currentTrack.value.title}" n'est pas téléchargé pour le hors-ligne`)
      }
    })
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

  async function loadSource(track, resumeAt = 0) {
    if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null }

    const offlineUrl = await getOfflineUrl(track.id)
    if (offlineUrl) {
      currentBlobUrl = offlineUrl
      audio.value.src = offlineUrl
    } else {
      const token = localStorage.getItem('token')
      audio.value.src = `/api/tracks/${track.id}/stream?token=${encodeURIComponent(token || '')}`
    }

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
      await loadSource(track)
      axios.post('/api/me/now-playing', { track_id: track.id }).catch(() => {})
    }
    await audio.value.play()
  }

  // Recharge le dernier morceau écouté (sans lancer la lecture) pour le
  // retrouver au prochain lancement de l'app, à la position où on s'était arrêté.
  async function restoreLastTrack() {
    const trackId = localStorage.getItem(LAST_TRACK_KEY)
    if (!trackId || currentTrack.value) return
    const resumeAt = parseFloat(localStorage.getItem(LAST_PROGRESS_KEY) || '0')

    let track = null
    try {
      const { data } = await axios.get(`/api/tracks/${trackId}`)
      if (data.status === 'ready') track = data
    } catch {
      // Hors-ligne ou serveur inatteignable : on retombe sur la version
      // téléchargée si elle existe, plutôt que d'abandonner la reprise.
      track = getOfflineMeta(trackId)
    }
    if (!track) return

    initAudio()
    currentTrack.value = track
    queue.value = [track]
    queueIndex.value = 0
    await loadSource(track, resumeAt)
    progress.value = resumeAt
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
    shuffle, eqGains, isOnline, offlineIds,
    play, pause, togglePlay, next, prev, seek, setVolume, formatTime, restoreLastTrack, expand, collapse,
    toggleShuffle, setEqGain, resetEq,
    downloadForOffline, removeOffline, isOfflineAvailable, isDownloading
  }
})
