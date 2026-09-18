import { db } from '../db/knex.js'

async function getAccess(playlistId, userId) {
  const playlist = await db('playlists').where({ id: playlistId }).first()
  if (!playlist) return { playlist: null }

  const isOwner = playlist.owner_id === userId
  const collaborator = isOwner
    ? null
    : await db('playlist_collaborators').where({ playlist_id: playlistId, user_id: userId }).first()

  const canView = playlist.is_public || isOwner || !!collaborator
  const canEdit = isOwner || collaborator?.role === 'editor'
  return { playlist, isOwner, canView, canEdit }
}

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

  // GET /playlists/:id — détail + tracks (visible si publique, propriétaire ou collaborateur)
  fastify.get('/playlists/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { playlist, isOwner, canView } = await getAccess(req.params.id, req.user.sub)
    if (!playlist || !canView) return reply.code(404).send({ error: 'Playlist introuvable' })

    const tracks = await db('playlist_tracks')
      .join('tracks', 'playlist_tracks.track_id', 'tracks.id')
      .leftJoin('users as adders', 'playlist_tracks.added_by', 'adders.id')
      .where('playlist_tracks.playlist_id', req.params.id)
      .select(
        'tracks.*', 'playlist_tracks.position', 'playlist_tracks.added_at',
        'adders.username as added_by_username'
      )
      .orderBy('playlist_tracks.position')

    let collaborators = []
    if (isOwner) {
      collaborators = await db('playlist_collaborators')
        .join('users', 'playlist_collaborators.user_id', 'users.id')
        .where('playlist_collaborators.playlist_id', req.params.id)
        .select('users.id', 'users.username', 'users.avatar_url', 'playlist_collaborators.role')
    }

    return { ...playlist, tracks, collaborators, is_owner: isOwner }
  })

  // POST /playlists/:id/tracks — ajouter un morceau (propriétaire ou collaborateur éditeur)
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

    const { playlist, canEdit } = await getAccess(playlist_id, req.user.sub)
    if (!playlist) return reply.code(404).send({ error: 'Playlist introuvable' })
    if (!canEdit) return reply.code(403).send({ error: "Tu n'as pas le droit de modifier cette playlist" })

    const max = await db('playlist_tracks').where({ playlist_id }).max('position as m').first()
    const position = (max.m || 0) + 1

    const inserted = await db('playlist_tracks')
      .insert({ playlist_id, track_id, position, added_by: req.user.sub })
      .onConflict(['playlist_id', 'track_id']).ignore()
      .returning('track_id')

    if (!inserted.length) {
      return reply.code(409).send({ error: 'Ce morceau est déjà dans cette playlist' })
    }
    return reply.code(201).send({ ok: true, position })
  })

  // DELETE /playlists/:id/tracks/:trackId — retirer un morceau
  fastify.delete('/playlists/:id/tracks/:trackId', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { playlist, canEdit } = await getAccess(req.params.id, req.user.sub)
    if (!playlist) return reply.code(404).send({ error: 'Playlist introuvable' })
    if (!canEdit) return reply.code(403).send({ error: "Tu n'as pas le droit de modifier cette playlist" })

    await db('playlist_tracks').where({
      playlist_id: req.params.id,
      track_id: req.params.trackId
    }).delete()
    return { ok: true }
  })

  // POST /playlists/:id/collaborators — inviter quelqu'un (propriétaire uniquement)
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
    const { playlist, isOwner } = await getAccess(req.params.id, req.user.sub)
    if (!playlist) return reply.code(404).send({ error: 'Playlist introuvable' })
    if (!isOwner) return reply.code(403).send({ error: 'Seul le propriétaire peut inviter' })

    const { user_id, role = 'editor' } = req.body
    if (user_id === playlist.owner_id) return reply.code(400).send({ error: 'Le propriétaire a déjà accès' })

    await db('playlist_collaborators')
      .insert({ playlist_id: req.params.id, user_id, role })
      .onConflict(['playlist_id', 'user_id']).merge()
    return reply.code(201).send({ ok: true })
  })

  // DELETE /playlists/:id/collaborators/:userId — retirer un collaborateur (propriétaire uniquement)
  fastify.delete('/playlists/:id/collaborators/:userId', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { playlist, isOwner } = await getAccess(req.params.id, req.user.sub)
    if (!playlist) return reply.code(404).send({ error: 'Playlist introuvable' })
    if (!isOwner) return reply.code(403).send({ error: 'Seul le propriétaire peut retirer un collaborateur' })

    await db('playlist_collaborators')
      .where({ playlist_id: req.params.id, user_id: req.params.userId })
      .delete()
    return { ok: true }
  })
}
