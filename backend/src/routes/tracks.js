import { db } from '../db/knex.js'
import { uploadFile, getSignedUrl, getStream, getStat, getPartialStream, deleteFile } from '../services/storage.js'
import { getMediaInfo, detectSource, extractYoutubeId } from '../services/importer.js'
import { getDuration, detectSilenceTrim } from '../services/audioAnalysis.js'
import { parseFile } from 'music-metadata'
import { downloadQueue } from '../services/queue.js'
import { randomUUID } from 'crypto'
import { createReadStream, createWriteStream, statSync } from 'fs'
import { unlink } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { join, extname } from 'path'
import os from 'os'

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

    // On passe par un fichier temporaire (plutôt que de streamer le fichier
    // reçu directement vers MinIO) pour pouvoir mesurer sa durée réelle et
    // détecter les blancs début/fin avant l'upload.
    const tmpPath = join(os.tmpdir(), `${randomUUID()}${extname(data.filename) || ''}`)
    await pipeline(data.file, createWriteStream(tmpPath))
    const stat = statSync(tmpPath)

    const storageKey = `${randomUUID()}.mp3`
    await uploadFile(`audio/${storageKey}`, createReadStream(tmpPath), stat.size, data.mimetype)

    const duration = await getDuration(tmpPath).catch(() => null)
    const { trimStartMs, trimEndMs } = await detectSilenceTrim(tmpPath, duration).catch(() => ({ trimStartMs: 0, trimEndMs: null }))

    // Tags ID3/Vorbis (titre, artiste, album) quand le fichier en a — sinon
    // on retombe sur le nom du fichier comme avant. Sans ça, `album` reste
    // toujours vide pour les uploads directs, et la vue Artiste les range
    // tous dans "Singles" même quand le fichier est correctement tagué.
    const tags = await parseFile(tmpPath).catch(() => null)
    const common = tags?.common || {}
    await unlink(tmpPath).catch(() => {})

    const [track] = await db('tracks').insert({
      title: common.title || data.filename.replace(/\.[^.]+$/, ''),
      artist: common.artist || common.artists?.[0] || null,
      album: common.album || null,
      storage_key: storageKey,
      source: 'upload',
      status: 'ready',
      duration_seconds: duration ? Math.round(duration) : null,
      trim_start_ms: trimStartMs || 0,
      trim_end_ms: trimEndMs,
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

    // Détection de doublon : compare par id YouTube extrait (pas juste l'URL
    // brute, qui peut varier avec youtu.be/&list=/&t=... pour la même vidéo)
    // pour ne pas retélécharger un morceau déjà présent ou en cours d'import.
    const existingUrls = await db('tracks')
      .where({ source })
      .whereIn('status', ['ready', 'pending', 'downloading'])
      .pluck('source_url')
    const newId = source === 'youtube' ? extractYoutubeId(url) : null
    const isDuplicate = existingUrls.some(u => u && (newId ? extractYoutubeId(u) === newId : u === url))
    if (isDuplicate) {
      return reply.code(409).send({ error: 'Ce morceau est déjà dans ta bibliothèque (ou en cours d\'import)' })
    }

    // Récupère les métadonnées sans télécharger
    const info = await getMediaInfo(url)

    // Crée la track en statut "pending"
    const [track] = await db('tracks').insert({
      title: info.title,
      artist: info.uploader || info.channel,
      // yt-dlp ne remonte un album que pour le contenu reconnu comme
      // musical (YouTube Music...) — sinon reste vide, ce qui bascule la
      // piste dans le regroupement "Singles" côté vue Artiste.
      album: info.album || null,
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
