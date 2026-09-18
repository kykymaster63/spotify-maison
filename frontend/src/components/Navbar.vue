<template>
  <nav class="navbar">
    <router-link to="/" class="nav-item" active-class="active" exact>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M9 21V12h6v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <span>Accueil</span>
    </router-link>

    <router-link to="/search" class="nav-item" active-class="active">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6"/>
        <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <span>Recherche</span>
    </router-link>

    <router-link to="/import" class="nav-item" active-class="active">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Import</span>
    </router-link>

    <router-link to="/favorites" class="nav-item" active-class="active">
      <svg width="18" height="18" viewBox="-1 -1 26 26" fill="none">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
      </svg>
      <span>Favoris</span>
    </router-link>

    <router-link to="/library" class="nav-item" active-class="active">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
      </svg>
      <span>Bibliothèque</span>
    </router-link>
  </nav>
</template>

<script setup>
</script>

<style scoped>
.navbar {
  position: fixed; bottom: 0; left: 0; right: 0;
  /* La zone de la barre gestuelle (home indicator) empiète sinon sur les icônes */
  height: calc(var(--nav-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  box-sizing: border-box;
  background: rgba(7, 7, 15, 0.92);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid var(--border);
  display: flex; z-index: 101;
}
.nav-item {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 3px;
  text-decoration: none; color: var(--text-3);
  border: none; background: none; cursor: pointer;
  font-family: inherit; font-size: 10px; font-weight: 500;
  letter-spacing: .3px; transition: color .2s;
  position: relative;
}
.nav-item::after {
  content: '';
  position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 0; height: 2px;
  background: var(--gradient);
  border-radius: 2px 2px 0 0;
  transition: width .2s;
}
.nav-item:hover { color: var(--text-2); }
.nav-item.active { color: var(--accent); }
.nav-item.active::after { width: 32px; }
</style>
