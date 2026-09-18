// Un Jam est une session de lecture synchronisée éphémère : purement en
// mémoire (pas de table en base), elle disparaît si le backend redémarre —
// comme le Jam Spotify, ce n'est pas censé survivre à une coupure serveur.
const rooms = new Map() // code -> room

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans caractères ambigus (0/O, 1/I...)

function generateCode() {
  let code
  do {
    code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
  } while (rooms.has(code))
  return code
}

export function createRoom(host) {
  const code = generateCode()
  const room = {
    code,
    hostId: host.id,
    hostUsername: host.username,
    state: { track: null, positionMs: 0, isPlaying: false, updatedAt: Date.now() },
    queue: [],
    // userId -> { user, sockets: Set<ws> } — un même utilisateur peut avoir plusieurs onglets/appareils
    members: new Map()
  }
  rooms.set(code, room)
  return room
}

export function getRoom(code) {
  return rooms.get(code?.toUpperCase())
}

export function destroyRoom(code) {
  rooms.delete(code)
}

export function participantsOf(room) {
  return [...room.members.values()].map(m => ({ id: m.user.id, username: m.user.username }))
}

export function addMember(room, user, ws) {
  let member = room.members.get(user.id)
  if (!member) {
    member = { user, sockets: new Set() }
    room.members.set(user.id, member)
  }
  member.sockets.add(ws)
}

export function removeMember(room, userId, ws) {
  const member = room.members.get(userId)
  if (!member) return
  member.sockets.delete(ws)
  if (member.sockets.size === 0) room.members.delete(userId)
}

export function broadcast(room, payload, { excludeUserId } = {}) {
  const data = JSON.stringify(payload)
  for (const member of room.members.values()) {
    if (excludeUserId && member.user.id === excludeUserId) continue
    for (const ws of member.sockets) {
      try { ws.send(data) } catch { /* socket probablement en train de se fermer */ }
    }
  }
}

// Si l'hôte se déconnecte brièvement (écran verrouillé, changement de réseau,
// refresh de page...), on ne tue pas le Jam immédiatement : on lui laisse une
// fenêtre pour revenir avant de le considérer terminé pour de bon.
export function armHostGrace(room, onExpire, ms = 20000) {
  clearHostGrace(room)
  room.hostGraceTimer = setTimeout(onExpire, ms)
}

export function clearHostGrace(room) {
  if (room.hostGraceTimer) {
    clearTimeout(room.hostGraceTimer)
    room.hostGraceTimer = null
  }
}

export function closeAllSockets(room) {
  for (const member of room.members.values()) {
    for (const ws of member.sockets) {
      try { ws.close() } catch { /* déjà fermé */ }
    }
  }
}
