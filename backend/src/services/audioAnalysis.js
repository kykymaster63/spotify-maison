import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// Durée exacte du fichier local (plus fiable que les métadonnées yt-dlp,
// qui peuvent être approximatives ou absentes pour un upload direct).
export async function getDuration(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath
  ])
  const seconds = parseFloat(stdout.trim())
  return isFinite(seconds) ? seconds : null
}

// Détecte le blanc en tout début et toute fin de piste via le filtre
// silencedetect de ffmpeg, pour permettre de les sauter à la lecture sans
// jouer/couper le fichier lui-même. On ne touche jamais aux silences internes
// (couplets calmes, transitions...) : seuls les segments qui touchent
// littéralement le tout début ou la toute fin du fichier comptent.
export async function detectSilenceTrim(filePath, durationSeconds) {
  const fallback = { trimStartMs: 0, trimEndMs: null }
  let stderr = ''
  try {
    const result = await execFileAsync('ffmpeg', [
      '-nostats', '-i', filePath,
      '-af', 'silencedetect=noise=-50dB:d=0.3',
      '-f', 'null', '-'
    ], { maxBuffer: 8 * 1024 * 1024 })
    stderr = result.stderr || ''
  } catch (err) {
    // Si ffmpeg sort en erreur, il a tout de même pu écrire les logs voulus.
    stderr = err.stderr || ''
  }
  if (!stderr) return fallback

  const starts = [...stderr.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map(m => parseFloat(m[1]))
  const ends = [...stderr.matchAll(/silence_end:\s*(-?[\d.]+)/g)].map(m => parseFloat(m[1]))
  if (!starts.length) return fallback

  let trimStartMs = 0
  if (starts[0] < 0.2 && ends.length) {
    trimStartMs = Math.round(ends[0] * 1000)
  }

  let trimEndMs = null
  // ffmpeg referme toujours le dernier silence avec un "silence_end" à la
  // fin du fichier, même quand ce silence continue jusqu'à l'EOF (ce n'est
  // donc PAS l'absence de silence_end qui signale le blanc final) : on
  // détecte plutôt le dernier silence dont la fin colle à la durée totale.
  if (ends.length && durationSeconds) {
    const lastEnd = ends[ends.length - 1]
    const lastStart = starts[starts.length - 1]
    if (lastStart > 0 && Math.abs(lastEnd - durationSeconds) < 0.2) {
      trimEndMs = Math.round(lastStart * 1000)
    }
  }

  // Garde-fous : jamais plus de la moitié du morceau, et il doit rester au
  // moins 2 secondes de contenu jouable entre le début et la fin retenus.
  if (durationSeconds) {
    const durationMs = durationSeconds * 1000
    if (trimStartMs > durationMs * 0.5) trimStartMs = 0
    if (trimEndMs !== null && (trimEndMs < durationMs * 0.5 || trimEndMs - trimStartMs < 2000)) trimEndMs = null
  }

  return { trimStartMs, trimEndMs }
}
