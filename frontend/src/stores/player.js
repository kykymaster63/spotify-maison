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
const SKIP_SILENCE_KEY = 'spm_skip_silence'
const CROSSFADE_ENABLED_KEY = 'spm_crossfade_enabled'
const CROSSFADE_SECONDS_KEY = 'spm_crossfade_seconds'
const REPEAT_MODE_KEY = 'spm_repeat_mode'

export const EQ_BANDS = [60, 250, 1000, 4000, 12000]
export const CROSSFADE_OPTIONS = [2, 3, 5, 8]

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
  // Incrémenté à chaque déplacement manuel de la tête de lecture — le store
  // Jam s'appuie là-dessus pour savoir quand rebroadcaster l'état à l'hôte,
  // sans avoir à connaître les détails de seek()/du <audio>.
  const seekVersion = ref(0)
  // 'off' -> 'all' -> 'one' -> 'off'
  const repeatMode = ref(['off', 'all', 'one'].includes(localStorage.getItem(REPEAT_MODE_KEY)) ? localStorage.getItem(REPEAT_MODE_KEY) : 'off')
  const skipSilence = ref(localStorage.getItem(SKIP_SILENCE_KEY) === '1')
  const crossfadeEnabled = ref(localStorage.getItem(CROSSFADE_ENABLED_KEY) === '1')
  const crossfadeSeconds = ref(parseFloat(localStorage.getItem(CROSSFADE_SECONDS_KEY) || '5'))
  let lastPersist = 0
  let shuffleOrder = []
  let shufflePos = 0
  let currentBlobUrl = null
  // ─── Fondu entre morceaux : un second <audio> temporaire monte en volume
  // pendant que le premier descend, puis devient le nouvel élément actif.
  let crossfading = false
  let fadeInterval = null
  let incomingEl = null
  let nextBlobUrl = null

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
        cover_url: track.cover_url, duration_seconds: track.duration_seconds, status: 'ready',
        trim_start_ms: track.trim_start_ms, trim_end_ms: track.trim_end_ms
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

  // Résout l'URL à donner à un <audio> pour un morceau donné (hors-ligne ou
  // streaming), sans toucher à l'état du lecteur — réutilisé par le
  // chargement normal et par le fondu (qui prépare un second élément).
  async function resolveSrc(track) {
    const offlineUrl = await getOfflineUrl(track.id)
    if (offlineUrl) return { url: offlineUrl, isBlob: true }
    const token = localStorage.getItem('token')
    return { url: `/api/tracks/${track.id}/stream?token=${encodeURIComponent(token || '')}`, isBlob: false }
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

  // Construit la chaîne de filtres une seule fois (indépendamment de tout
  // élément <audio>), pour pouvoir y rebrancher n'importe quelle source par
  // la suite (nécessaire pour le fondu, qui promeut un nouvel élément).
  function setupEqualizer() {
    if (audioCtx) return
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      audioCtx = new AudioCtx()
      filters = EQ_BANDS.map((freq, i) => {
        const f = audioCtx.createBiquadFilter()
        f.type = 'peaking'
        f.frequency.value = freq
        f.Q.value = 1
        f.gain.value = eqGains.value[i] || 0
        return f
      })
      for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1])
      filters[filters.length - 1].connect(audioCtx.destination)
      connectEqualizerSource(audio.value)
    } catch (e) {
      console.warn('Égaliseur indisponible :', e)
    }
  }

  // iOS suspend l'AudioContext dès qu'il est créé hors d'un geste utilisateur
  // (ex. au chargement de l'app, avant tout clic) OU quand l'écran se
  // verrouille pendant la lecture. Une fois suspendu, l'élément <audio>
  // continue d'avancer (isPlaying passe à true, la progression défile...)
  // mais plus AUCUN son ne sort, puisque tout l'audio passe par ce contexte
  // depuis l'ajout de l'égaliseur. Il faut donc le relancer explicitement à
  // chaque tentative de lecture, pas seulement au premier `play()`.
  function resumeAudioContext() {
    if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {})
  }

  function connectEqualizerSource(el) {
    if (!audioCtx || !filters.length || !el) return
    try {
      const source = audioCtx.createMediaElementSource(el)
      source.connect(filters[0])
    } catch (e) {
      console.warn('Rebranchement égaliseur impossible :', e)
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
    navigator.mediaSession.setActionHandler('play', () => { resumeAudioContext(); audio.value?.play() })
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

  // Attache les écouteurs qui pilotent l'état partagé (progress, isPlaying...)
  // — réutilisable, car un fondu réussi remplace `audio.value` par un tout
  // nouvel élément qui doit être équipé exactement comme l'était l'ancien.
  function attachAudioListeners(el) {
    el.addEventListener('timeupdate', () => {
      if (audio.value !== el) return
      progress.value = el.currentTime
      duration.value = el.duration || 0
      updatePositionState()

      const now = Date.now()
      if (now - lastPersist > 4000) {
        lastPersist = now
        localStorage.setItem(LAST_PROGRESS_KEY, String(el.currentTime))
      }

      if (crossfading || !currentTrack.value) return

      const effectiveEnd = (skipSilence.value && currentTrack.value.trim_end_ms)
        ? currentTrack.value.trim_end_ms / 1000
        : duration.value
      if (!effectiveEnd) return
      const timeLeft = effectiveEnd - el.currentTime

      if (crossfadeEnabled.value && el.currentTime > 0 && timeLeft <= crossfadeSeconds.value && peekNextIndex() !== null) {
        startCrossfade()
      } else if (skipSilence.value && currentTrack.value.trim_end_ms && el.currentTime * 1000 >= currentTrack.value.trim_end_ms - 60) {
        handleTrackEnd()
      }
    })
    el.addEventListener('ended', () => { if (audio.value === el && !crossfading) handleTrackEnd() })
    el.addEventListener('error', () => {
      if (audio.value !== el) return
      if (!isOnline.value && currentTrack.value && !offlineIds.value.has(currentTrack.value.id)) {
        useToastStore().error(`"${currentTrack.value.title}" n'est pas téléchargé pour le hors-ligne`)
      }
    })
    el.addEventListener('play', () => {
      if (audio.value !== el) return
      isPlaying.value = true
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'
    })
    el.addEventListener('pause', () => {
      if (audio.value !== el) return
      isPlaying.value = false
      localStorage.setItem(LAST_PROGRESS_KEY, String(el.currentTime))
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
    })
  }

  function initAudio() {
    if (audio.value) return
    audio.value = new Audio()
    audio.value.volume = volume.value
    setupEqualizer()
    setupMediaSession()
    attachAudioListeners(audio.value)

    // Au retour au premier plan (déverrouillage d'écran, changement d'appli),
    // on retente le réveil de l'AudioContext directement, sans attendre que
    // l'utilisateur retape sur play — iOS le suspend souvent pendant la mise
    // en veille de l'écran alors que la lecture semblait toujours "en cours".
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') resumeAudioContext()
    })
  }

  async function loadSource(track, resumeAt = 0) {
    if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null }

    const { url, isBlob } = await resolveSrc(track)
    if (isBlob) currentBlobUrl = url
    audio.value.src = url

    // Sans position explicite à reprendre, on saute le blanc de début détecté
    // si l'option est activée — mais jamais si on reprend une lecture en cours.
    const startAt = resumeAt > 0 ? resumeAt : (skipSilence.value ? (track.trim_start_ms || 0) / 1000 : 0)

    localStorage.setItem(LAST_TRACK_KEY, track.id)
    localStorage.setItem(LAST_PROGRESS_KEY, String(startAt))
    updateMediaMetadata()
    if (startAt > 0) {
      const onReady = () => {
        audio.value.currentTime = startAt
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

  // Index du morceau qui suivrait un `next()`, sans rien déclencher — utilisé
  // pour savoir si un fondu est possible. Boucle sur le début de la file si
  // la répétition "tout" est active (comme le ferait next() lui-même).
  function peekNextIndex() {
    if (shuffle.value && shuffleOrder.length) {
      if (shufflePos < shuffleOrder.length - 1) return shuffleOrder[shufflePos + 1]
      return repeatMode.value === 'all' ? shuffleOrder[0] : null
    }
    if (queueIndex.value < queue.value.length - 1) return queueIndex.value + 1
    return repeatMode.value === 'all' && queue.value.length ? 0 : null
  }

  // Symétrique de peekNextIndex(), pour savoir si un "précédent" mènerait
  // réellement à un autre morceau (voir goToPrevTrack ci-dessous).
  function peekPrevIndex() {
    if (shuffle.value && shuffleOrder.length) {
      if (shufflePos > 0) return shuffleOrder[shufflePos - 1]
      return repeatMode.value === 'all' ? shuffleOrder[shuffleOrder.length - 1] : null
    }
    if (queueIndex.value > 0) return queueIndex.value - 1
    return repeatMode.value === 'all' && queue.value.length ? queue.value.length - 1 : null
  }

  function hasNextTrack() { return peekNextIndex() !== null }
  function hasPrevTrack() { return peekPrevIndex() !== null }

  // Navigation "pure" vers le morceau précédent : contrairement à prev()
  // (le bouton ◁, qui redémarre le morceau en cours passé 3s — pratique au
  // clic), le glissement doit toujours mener à un autre morceau ou ne rien
  // faire, jamais redémarrer celui en cours.
  function goToPrevTrack() {
    cancelCrossfade()
    const idx = peekPrevIndex()
    if (idx === null) return
    if (shuffle.value && shuffleOrder.length) shufflePos = shuffleOrder.indexOf(idx)
    queueIndex.value = idx
    play(queue.value[idx])
  }

  // ─── Fondu entre morceaux ───────────────────────────────────────────────
  function cancelCrossfade() {
    if (fadeInterval) { clearInterval(fadeInterval); fadeInterval = null }
    if (audio.value) audio.value.volume = volume.value
    if (incomingEl) { incomingEl.pause(); incomingEl.src = ''; incomingEl = null }
    if (nextBlobUrl) { URL.revokeObjectURL(nextBlobUrl); nextBlobUrl = null }
    crossfading = false
  }

  async function startCrossfade() {
    const nextIndex = peekNextIndex()
    if (crossfading || nextIndex === null) return
    const nextTrack = queue.value[nextIndex]
    if (!nextTrack) return
    crossfading = true

    const outgoing = audio.value
    const startVolume = outgoing.volume

    const el = new Audio()
    el.volume = 0
    const { url, isBlob } = await resolveSrc(nextTrack)
    if (isBlob) nextBlobUrl = url
    el.src = url
    const startAt = skipSilence.value ? (nextTrack.trim_start_ms || 0) / 1000 : 0
    if (startAt > 0) {
      const onReady = () => { el.currentTime = startAt; el.removeEventListener('loadedmetadata', onReady) }
      el.addEventListener('loadedmetadata', onReady)
    }
    incomingEl = el
    el.play().catch(() => {})

    const fadeMs = Math.max(500, crossfadeSeconds.value * 1000)
    const steps = 24
    let i = 0
    fadeInterval = setInterval(() => {
      i++
      const t = i / steps
      outgoing.volume = Math.max(0, startVolume * (1 - t))
      el.volume = Math.min(volume.value, volume.value * t)
      if (i >= steps) {
        clearInterval(fadeInterval)
        fadeInterval = null
        finishCrossfade(outgoing, el, nextTrack, nextIndex)
      }
    }, fadeMs / steps)
  }

  function finishCrossfade(outgoing, incoming, nextTrack, nextIndex) {
    outgoing.pause()
    outgoing.src = ''

    if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null }
    if (nextBlobUrl) { currentBlobUrl = nextBlobUrl; nextBlobUrl = null }

    queueIndex.value = nextIndex
    if (shuffle.value && shuffleOrder.length) shufflePos = shuffleOrder.indexOf(nextIndex)
    currentTrack.value = nextTrack
    audio.value = incoming
    incoming.volume = volume.value
    attachAudioListeners(incoming)
    connectEqualizerSource(incoming)
    updateMediaMetadata()
    localStorage.setItem(LAST_TRACK_KEY, nextTrack.id)
    localStorage.setItem(LAST_PROGRESS_KEY, String(incoming.currentTime))
    axios.post('/api/me/now-playing', { track_id: nextTrack.id }).catch(() => {})

    incomingEl = null
    crossfading = false
  }

  function setSkipSilence(v) {
    skipSilence.value = v
    localStorage.setItem(SKIP_SILENCE_KEY, v ? '1' : '0')
  }

  function setCrossfadeEnabled(v) {
    crossfadeEnabled.value = v
    localStorage.setItem(CROSSFADE_ENABLED_KEY, v ? '1' : '0')
    if (!v) cancelCrossfade()
  }

  function setCrossfadeSeconds(v) {
    crossfadeSeconds.value = v
    localStorage.setItem(CROSSFADE_SECONDS_KEY, String(v))
  }

  async function play(track, newQueue = null) {
    cancelCrossfade()
    initAudio()
    resumeAudioContext()
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
    cancelCrossfade()
    audio.value?.pause()
  }

  function togglePlay() {
    if (isPlaying.value) {
      pause()
    } else {
      resumeAudioContext()
      audio.value?.play()
    }
  }

  function next() {
    cancelCrossfade()
    if (shuffle.value && shuffleOrder.length) {
      if (shufflePos < shuffleOrder.length - 1) {
        shufflePos++
        queueIndex.value = shuffleOrder[shufflePos]
        play(queue.value[queueIndex.value])
      } else if (repeatMode.value === 'all') {
        shufflePos = 0
        queueIndex.value = shuffleOrder[shufflePos]
        play(queue.value[queueIndex.value])
      }
      return
    }
    if (queueIndex.value < queue.value.length - 1) {
      queueIndex.value++
      play(queue.value[queueIndex.value])
    } else if (repeatMode.value === 'all' && queue.value.length) {
      queueIndex.value = 0
      play(queue.value[queueIndex.value])
    }
  }

  function prev() {
    cancelCrossfade()
    if (progress.value > 3) {
      audio.value.currentTime = 0
      return
    }
    if (shuffle.value && shuffleOrder.length) {
      if (shufflePos > 0) {
        shufflePos--
        queueIndex.value = shuffleOrder[shufflePos]
        play(queue.value[queueIndex.value])
      } else if (repeatMode.value === 'all') {
        shufflePos = shuffleOrder.length - 1
        queueIndex.value = shuffleOrder[shufflePos]
        play(queue.value[queueIndex.value])
      }
      return
    }
    if (queueIndex.value > 0) {
      queueIndex.value--
      play(queue.value[queueIndex.value])
    } else if (repeatMode.value === 'all' && queue.value.length) {
      queueIndex.value = queue.value.length - 1
      play(queue.value[queueIndex.value])
    }
  }

  // Appelé uniquement à la fin naturelle d'un morceau (pas sur un clic manuel
  // "suivant") : en répétition "un seul", on rejoue le même au lieu d'avancer.
  function handleTrackEnd() {
    if (repeatMode.value === 'one' && currentTrack.value && audio.value) {
      const startAt = skipSilence.value ? (currentTrack.value.trim_start_ms || 0) / 1000 : 0
      audio.value.currentTime = startAt
      progress.value = startAt
      audio.value.play().catch(() => {})
      return
    }
    next()
  }

  function cycleRepeat() {
    const order = ['off', 'all', 'one']
    repeatMode.value = order[(order.indexOf(repeatMode.value) + 1) % order.length]
    localStorage.setItem(REPEAT_MODE_KEY, repeatMode.value)
  }

  function seek(time) {
    if (!audio.value || !isFinite(time)) return
    cancelCrossfade()
    audio.value.currentTime = Math.max(0, Math.min(time, duration.value || time))
    progress.value = audio.value.currentTime
    seekVersion.value++
  }

  // Applique un état de lecture reçu de l'hôte d'un Jam (voir stores/jam.js).
  // `updatedAt` est l'horodatage serveur auquel `positionMs` était exact : on
  // extrapole le temps écoulé depuis pour rattraper la position réelle.
  async function applyJamState({ track, positionMs = 0, isPlaying: playing, updatedAt }) {
    initAudio()
    resumeAudioContext()
    const targetSeconds = Math.max(0, (positionMs + (playing ? Date.now() - updatedAt : 0)) / 1000)

    if (track && currentTrack.value?.id !== track.id) {
      currentTrack.value = track
      queue.value = [track]
      await loadSource(track, targetSeconds)
    } else if (audio.value && Math.abs(audio.value.currentTime - targetSeconds) > 1.2) {
      audio.value.currentTime = targetSeconds
      progress.value = targetSeconds
    }

    if (playing) {
      try { await audio.value.play() } catch { /* nécessite parfois une interaction utilisateur */ }
    } else {
      pause()
    }
  }

  function setVolume(v) {
    volume.value = v
    if (audio.value && !crossfading) audio.value.volume = v
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
    shuffle, eqGains, isOnline, offlineIds, seekVersion, repeatMode,
    skipSilence, crossfadeEnabled, crossfadeSeconds,
    play, pause, togglePlay, next, prev, seek, setVolume, formatTime, restoreLastTrack, expand, collapse,
    toggleShuffle, cycleRepeat, setEqGain, resetEq, applyJamState,
    hasNextTrack, hasPrevTrack, goToPrevTrack,
    setSkipSilence, setCrossfadeEnabled, setCrossfadeSeconds,
    downloadForOffline, removeOffline, isOfflineAvailable, isDownloading
  }
})
