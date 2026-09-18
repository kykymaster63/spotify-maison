import bcrypt from 'bcrypt'
import { db } from '../db/knex.js'

export async function authRoutes(fastify) {
  // POST /auth/register
  fastify.post('/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 }
        }
      }
    }
  }, async (req, reply) => {
    const { username, email, password } = req.body

    const exists = await db('users').where({ email }).orWhere({ username }).first()
    if (exists) return reply.code(409).send({ error: 'Nom d\'utilisateur ou email déjà pris' })

    const password_hash = await bcrypt.hash(password, 10)
    const [user] = await db('users').insert({ username, email, password_hash }).returning(['id', 'username', 'email'])

    const token = fastify.jwt.sign({ sub: user.id, username: user.username })
    return { token, user }
  })

  // POST /auth/login
  fastify.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const { email, password } = req.body
    const user = await db('users').where({ email }).first()
    if (!user) return reply.code(401).send({ error: 'Identifiants invalides' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return reply.code(401).send({ error: 'Identifiants invalides' })

    const token = fastify.jwt.sign({ sub: user.id, username: user.username })
    return { token, user: { id: user.id, username: user.username, email: user.email, avatar_url: user.avatar_url } }
  })

  // GET /auth/me
  fastify.get('/auth/me', { onRequest: [fastify.authenticate] }, async (req) => {
    const user = await db('users').where({ id: req.user.sub }).select('id', 'username', 'email', 'avatar_url', 'created_at').first()
    return user
  })
}
