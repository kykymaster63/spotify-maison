import { createDownloadWorker } from '../services/queue.js'
import { downloadAudio } from '../services/importer.js'
import { uploadFile } from '../services/storage.js'
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

    await uploadFile(`audio/${storageKey}`, stream, size, 'audio/mpeg')

    await db('tracks').where({ id: trackId }).update({
      status: 'ready',
      storage_key: storageKey
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
