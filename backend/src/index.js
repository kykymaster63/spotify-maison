import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import { config } from './config.js'
import { db } from './db/knex.js'
import { ensureBucket } from './services/storage.js'
import { authRoutes } from './routes/auth.js'
import { tracksRoutes } from './routes/tracks.js'
import { playlistsRoutes } from './routes/playlists.js'
import { importRoutes } from './routes/import.js'
import { friendsRoutes } from './routes/friends.js'
import { jamRoutes } from './routes/jam.js'
import { libraryRoutes } from './routes/library.js'

const fastify = Fastify({ logger: true })

// ─── Plugins ────────────────────────────────────────────────────────────────
await fastify.register(cors, {
  origin: true,
  credentials: true
})

await fastify.register(jwt, {
  secret: config.jwtSecret
})

await fastify.register(multipart, {
  limits: { fileSize: 200 * 1024 * 1024 } // 200 MB max
})

await fastify.register(websocket)

// ─── Décorateur auth ────────────────────────────────────────────────────────
fastify.decorate('authenticate', async function (req, reply) {
  try {
    await req.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Non authentifié' })
  }
})

// Variante pour les flux (audio/vidéo) : les balises <audio>/<img> ne peuvent
// pas envoyer de header Authorization, donc on accepte aussi ?token=...
fastify.decorate('authenticateStream', async function (req, reply) {
  try {
    const header = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    const token = header || req.query?.token
    if (!token) throw new Error('missing token')
    req.user = fastify.jwt.verify(token)
  } catch {
    reply.code(401).send({ error: 'Non authentifié' })
  }
})

// ─── Routes ─────────────────────────────────────────────────────────────────
await fastify.register(authRoutes, { prefix: '/api' })
await fastify.register(tracksRoutes, { prefix: '/api' })
await fastify.register(playlistsRoutes, { prefix: '/api' })
await fastify.register(importRoutes, { prefix: '/api' })
await fastify.register(friendsRoutes, { prefix: '/api' })
await fastify.register(jamRoutes, { prefix: '/api' })
await fastify.register(libraryRoutes, { prefix: '/api' })

fastify.get('/api/health', async () => ({ status: 'ok', timestamp: new Date() }))

// ─── Démarrage ───────────────────────────────────────────────────────────────
try {
  await ensureBucket()
  // Les Jams vivent en mémoire : après un redémarrage, aucun n'existe plus,
  // donc on nettoie les codes restés affichés côté DB pour ne pas montrer
  // aux amis un Jam "en cours" qui répondrait 404.
  await db('users').whereNotNull('active_jam_code').update({ active_jam_code: null })
  await fastify.listen({ port: config.port, host: '0.0.0.0' })
  console.log(`🎵 Hostify backend running on port ${config.port}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
