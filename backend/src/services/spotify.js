// Spotify exige désormais un compte Premium pour créer une appli développeur
// et obtenir des clés d'API — inutilisable pour un simple import perso entre
// amis. À la place, on lit directement la page d'embed publique d'une
// playlist (open.spotify.com/embed/playlist/...) : elle contient déjà toutes
// les données nécessaires (titre, morceaux, artistes, durées) dans un bloc
// JSON intégré à la page, sans aucune authentification.
//
// C'est non officiel/non documenté — ça pourrait casser si Spotify change la
// structure de cette page — mais ça fonctionne aujourd'hui et ne demande ni
// clé ni abonnement à qui que ce soit.
const EMBED_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
}

export function extractSpotifyPlaylistId(url) {
  const m = url.match(/playlist[/:]([a-zA-Z0-9]+)/)
  return m ? m[1] : null
}

async function fetchEmbedEntity(playlistId) {
  const res = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, { headers: EMBED_HEADERS })
  if (!res.ok) throw new Error('Playlist Spotify introuvable ou privée')

  const html = await res.text()
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)
  if (!m) throw new Error('Impossible de lire les données de la playlist Spotify')

  let data
  try {
    data = JSON.parse(m[1])
  } catch {
    throw new Error('Impossible de lire les données de la playlist Spotify')
  }

  const entity = data?.props?.pageProps?.state?.data?.entity
  if (!entity || entity.type !== 'playlist') throw new Error('Playlist Spotify introuvable ou privée')
  return entity
}

export async function getPlaylistInfo(playlistId) {
  const entity = await fetchEmbedEntity(playlistId)
  return { name: entity.name, description: null }
}

// Limité aux 50 premiers morceaux : c'est tout ce que la page d'embed
// publique expose (pas de pagination visible, contrairement à l'API
// officielle) — accepté comme compromis pour n'exiger ni clé ni Premium.
export async function getPlaylistTracks(playlistId) {
  const entity = await fetchEmbedEntity(playlistId)
  return (entity.trackList || []).map(t => ({
    title: t.title,
    artist: t.subtitle,
    album: null,
    durationMs: t.duration
  }))
}
