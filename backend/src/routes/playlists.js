import { db } from '../db/knex.js'

export async function playlistsRoutes(fastify) {

  // GET /playlists — mes playlists + celles partagées avec moi
  fastify.get('/playlists', { onRequest: [fastify.authenticate] }, async (req) => {
    const userId = req.user.sub
    const owned = await db('playlists').where({ owner_id: userId }).orderBy('created_at', 'desc')
    const shared = await db('playlists')
      .join('playlist_collaborators', 'playlists.id', 'playlist_collaborators.playlist_id')
      .where('playlist_collaborators.user_id', userId)
      .select('playlists.*', 'playlist_collaborators.role')
    return { owned, shared }
  })

  // POST /playlists — créer une playlist
  fastify.post('/playlists', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          is_public: { type: 'boolean' }
        }
      }
    }
  }, async (req, reply) => {
    const { name, description, is_public = false } = req.body
    const [playlist] = await db('playlists').insert({
      name, description, is_public,
      owner_id: req.user.sub
    }).returning('*')
    return reply.code(201).send(playlist)
  })

  // GET /playlists/:id — détail + tracks
  fastify.get('/playlists/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const playlist = await db('playlists').where({ id: req.params.id }).first()
    if (!playlist) return reply.code(404).send({ error: 'Playlist introuvable' })

    const tracks = await db('playlist_tracks')
      .join('tracks', 'playlist_tracks.track_id', 'tracks.id')
      .where('playlist_tracks.playlist_id', req.params.id)
      .select('tracks.*', 'playlist_tracks.position', 'playlist_tracks.added_at')
      .orderBy('playlist_tracks.position')

    return { ...playlist, tracks }
  })

  // POST /playlists/:id/tracks — ajouter un morceau
  fastify.post('/playlists/:id/tracks', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['track_id'],
        properties: { track_id: { type: 'string' } }
      }
    }
  }, async (req, reply) => {
    const { track_id } = req.body
    const { id: playlist_id } = req.params

    const max = await db('playlist_tracks').where({ playlist_id }).max('position as m').first()
    const position = (max.m || 0) + 1

    await db('playlist_tracks').insert({ playlist_id, track_id, position })
    return reply.code(201).send({ ok: true, position })
  })

  // DELETE /playlists/:id/tracks/:trackId — retirer un morceau
  fastify.delete('/playlists/:id/tracks/:trackId', { onRequest: [fastify.authenticate] }, async (req) => {
    await db('playlist_tracks').where({
      playlist_id: req.params.id,
      track_id: req.params.trackId
    }).delete()
    return { ok: true }
  })

  // POST /playlists/:id/collaborators — partager une playlist
  fastify.post('/playlists/:id/collaborators', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['user_id'],
        properties: {
          user_id: { type: 'string' },
          role: { type: 'string', enum: ['viewer', 'editor'] }
        }
      }
    }
  }, async (req, reply) => {
    const { user_id, role = 'editor' } = req.body
    await db('playlist_collaborators')
      .insert({ playlist_id: req.params.id, user_id, role })
      .onConflict(['playlist_id', 'user_id']).merge()
    return reply.code(201).send({ ok: true })
  })
}
