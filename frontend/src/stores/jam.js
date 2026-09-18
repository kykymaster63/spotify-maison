import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { usePlayerStore } from './player.js'
import { useToastStore } from './toast.js'

// Jam = session de lecture synchronisée. L'hôte est la seule source de
// vérité : ses actions de lecture (play/pause/seek/piste suivante) sont
// rebroadcastées à tout le monde ; les autres participants se contentent de
// suivre (leurs propres contrôles de lecture sont désactivés côté UI).
export const useJamStore = defineStore('jam', () => {
  const player = usePlayerStore()
  const toast = useToastStore()

  const code = ref(null)
  const isHost = ref(false)
  const participants = ref([])
  const queue = ref([])
  const connecting = ref(false)

  const isActive = computed(() => !!code.value)
  const isFollower = computed(() => isActive.value && !isHost.value)

  let ws = null
  let broadcastTimer = null
  let heartbeatTimer = null
  let stopWatching = null

  function wsUrl(roomCode) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = localStorage.getItem('token') || ''
    return `${proto}//${location.host}/api/jam/${roomCode}/ws?token=${encodeURIComponent(token)}`
  }

  function connect(roomCode, asHost) {
    disconnect()
    connecting.value = true
    ws = new WebSocket(wsUrl(roomCode))

    ws.onopen = () => { connecting.value = false }

    ws.onmessage = (event) => {
      let msg
      try { msg = JSON.parse(event.data) } catch { return }
      handleMessage(msg)
    }

    ws.onclose = () => {
      connecting.value = false
      if (code.value === roomCode) reset()
    }

    ws.onerror = () => { connecting.value = false }

    code.value = roomCode
    isHost.value = asHost
    if (asHost) startHostSync()
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'hello':
        isHost.value = msg.isHost
        participants.value = msg.participants
        queue.value = msg.queue
        if (!msg.isHost && msg.state?.track) player.applyJamState(msg.state)
        break
      case 'state':
        if (!isHost.value) player.applyJamState(msg)
        break
      case 'queue':
        queue.value = msg.queue
        if (isHost.value) mergeQueueIntoPlayer(msg.queue)
        break
      case 'participants':
        participants.value = msg.participants
        break
      case 'ended':
        toast.error(isHost.value ? 'Jam terminé' : 'L\'hôte a terminé le Jam')
        disconnect()
        reset()
        break
    }
  }

  // Absorbe dans la file d'écoute de l'hôte les morceaux ajoutés par les
  // autres participants, pour que "suivant" les enchaîne naturellement.
  function mergeQueueIntoPlayer(list) {
    const existingIds = new Set(player.queue.map(t => t.id))
    for (const item of list) {
      if (!existingIds.has(item.track.id)) {
        player.queue.push(item.track)
        existingIds.add(item.track.id)
      }
    }
  }

  function send(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
  }

  function broadcastState() {
    if (!player.currentTrack) return
    send({
      type: 'state',
      track: player.currentTrack,
      positionMs: Math.round(player.progress * 1000),
      isPlaying: player.isPlaying
    })
  }

  function startHostSync() {
    stopWatching = watch(
      () => [player.currentTrack?.id, player.isPlaying, player.seekVersion],
      () => {
        clearTimeout(broadcastTimer)
        broadcastTimer = setTimeout(broadcastState, 150)
      }
    )
    heartbeatTimer = setInterval(() => {
      if (player.isPlaying) broadcastState()
    }, 5000)
  }

  function stopHostSync() {
    if (stopWatching) { stopWatching(); stopWatching = null }
    clearTimeout(broadcastTimer)
    clearInterval(heartbeatTimer)
  }

  async function start() {
    const { data } = await axios.post('/api/jam')
    connect(data.code, true)
    return data.code
  }

  async function join(roomCode) {
    const clean = roomCode.trim().toUpperCase()
    if (!clean) return
    try {
      await axios.get(`/api/jam/${clean}`) // vérifie qu'il existe avant d'ouvrir le websocket
    } catch {
      toast.error('Code de Jam invalide ou Jam terminé')
      return
    }
    connect(clean, false)
  }

  function addTrack(track) {
    if (!isActive.value) return
    send({ type: 'queue_add', track })
  }

  function removeTrack(trackId) {
    send({ type: 'queue_remove', trackId })
  }

  async function leave() {
    if (isHost.value && code.value) {
      try { await axios.post(`/api/jam/${code.value}/end`) } catch { /* déjà terminé */ }
    }
    disconnect()
    reset()
  }

  function disconnect() {
    stopHostSync()
    if (ws) { ws.onclose = null; ws.close(); ws = null }
  }

  function reset() {
    code.value = null
    isHost.value = false
    participants.value = []
    queue.value = []
  }

  function guardControl() {
    if (isFollower.value) {
      toast.error('Seul l\'hôte contrôle la lecture pendant le Jam')
      return false
    }
    return true
  }

  return {
    code, isHost, isFollower, isActive, participants, queue, connecting,
    start, join, leave, addTrack, removeTrack, guardControl
  }
})
