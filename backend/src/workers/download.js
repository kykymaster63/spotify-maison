import { createDownloadWorker, downloadQueue } from '../services/queue.js'
import { downloadAudio, searchMedia, extractYoutubeId } from '../services/importer.js'
import { getPlaylistTracks } from '../services/spotify.js'
import { uploadFile } from '../services/storage.js'
import { getDuration, detectSilenceTrim } from '../services/audioAnalysis.js'
import { db } from '../db/knex.js'
import { randomUUID } from 'crypto'
import { unlink } from 'fs/promises'

console.log('🔄 Worker de téléchargement démarré')

async function processDownload(job) {
  const { trackId, url } = job.data
  console.log(`⬇️  Téléchargement en cours : ${url}`)

  // Statut → downloading
  await db('tracks').where({ id: trackId }).update({ status: 'downloading' })

  try {
    const { filePath, size, stream } = await downloadAudio(url)
    const storageKey = `${randomUUID()}.mp3`

    // Mesurée sur le fichier réel (plus fiable que la durée yt-dlp) et
    // détection des blancs début/fin, avant l'upload — pas besoin de
    // retélécharger le fichier après coup pour ça.
    const duration = await getDuration(filePath).catch(() => null)
    const { trimStartMs, trimEndMs } = await detectSilenceTrim(filePath, duration).catch(() => ({ trimStartMs: 0, trimEndMs: null }))

    await uploadFile(`audio/${storageKey}`, stream, size, 'audio/mpeg')

    await db('tracks').where({ id: trackId }).update({
      status: 'ready',
      storage_key: storageKey,
      trim_start_ms: trimStartMs || 0,
      trim_end_ms: trimEndMs,
      ...(duration ? { duration_seconds: Math.round(duration) } : {})
    })

    // Nettoyage fichier temporaire
    await unlink(filePath).catch(() => {})
    console.log(`✅ Track ${trackId} prête`)
  } catch (err) {
    console.error(`❌ Erreur download ${trackId}:`, err.message)
    await db('tracks').where({ id: trackId }).update({ status: 'error' })
    throw err
  }
}

// Recrée une playlist Spotify dans Hostify : pour chaque piste, cherche le
// meilleur résultat YouTube, réutilise un morceau déjà en bibliothèque s'il
// existe (même logique de dédoublonnage que /tracks/import), sinon lance le
// téléchargement. Tourne en tâche de fond car ça peut prendre plusieurs
// minutes sur une grosse playlist (une recherche yt-dlp par piste).
async function processSpotifyPlaylistImport(job) {
  const { spotifyPlaylistId, hostifyPlaylistId, userId } = job.data
  console.log(`🎧 Import playlist Spotify ${spotifyPlaylistId} → playlist ${hostifyPlaylistId}`)

  const spotifyTracks = await getPlaylistTracks(spotifyPlaylistId)

  // Chargé une fois, puis mis à jour localement au fil des insertions pour
  // détecter aussi les doublons internes à la playlist elle-même.
  const existing = await db('tracks')
    .where({ source: 'youtube' })
    .whereIn('status', ['ready', 'pending', 'downloading'])
    .select('id', 'source_url')

  let position = 0, imported = 0, matched = 0, skipped = 0

  for (const t of spotifyTracks) {
    position++
    try {
      const results = await searchMedia(`${t.title} ${t.artist}`, 'youtube', 1)
      const hit = results[0]
      if (!hit) { skipped++; continue }

      const hitId = extractYoutubeId(hit.url)
      const dup = hitId && existing.find(e => e.source_url && extractYoutubeId(e.source_url) === hitId)
      let trackId

      if (dup) {
        trackId = dup.id
        matched++
      } else {
        const [inserted] = await db('tracks').insert({
          title: hit.title,
          artist: hit.artist,
          // L'album vient de Spotify (fiable), pas de la recherche YouTube.
          album: t.album || null,
          duration_seconds: hit.duration ? Math.round(hit.duration) : (t.durationMs ? Math.round(t.durationMs / 1000) : null),
          cover_url: hit.thumbnail,
          source_url: hit.url,
          source: 'youtube',
          status: 'pending',
          uploaded_by: userId
        }).returning('*')
        trackId = inserted.id
        existing.push({ id: inserted.id, source_url: hit.url })

        await downloadQueue.add('download-media', { trackId: inserted.id, url: hit.url, userId })
        imported++
      }

      await db('playlist_tracks')
        .insert({ playlist_id: hostifyPlaylistId, track_id: trackId, position, added_by: userId })
        .onConflict(['playlist_id', 'track_id']).ignore()
    } catch (err) {
      console.error(`⚠️ Import Spotify — échec sur "${t.title}" : ${err.message}`)
      skipped++
    }
  }

  console.log(`✅ Playlist Spotify importée : ${imported} nouveaux, ${matched} déjà en bibliothèque, ${skipped} introuvables/en erreur`)
}

createDownloadWorker(async (job) => {
  if (job.name === 'import-spotify-playlist') return processSpotifyPlaylistImport(job)
  return processDownload(job)
})
