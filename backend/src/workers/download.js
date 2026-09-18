import { createDownloadWorker } from '../services/queue.js'
import { downloadAudio } from '../services/importer.js'
import { uploadFile } from '../services/storage.js'
import { getDuration, detectSilenceTrim } from '../services/audioAnalysis.js'
import { db } from '../db/knex.js'
import { randomUUID } from 'crypto'
import { unlink } from 'fs/promises'

console.log('🔄 Worker de téléchargement démarré')

createDownloadWorker(async (job) => {
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
})
