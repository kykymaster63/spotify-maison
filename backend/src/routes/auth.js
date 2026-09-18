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

  // PATCH /auth/me — modifier le profil (nom, email, mot de passe)
  fastify.patch('/auth/me', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          email: { type: 'string', format: 'email' },
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 }
        }
      }
    }
  }, async (req, reply) => {
    const { username, email, currentPassword, newPassword } = req.body
    const user = await db('users').where({ id: req.user.sub }).first()

    const updates = {}

    if (username && username !== user.username) {
      const taken = await db('users').where({ username }).whereNot({ id: user.id }).first()
      if (taken) return reply.code(409).send({ error: "Ce nom d'utilisateur est déjà pris" })
      updates.username = username
    }

    if (email && email !== user.email) {
      const taken = await db('users').where({ email }).whereNot({ id: user.id }).first()
      if (taken) return reply.code(409).send({ error: 'Cet email est déjà utilisé' })
      updates.email = email
    }

    if (newPassword) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password_hash))) {
        return reply.code(401).send({ error: 'Mot de passe actuel incorrect' })
      }
      updates.password_hash = await bcrypt.hash(newPassword, 10)
    }

    if (Object.keys(updates).length === 0) {
      return { id: user.id, username: user.username, email: user.email, avatar_url: user.avatar_url }
    }

    const [updated] = await db('users').where({ id: user.id }).update(updates)
      .returning(['id', 'username', 'email', 'avatar_url'])
    return updated
  })
}
