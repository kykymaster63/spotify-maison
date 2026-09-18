import { config } from '../config.js'

// Client Credentials flow : suffisant pour lire des playlists publiques,
// pas besoin qu'un utilisateur se connecte avec son compte Spotify.
let cachedToken = null
let tokenExpiresAt = 0

async function getAccessToken() {
  if (!config.spotify.clientId || !config.spotify.clientSecret) {
    throw new Error('Import Spotify non configuré (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET manquants)')
  }
  if (cachedToken && Date.now() < tokenExpiresAt - 5000) return cachedToken

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  })
  if (!res.ok) throw new Error('Authentification Spotify refusée — vérifie les identifiants')
  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + data.expires_in * 1000
  return cachedToken
}

export function extractSpotifyPlaylistId(url) {
  const m = url.match(/playlist[/:]([a-zA-Z0-9]+)/)
  return m ? m[1] : null
}

export async function getPlaylistInfo(playlistId) {
  const token = await getAccessToken()
  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name,description,images`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Playlist Spotify introuvable ou privée')
  return res.json()
}

// Toutes les pistes de la playlist (paginée par 100 côté Spotify).
export async function getPlaylistTracks(playlistId) {
  const token = await getAccessToken()
  const tracks = []
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(name,artists(name),duration_ms))`

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('Impossible de récupérer les morceaux de la playlist Spotify')
    const data = await res.json()
    for (const item of data.items) {
      if (item.track) {
        tracks.push({
          title: item.track.name,
          artist: item.track.artists.map(a => a.name).join(', '),
          durationMs: item.track.duration_ms
        })
      }
    }
    url = data.next
  }
  return tracks
}
