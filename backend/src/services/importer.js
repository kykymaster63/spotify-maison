import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { createReadStream, statSync } from 'fs'
import { join } from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

// yt-dlp gère nativement YouTube, SoundCloud (et bien d'autres) à partir d'une
// simple URL : la récupération de métadonnées, la prévisualisation et le
// téléchargement n'ont donc pas besoin de connaître la plateforme d'origine.
export async function getMediaInfo(url) {
  const { stdout } = await execFileAsync('yt-dlp', [
    '--dump-json',
    '--no-playlist',
    url
  ])
  return JSON.parse(stdout)
}

const SEARCH_PREFIX = {
  youtube: 'ytsearch',
  soundcloud: 'scsearch'
}

export function detectSource(url) {
  return /soundcloud\.com/i.test(url) ? 'soundcloud' : 'youtube'
}

// Recherche multi-résultats (extraction "à plat" donc rapide), sur la
// plateforme demandée.
export async function searchMedia(query, source = 'youtube', limit = 12) {
  const prefix = SEARCH_PREFIX[source] || SEARCH_PREFIX.youtube
  const { stdout } = await execFileAsync('yt-dlp', [
    `${prefix}${limit}:${query}`,
    '--dump-json',
    '--flat-playlist',
    '--no-warnings'
  ])

  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const v = JSON.parse(line)
      const thumb = Array.isArray(v.thumbnails) && v.thumbnails.length
        ? v.thumbnails[v.thumbnails.length - 1].url
        : v.thumbnail || null
      // YouTube : on reconstruit une URL stable à partir de l'id (plus fiable
      // selon les versions de yt-dlp). SoundCloud : pas de schéma d'URL à
      // partir du seul id, on garde celle fournie par l'extracteur.
      const url = source === 'soundcloud'
        ? (v.url || v.webpage_url)
        : `https://www.youtube.com/watch?v=${v.id}`
      return {
        id: v.id,
        url,
        source,
        title: v.title,
        artist: v.uploader || v.channel || null,
        duration: v.duration || null,
        thumbnail: thumb
      }
    })
    .filter(r => r.url)
}

// Flux audio live pour prévisualisation (pas de stockage disque/MinIO)
export function streamPreview(url) {
  const child = spawn('yt-dlp', [
    '-f', 'bestaudio[ext=m4a]/bestaudio',
    '-o', '-',
    '--no-playlist',
    '--no-warnings',
    '--quiet',
    url
  ], { stdio: ['ignore', 'pipe', 'pipe'] })

  child.stderr.on('data', () => {}) // yt-dlp est bruyant sur stderr, on l'ignore ici

  return child
}

export async function downloadAudio(url) {
  const tmpDir = os.tmpdir()
  const outTemplate = join(tmpDir, '%(id)s.%(ext)s')

  await execFileAsync('yt-dlp', [
    '-x',                        // audio only
    '--audio-format', 'mp3',
    '--audio-quality', '0',      // meilleure qualité
    '-o', outTemplate,
    '--no-playlist',
    url
  ])

  // Récupère le fichier créé
  const { stdout } = await execFileAsync('yt-dlp', [
    '--get-filename',
    '-o', join(tmpDir, '%(id)s.mp3'),
    '--no-playlist',
    url
  ])

  const filePath = stdout.trim()
  const stat = statSync(filePath)

  return {
    filePath,
    size: stat.size,
    stream: createReadStream(filePath)
  }
}
