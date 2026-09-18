import { defineStore } from 'pinia'
import { ref } from 'vue'
import { CHANGELOG } from '../data/changelog.js'

const SEEN_KEY = 'spm_changelog_seen'

export const useChangelogStore = defineStore('changelog', () => {
  const seenId = ref(localStorage.getItem(SEEN_KEY))
  const hasUnread = ref(!!CHANGELOG.length && seenId.value !== CHANGELOG[0].id)

  function markSeen() {
    if (!CHANGELOG.length) return
    seenId.value = CHANGELOG[0].id
    hasUnread.value = false
    localStorage.setItem(SEEN_KEY, seenId.value)
  }

  return { entries: CHANGELOG, hasUnread, markSeen }
})
