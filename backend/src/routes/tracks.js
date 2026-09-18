import { db } from '../db/knex.js'
import { uploadFile, getSignedUrl, getStream, getStat, getPartialStream, deleteFile } from '../services/storage.js'
import { getMediaInfo, detectSource } from '../services/importer.js'
import { downloadQueue } from '../services/queue.js'
import { randomUUID } from 'crypto'

export async function tracksRoutes(fastify) {

  // GET /tracks — liste des tracks
  fastify.get('/tracks', { onRequest: [fastify.authenticate] }, async (req) => {
    const { search, limit = 50, offset = 0 } = req.query
    let query = db('tracks')
      .select(
        'tracks.*',
        'users.username as uploader',
        db.raw('(favorites.track_id is not null) as is_favorite')
      )
      .leftJoin('users', 'tracks.uploaded_by', 'users.id')
      .leftJoin('favorites', function () {
        this.on('favorites.track_id', 'tracks.id').andOn('favorites.user_id', db.raw('?', [req.user.sub]))
      })
      .where('tracks.status', 'ready')
      .orderBy('tracks.created_at', 'desc')
      .limit(limit)
      .offset(offset)

    if (search) {
      query = query.where(b => b
        .whereILike('tracks.title', `%${search}%`)
        .orWhereILike('tracks.artist', `%${search}%`)
      )
    }
    return query
  })

  // GET /tracks/pending — mes imports en cours (pending/downloading/error)
  fastify.get('/tracks/pending', { onRequest: [fastify.authenticate] }, async (req) => {
    return db('tracks')
      .where({ uploaded_by: req.user.sub })
      .whereIn('status', ['pending', 'downloading', 'error'])
      .orderBy('created_at', 'desc')
  })

  // GET /tracks/:id — détail d'une track
  fastify.get('/tracks/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const track = await db('tracks').where({ id: req.params.id }).first()
    if (!track) return reply.code(404).send({ error: 'Track introuvable' })
    const fav = await db('favorites').where({ user_id: req.user.sub, track_id: track.id }).first()
    track.is_favorite = !!fav
    if (track.storage_key) {
      track.stream_url = await getSignedUrl(`audio/${track.storage_key}`)
    }
    return track
  })

  // DELETE /tracks/:id — supprimer un morceau (uploadeur uniquement)
  fastify.delete('/tracks/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const track = await db('tracks').where({ id: req.params.id }).first()
    if (!track) return reply.code(404).send({ error: 'Track introuvable' })
    if (track.uploaded_by !== req.user.sub) {
      return reply.code(403).send({ error: "Tu ne peux supprimer que tes propres morceaux" })
    }

    if (track.storage_key) {
      await deleteFile(`audio/${track.storage_key}`).catch(() => {})
    }
    await db('tracks').where({ id: track.id }).delete()
    return { ok: true }
  })

  // GET /tracks/:id/stream — stream audio (accepte ?token= pour les balises <audio>)
  fastify.get('/tracks/:id/stream', { onRequest: [fastify.authenticateStream] }, async (req, reply) => {
    const track = await db('tracks').where({ id: req.params.id, status: 'ready' }).first()
    if (!track) return reply.code(404).send({ error: 'Track introuvable' })

    const key = `audio/${track.storage_key}`
    const stat = await getStat(key)
    const range = req.headers.range

    if (range) {
      const [startStr, endStr] = range.replace('bytes=', '').split('-')
      const start = parseInt(startStr)
      const end = endStr ? parseInt(endStr) : stat.size - 1
      const chunkSize = end - start + 1

      reply
        .code(206)
        .header('Content-Range', `bytes ${start}-${end}/${stat.size}`)
        .header('Accept-Ranges', 'bytes')
        .header('Content-Length', chunkSize)
        .header('Content-Type', 'audio/mpeg')

      const stream = await getPartialStream(key, start, chunkSize)
      return reply.send(stream)
    }

    reply
      .header('Content-Length', stat.size)
      .header('Content-Type', 'audio/mpeg')
      .header('Accept-Ranges', 'bytes')

    const stream = await getStream(key)
    return reply.send(stream)
  })

  // POST /tracks/:id/favorite — ajouter aux favoris
  fastify.post('/tracks/:id/favorite', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    await db('favorites')
      .insert({ user_id: req.user.sub, track_id: req.params.id })
      .onConflict(['user_id', 'track_id']).ignore()
    return reply.code(201).send({ ok: true })
  })

  // DELETE /tracks/:id/favorite — retirer des favoris
  fastify.delete('/tracks/:id/favorite', { onRequest: [fastify.authenticate] }, async (req) => {
    await db('favorites').where({ user_id: req.user.sub, track_id: req.params.id }).delete()
    return { ok: true }
  })

  // GET /favorites — mes morceaux likés
  fastify.get('/favorites', { onRequest: [fastify.authenticate] }, async (req) => {
    return db('favorites')
      .join('tracks', 'favorites.track_id', 'tracks.id')
      .where('favorites.user_id', req.user.sub)
      .andWhere('tracks.status', 'ready')
      .select('tracks.*', db.raw('true as is_favorite'))
      .orderBy('favorites.created_at', 'desc')
  })

  // POST /tracks/upload — upload fichier MP3/FLAC
  fastify.post('/tracks/upload', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'Aucun fichier reçu' })

    const storageKey = `${randomUUID()}.mp3`
    await uploadFile(`audio/${storageKey}`, data.file, null, data.mimetype)

    const [track] = await db('tracks').insert({
      title: data.filename.replace(/\.[^.]+$/, ''),
      storage_key: storageKey,
      source: 'upload',
      status: 'ready',
      uploaded_by: req.user.sub
    }).returning('*')

    return reply.code(201).send(track)
  })

  // POST /tracks/import — ajouter depuis YouTube, SoundCloud, ... (auto-détecté)
  fastify.post('/tracks/import', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['url'],
        properties: { url: { type: 'string' } }
      }
    }
  }, async (req, reply) => {
    const { url } = req.body
    const source = detectSource(url)

    // Récupère les métadonnées sans télécharger
    const info = await getMediaInfo(url)

    // Crée la track en statut "pending"
    const [track] = await db('tracks').insert({
      title: info.title,
      artist: info.uploader || info.channel,
      // SoundCloud renvoie une durée en secondes avec décimales (ex. 7200.255)
      duration_seconds: info.duration ? Math.round(info.duration) : null,
      cover_url: info.thumbnail,
      source_url: url,
      source,
      status: 'pending',
      uploaded_by: req.user.sub
    }).returning('*')

    // Ajoute le téléchargement en file d'attente
    await downloadQueue.add('download-media', {
      trackId: track.id,
      url,
      userId: req.user.sub
    })

    return reply.code(202).send({ ...track, message: 'Téléchargement en cours...' })
  })
}
