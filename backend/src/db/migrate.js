import { db } from './knex.js'

// createTableIfNotExists ne suffit pas : les contraintes (unique, etc.) sont
// générées dans une requête séparée qui, elle, s'exécute même si la table
// existait déjà -> on vérifie explicitement avant de créer chaque table.
async function ensureTable(name, builder) {
  const exists = await db.schema.hasTable(name)
  if (!exists) {
    await db.schema.createTable(name, builder)
    console.log(`  + table "${name}" créée`)
  }
}

async function migrate() {
  // ─── Users ────────────────────────────────────────────────────────
  await ensureTable('users', t => {
    t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'))
    t.string('username', 50).notNullable().unique()
    t.string('email', 255).notNullable().unique()
    t.string('password_hash').notNullable()
    t.string('avatar_url')
    t.timestamps(true, true)
  })

  // ─── Tracks ───────────────────────────────────────────────────────
  await ensureTable('tracks', t => {
    t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'))
    t.string('title').notNullable()
    t.string('artist')
    t.string('album')
    t.integer('duration_seconds')
    t.string('cover_url')
    t.string('storage_key')        // clé MinIO/R2
    t.string('source_url')         // URL YouTube originale
    t.enum('source', ['upload', 'youtube', 'soundcloud']).defaultTo('upload')
    t.enum('status', ['pending', 'downloading', 'ready', 'error']).defaultTo('ready')
    t.uuid('uploaded_by').references('id').inTable('users').onDelete('SET NULL')
    t.timestamps(true, true)
  })

  // ─── Playlists ────────────────────────────────────────────────────
  await ensureTable('playlists', t => {
    t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'))
    t.string('name').notNullable()
    t.text('description')
    t.string('cover_url')
    t.boolean('is_public').defaultTo(false)
    t.uuid('owner_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.timestamps(true, true)
  })

  // ─── Playlist <-> Tracks (table pivot) ────────────────────────────
  await ensureTable('playlist_tracks', t => {
    t.uuid('playlist_id').references('id').inTable('playlists').onDelete('CASCADE')
    t.uuid('track_id').references('id').inTable('tracks').onDelete('CASCADE')
    t.integer('position').defaultTo(0)
    t.timestamp('added_at').defaultTo(db.fn.now())
    t.primary(['playlist_id', 'track_id'])
  })

  // ─── Collaborateurs de playlist ───────────────────────────────────
  await ensureTable('playlist_collaborators', t => {
    t.uuid('playlist_id').references('id').inTable('playlists').onDelete('CASCADE')
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE')
    t.enum('role', ['viewer', 'editor']).defaultTo('editor')
    t.primary(['playlist_id', 'user_id'])
  })

  // ─── Amis ─────────────────────────────────────────────────────────
  await ensureTable('friendships', t => {
    t.uuid('requester_id').references('id').inTable('users').onDelete('CASCADE')
    t.uuid('addressee_id').references('id').inTable('users').onDelete('CASCADE')
    t.enum('status', ['pending', 'accepted']).defaultTo('pending')
    t.timestamp('created_at').defaultTo(db.fn.now())
    t.primary(['requester_id', 'addressee_id'])
  })

  // ─── Historique d'écoute ──────────────────────────────────────────
  await ensureTable('listening_history', t => {
    t.increments('id')
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE')
    t.uuid('track_id').references('id').inTable('tracks').onDelete('CASCADE')
    t.timestamp('listened_at').defaultTo(db.fn.now())
  })

  // ─── Favoris ──────────────────────────────────────────────────────
  await ensureTable('favorites', t => {
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE')
    t.uuid('track_id').references('id').inTable('tracks').onDelete('CASCADE')
    t.timestamp('created_at').defaultTo(db.fn.now())
    t.primary(['user_id', 'track_id'])
  })

  console.log('✅ Migrations terminées')
  await db.destroy()
}

migrate().catch(err => {
  console.error('❌ Migration échouée :', err)
  process.exit(1)
})
