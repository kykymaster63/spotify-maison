// Le plus récent en premier. `id` doit être stable (jamais renommé une fois
// publié) : c'est lui qui sert à savoir si l'utilisateur a déjà vu une entrée.
export const CHANGELOG = [
  {
    id: 'themes-silence-crossfade',
    title: 'Thèmes, silences et fondu',
    items: [
      '5 nouveaux thèmes (Or, Indigo, Lavande, Graphite, Néon) — 10 au total',
      'Option pour sauter les blancs en début et fin de morceau',
      'Fondu (crossfade) réglable entre deux morceaux'
    ]
  },
  {
    id: 'jam',
    title: 'Jam — écoute synchronisée',
    items: [
      'Lance un Jam et écoute en direct, en synchro, avec tes amis',
      'N\'importe qui peut ajouter des morceaux à la file du Jam',
      'Un ami en Jam affiche un bouton "Rejoindre" sur la page Amis'
    ]
  },
  {
    id: 'favorites-fix',
    title: 'Corrections des favoris',
    items: [
      'Forme du coeur corrigée (elle était mal proportionnée)',
      'Le coeur ne se désynchronise plus entre les listes et le lecteur'
    ]
  },
  {
    id: 'friends-playlists',
    title: 'Amis & playlists partagées',
    items: [
      'Recherche d\'amis, demandes, et "en train d\'écouter" en direct',
      'Invitation de collaborateurs sur une playlist',
      'Raccourcis clavier (compatibles boutons souris/clavier programmables)'
    ]
  }
]
