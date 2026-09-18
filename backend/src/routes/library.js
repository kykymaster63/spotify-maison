import { db } from '../db/knex.js'

const SINGLES_KEY = '__singles__'

export async function libraryRoutes(fastify) {

  // GET /artists — tous les artistes de la bibliothèque, dédupliqués depuis
  // le champ `artist` des tracks.
  fastify.get('/artists', { onRequest: [fastify.authenticate] }, async () => {
    const { rows } = await db.raw(`
      SELECT
        artist AS name,
        COUNT(*)::int AS "trackCount",
        (array_agg(cover_url ORDER BY created_at DESC) FILTER (WHERE cover_url IS NOT NULL))[1] AS "coverUrl"
      FROM tracks
      WHERE status = 'ready' AND artist IS NOT NULL AND trim(artist) <> ''
      GROUP BY artist
      ORDER BY artist ASC
    `)
    return rows
  })

  // GET /artists/:artist/albums — morceaux de cet artiste groupés par album ;
  // ceux sans album (le cas fréquent pour un import YouTube générique) sont
  // regroupés dans un album virtuel "Singles".
  fastify.get('/artists/:artist/albums', { onRequest: [fastify.authenticate] }, async (req) => {
    // Sous-requête pour ne calculer/nommer l'album normalisé qu'une fois :
    // répéter le CASE dans GROUP BY/ORDER BY d'une seule requête fait
    // buter Postgres sur la colonne `album` brute non groupée.
    const { rows } = await db.raw(`
      SELECT
        norm_album AS album,
        COUNT(*)::int AS "trackCount",
        COALESCE(SUM(duration_seconds), 0)::int AS "totalDuration",
        (array_agg(cover_url ORDER BY created_at DESC) FILTER (WHERE cover_url IS NOT NULL))[1] AS "coverUrl"
      FROM (
        SELECT
          duration_seconds, cover_url, created_at,
          CASE WHEN album IS NULL OR trim(album) = '' THEN NULL ELSE album END AS norm_album
        FROM tracks
        WHERE status = 'ready' AND artist = ?
      ) sub
      GROUP BY norm_album
      ORDER BY (norm_album IS NULL) ASC, norm_album ASC
    `, [req.params.artist])
    return rows.map(r => ({ ...r, albumKey: r.album || SINGLES_KEY, isSingles: !r.album }))
  })

  // GET /artists/:artist/albums/:album — morceaux d'un album précis (ou de
  // l'album virtuel "Singles"), dans l'ordre d'ajout.
  fastify.get('/artists/:artist/albums/:album', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const isSingles = req.params.album === SINGLES_KEY

    let query = db('tracks')
      .select(
        'tracks.*',
        db.raw('(favorites.track_id IS NOT NULL) AS is_favorite')
      )
      .leftJoin('favorites', function () {
        this.on('favorites.track_id', 'tracks.id').andOn('favorites.user_id', db.raw('?', [req.user.sub]))
      })
      .where('tracks.status', 'ready')
      .andWhere('tracks.artist', req.params.artist)

    query = isSingles
      ? query.andWhere(b => b.whereNull('tracks.album').orWhereRaw("trim(tracks.album) = ''"))
      : query.andWhere('tracks.album', req.params.album)

    const tracks = await query.orderBy('tracks.created_at', 'asc')
    if (!tracks.length) return reply.code(404).send({ error: 'Album introuvable' })

    return {
      artist: req.params.artist,
      album: isSingles ? null : req.params.album,
      isSingles,
      coverUrl: tracks.find(t => t.cover_url)?.cover_url || null,
      totalDuration: tracks.reduce((sum, t) => sum + (t.duration_seconds || 0), 0),
      tracks
    }
  })

  // GET /albums/recent?limit=8 — derniers albums distincts par date d'ajout
  // (le morceau le plus récent de l'album fait foi).
  fastify.get('/albums/recent', {
    onRequest: [fastify.authenticate],
    schema: { querystring: { type: 'object', properties: { limit: { type: 'integer', default: 8 } } } }
  }, async (req) => {
    const { rows } = await db.raw(`
      SELECT
        artist, album,
        COUNT(*)::int AS "trackCount",
        MAX(created_at) AS "addedAt",
        (array_agg(cover_url ORDER BY created_at DESC) FILTER (WHERE cover_url IS NOT NULL))[1] AS "coverUrl"
      FROM tracks
      WHERE status = 'ready' AND album IS NOT NULL AND trim(album) <> '' AND artist IS NOT NULL
      GROUP BY artist, album
      ORDER BY "addedAt" DESC
      LIMIT ?
    `, [req.query.limit || 8])
    return rows
  })

  // GET /artists/trending?days=30&limit=6 — artistes les plus écoutés
  // (tous utilisateurs confondus) sur la période récente.
  fastify.get('/artists/trending', {
    onRequest: [fastify.authenticate],
    schema: { querystring: { type: 'object', properties: { days: { type: 'integer', default: 30 }, limit: { type: 'integer', default: 6 } } } }
  }, async (req) => {
    const since = new Date(Date.now() - (req.query.days || 30) * 86400000)
    const { rows } = await db.raw(`
      SELECT
        t.artist AS name,
        COUNT(*)::int AS "playCount",
        (array_agg(t.cover_url ORDER BY h.listened_at DESC) FILTER (WHERE t.cover_url IS NOT NULL))[1] AS "coverUrl"
      FROM listening_history h
      JOIN tracks t ON t.id = h.track_id
      WHERE h.listened_at > ? AND t.artist IS NOT NULL AND trim(t.artist) <> ''
      GROUP BY t.artist
      ORDER BY "playCount" DESC
      LIMIT ?
    `, [since, req.query.limit || 6])
    return rows
  })
}
