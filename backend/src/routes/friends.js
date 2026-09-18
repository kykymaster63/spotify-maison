import { db } from '../db/knex.js'

export async function friendsRoutes(fastify) {

  // GET /users/search?q=... — chercher un utilisateur par pseudo (pour ajout ami / invitation playlist)
  fastify.get('/users/search', {
    onRequest: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        required: ['q'],
        properties: { q: { type: 'string', minLength: 1 } }
      }
    }
  }, async (req) => {
    const users = await db('users')
      .whereILike('username', `%${req.query.q}%`)
      .whereNot({ id: req.user.sub })
      .select('id', 'username', 'avatar_url')
      .limit(10)

    const friendships = await db('friendships')
      .where({ requester_id: req.user.sub }).orWhere({ addressee_id: req.user.sub })

    return users.map(u => {
      const f = friendships.find(f => f.requester_id === u.id || f.addressee_id === u.id)
      let relation = 'none'
      if (f) {
        if (f.status === 'accepted') relation = 'friends'
        else relation = f.requester_id === req.user.sub ? 'pending_sent' : 'pending_received'
      }
      return { ...u, relation }
    })
  })

  // GET /friends — mes amis + demandes reçues/envoyées
  fastify.get('/friends', { onRequest: [fastify.authenticate] }, async (req) => {
    const userId = req.user.sub

    const accepted = await db('friendships')
      .join('users', function () {
        this.on(function () {
          this.on('friendships.requester_id', 'users.id').andOn('friendships.addressee_id', db.raw('?', [userId]))
        }).orOn(function () {
          this.on('friendships.addressee_id', 'users.id').andOn('friendships.requester_id', db.raw('?', [userId]))
        })
      })
      .where('friendships.status', 'accepted')
      .select('users.id', 'users.username', 'users.avatar_url')

    const incoming = await db('friendships')
      .join('users', 'friendships.requester_id', 'users.id')
      .where({ 'friendships.addressee_id': userId, 'friendships.status': 'pending' })
      .select('users.id', 'users.username', 'users.avatar_url')

    const outgoing = await db('friendships')
      .join('users', 'friendships.addressee_id', 'users.id')
      .where({ 'friendships.requester_id': userId, 'friendships.status': 'pending' })
      .select('users.id', 'users.username', 'users.avatar_url')

    return { accepted, incoming, outgoing }
  })

  // GET /friends/listening — ce que mes amis écoutent en ce moment
  fastify.get('/friends/listening', { onRequest: [fastify.authenticate] }, async (req) => {
    const userId = req.user.sub

    return db('friendships')
      .join('users', function () {
        this.on(function () {
          this.on('friendships.requester_id', 'users.id').andOn('friendships.addressee_id', db.raw('?', [userId]))
        }).orOn(function () {
          this.on('friendships.addressee_id', 'users.id').andOn('friendships.requester_id', db.raw('?', [userId]))
        })
      })
      .leftJoin('tracks', 'users.current_track_id', 'tracks.id')
      .where('friendships.status', 'accepted')
      .select(
        'users.id as user_id', 'users.username', 'users.avatar_url',
        'users.current_track_at', 'users.active_jam_code',
        'tracks.id as track_id', 'tracks.title', 'tracks.artist', 'tracks.cover_url'
      )
  })

  // POST /friends/request — envoyer une demande d'ami
  fastify.post('/friends/request', {
    onRequest: [fastify.authenticate],
    schema: {
      body: { type: 'object', required: ['user_id'], properties: { user_id: { type: 'string' } } }
    }
  }, async (req, reply) => {
    const { user_id } = req.body
    if (user_id === req.user.sub) return reply.code(400).send({ error: 'Impossible de s\'ajouter soi-même' })

    const target = await db('users').where({ id: user_id }).first()
    if (!target) return reply.code(404).send({ error: 'Utilisateur introuvable' })

    const existing = await db('friendships')
      .where({ requester_id: req.user.sub, addressee_id: user_id })
      .orWhere({ requester_id: user_id, addressee_id: req.user.sub })
      .first()
    if (existing) return reply.code(409).send({ error: 'Une relation existe déjà avec cet utilisateur' })

    await db('friendships').insert({ requester_id: req.user.sub, addressee_id: user_id })
    return reply.code(201).send({ ok: true })
  })

  // POST /friends/:userId/accept — accepter une demande reçue
  fastify.post('/friends/:userId/accept', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const updated = await db('friendships')
      .where({ requester_id: req.params.userId, addressee_id: req.user.sub, status: 'pending' })
      .update({ status: 'accepted' })
    if (!updated) return reply.code(404).send({ error: 'Demande introuvable' })
    return { ok: true }
  })

  // DELETE /friends/:userId — refuser / annuler / retirer un ami
  fastify.delete('/friends/:userId', { onRequest: [fastify.authenticate] }, async (req) => {
    await db('friendships')
      .where({ requester_id: req.user.sub, addressee_id: req.params.userId })
      .orWhere({ requester_id: req.params.userId, addressee_id: req.user.sub })
      .delete()
    return { ok: true }
  })

  // POST /me/now-playing — signale ce que j'écoute (pour l'activité amis)
  fastify.post('/me/now-playing', {
    onRequest: [fastify.authenticate],
    schema: {
      body: { type: 'object', required: ['track_id'], properties: { track_id: { type: 'string' } } }
    }
  }, async (req) => {
    await db('users').where({ id: req.user.sub }).update({
      current_track_id: req.body.track_id,
      current_track_at: db.fn.now()
    })
    return { ok: true }
  })
}
