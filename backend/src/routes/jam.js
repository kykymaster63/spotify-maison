import { db } from '../db/knex.js'
import {
  createRoom, getRoom, destroyRoom, addMember, removeMember, broadcast, closeAllSockets,
  participantsOf, armHostGrace, clearHostGrace
} from '../services/jam.js'

export async function jamRoutes(fastify) {

  // POST /jam — démarre un nouveau Jam (moi = hôte). Renvoie le code existant
  // si j'en ai déjà un en cours plutôt que d'en créer un second orphelin.
  fastify.post('/jam', { onRequest: [fastify.authenticate] }, async (req) => {
    const user = await db('users').where({ id: req.user.sub }).first('id', 'username', 'active_jam_code')
    const existing = user.active_jam_code && getRoom(user.active_jam_code)
    if (existing && existing.hostId === user.id) return { code: existing.code }

    const room = createRoom(user)
    await db('users').where({ id: user.id }).update({ active_jam_code: room.code })
    return { code: room.code }
  })

  // GET /jam/:code — aperçu de l'état actuel (avant d'ouvrir le websocket)
  fastify.get('/jam/:code', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const room = getRoom(req.params.code)
    if (!room) return reply.code(404).send({ error: 'Jam introuvable' })
    return {
      code: room.code,
      hostUsername: room.hostUsername,
      state: room.state,
      queue: room.queue,
      participants: participantsOf(room)
    }
  })

  // POST /jam/:code/end — l'hôte termine volontairement le Jam
  fastify.post('/jam/:code/end', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const room = getRoom(req.params.code)
    if (!room) return reply.code(404).send({ error: 'Jam introuvable' })
    if (room.hostId !== req.user.sub) return reply.code(403).send({ error: 'Seul l\'hôte peut terminer le Jam' })

    broadcast(room, { type: 'ended' })
    closeAllSockets(room)
    destroyRoom(room.code)
    await db('users').where({ id: req.user.sub }).update({ active_jam_code: null })
    return { ok: true }
  })

  // WS /jam/:code/ws?token=... — canal temps réel : l'hôte pousse l'état de
  // lecture, tout le monde peut ajouter des morceaux à la file du Jam.
  fastify.get('/jam/:code/ws', { websocket: true }, (connection, req) => {
    const ws = connection.socket || connection // selon la version, le ws brut est direct ou dans .socket
    let user, room

    try {
      const token = req.query?.token
      if (!token) throw new Error('missing token')
      user = fastify.jwt.verify(token)
    } catch {
      ws.close(4401, 'unauthorized')
      return
    }

    room = getRoom(req.params.code)
    if (!room) {
      ws.close(4404, 'not found')
      return
    }

    const isHost = room.hostId === user.sub
    if (isHost) clearHostGrace(room) // l'hôte se (re)connecte : on annule la fin programmée
    addMember(room, { id: user.sub, username: user.username }, ws)
    broadcast(room, { type: 'participants', participants: participantsOf(room) })

    ws.send(JSON.stringify({
      type: 'hello',
      isHost,
      state: room.state,
      queue: room.queue,
      participants: participantsOf(room)
    }))

    ws.on('message', raw => {
      let msg
      try { msg = JSON.parse(raw.toString()) } catch { return }

      if (msg.type === 'state' && isHost) {
        room.state = {
          track: msg.track || null,
          positionMs: Number(msg.positionMs) || 0,
          isPlaying: !!msg.isPlaying,
          updatedAt: Date.now() // horloge serveur : on ne fait pas confiance à celle du client
        }
        broadcast(room, { type: 'state', ...room.state }, { excludeUserId: user.sub })
      } else if (msg.type === 'queue_add' && msg.track) {
        room.queue.push({ track: msg.track, addedBy: user.sub, addedByUsername: user.username })
        broadcast(room, { type: 'queue', queue: room.queue })
      } else if (msg.type === 'queue_remove' && msg.trackId) {
        const idx = room.queue.findIndex(q => q.track.id === msg.trackId && (q.addedBy === user.sub || isHost))
        if (idx !== -1) {
          room.queue.splice(idx, 1)
          broadcast(room, { type: 'queue', queue: room.queue })
        }
      }
    })

    ws.on('close', () => {
      removeMember(room, user.sub, ws)
      broadcast(room, { type: 'participants', participants: participantsOf(room) })

      // Si l'hôte perd la connexion (écran verrouillé, page rechargée...),
      // on laisse une fenêtre de grâce avant de clore le Jam pour de bon,
      // plutôt que de le tuer à la moindre coupure réseau.
      if (isHost && !room.members.has(user.sub)) {
        armHostGrace(room, async () => {
          if (getRoom(room.code) !== room) return
          broadcast(room, { type: 'ended' })
          closeAllSockets(room)
          destroyRoom(room.code)
          await db('users').where({ id: user.sub }).update({ active_jam_code: null }).catch(() => {})
        })
      }
    })
  })
}
