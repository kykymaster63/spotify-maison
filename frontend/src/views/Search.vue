<template>
  <div class="search-page">
    <header class="page-header">
      <h1>Recherche</h1>
    </header>

    <div class="search-bar glass-card">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="search-icon">
        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6"/>
        <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <input v-model="query" @input="search" placeholder="Titre, artiste, album..." class="search-input" autofocus />
      <button v-if="query" @click="query = ''; results = []" class="clear-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div v-if="!query" class="empty-search">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" opacity=".2">
        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.2"/>
        <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <p>Tape quelque chose pour chercher</p>
    </div>

    <div v-else-if="results.length === 0 && query" class="empty-search">
      <p>Aucun résultat pour "{{ query }}"</p>
    </div>

    <TrackList v-else :tracks="results" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
import TrackList from '../components/TrackList.vue'

const query = ref('')
const results = ref([])
let timer

function search() {
  clearTimeout(timer)
  if (!query.value.trim()) { results.value = []; return }
  timer = setTimeout(async () => {
    const { data } = await axios.get('/api/tracks', { params: { search: query.value } })
    results.value = data
  }, 280)
}
</script>

<style scoped>
.search-page { padding: 24px 20px; max-width: 860px; margin: 0 auto; }
.page-header { margin-bottom: 24px; }
h1 { font-size: 24px; font-weight: 800; }

.search-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px; margin-bottom: 24px;
}
.search-icon { color: var(--text-3); flex-shrink: 0; }
.search-input {
  border: none; background: none; padding: 0; flex: 1;
  font-size: 16px; outline: none; box-shadow: none;
}
.search-input:focus { border: none; box-shadow: none; }
.clear-btn {
  background: none; border: none; color: var(--text-3); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 50%; transition: color .15s;
}
.clear-btn:hover { color: var(--text); }

.empty-search {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 60px 0; color: var(--text-3); font-size: 14px;
}
</style>
