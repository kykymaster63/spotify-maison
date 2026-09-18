import { getMediaInfo, searchMedia, streamPreview } from '../services/importer.js'
import { extractSpotifyPlaylistId, getPlaylistInfo } from '../services/spotify.js'
import { downloadQueue } from '../services/queue.js'
import { db } from '../db/knex.js'

export async function importRoutes(fastify) {

  // GET /import/search?q=...&source=youtube|soundcloud — recherche multi-résultats
  fastify.get('/import/search', {
    onRequest: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 1 },
          source: { type: 'string', enum: ['youtube', 'soundcloud'], default: 'youtube' }
        }
      }
    }
  }, async (req, reply) => {
    try {
      return await searchMedia(req.query.q, req.query.source || 'youtube')
    } catch (err) {
      req.log.error(err)
      return reply.code(502).send({ error: 'Recherche impossible' })
    }
  })

  // GET /import/preview?url=... — métadonnées sans télécharger (source auto-détectée)
  fastify.get('/import/preview', {
    onRequest: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        required: ['url'],
        properties: { url: { type: 'string' } }
      }
    }
  }, async (req, reply) => {
    try {
      const info = await getMediaInfo(req.query.url)
      return {
        title: info.title,
        artist: info.uploader || info.channel,
        duration: info.duration,
        thumbnail: info.thumbnail,
        url: req.query.url
      }
    } catch (err) {
      req.log.error(err)
      return reply.code(422).send({ error: 'Impossible de récupérer ce morceau' })
    }
  })

  // GET /import/preview-audio?url=...&token=... — écoute avant ajout, rien n'est stocké
  fastify.get('/import/preview-audio', {
    onRequest: [fastify.authenticateStream],
    schema: {
      querystring: {
        type: 'object',
        required: ['url'],
        properties: { url: { type: 'string' } }
      }
    }
  }, async (req, reply) => {
    const child = streamPreview(req.query.url)

    reply.header('Content-Type', 'audio/mp4')
    reply.header('Cache-Control', 'no-store')

    req.raw.on('close', () => { if (!child.killed) child.kill('SIGKILL') })
    child.on('error', () => { if (!reply.sent) reply.code(502).send({ error: 'Prévisualisation impossible' }) })

    return reply.send(child.stdout)
  })

  // POST /import/spotify-playlist — recrée une playlist Spotify publique dans
  // Hostify : crée la playlist tout de suite, puis cherche/télécharge chaque
  // piste sur YouTube en tâche de fond (peut prendre du temps sur une grosse
  // playlist).
  fastify.post('/import/spotify-playlist', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['url'],
        properties: { url: { type: 'string' } }
      }
    }
  }, async (req, reply) => {
    const spotifyPlaylistId = extractSpotifyPlaylistId(req.body.url)
    if (!spotifyPlaylistId) return reply.code(400).send({ error: 'Lien de playlist Spotify invalide' })

    let info
    try {
      info = await getPlaylistInfo(spotifyPlaylistId)
    } catch (err) {
      return reply.code(400).send({ error: err.message })
    }

    const [playlist] = await db('playlists').insert({
      name: info.name,
      description: info.description || null,
      is_public: false,
      owner_id: req.user.sub
    }).returning('*')

    await downloadQueue.add('import-spotify-playlist', {
      spotifyPlaylistId,
      hostifyPlaylistId: playlist.id,
      userId: req.user.sub
    })

    return reply.code(202).send({ ...playlist, message: 'Import en cours — les morceaux vont apparaître au fil du téléchargement.' })
  })
}
