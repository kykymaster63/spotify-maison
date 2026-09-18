import { getMediaInfo, searchMedia, streamPreview } from '../services/importer.js'

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
}
