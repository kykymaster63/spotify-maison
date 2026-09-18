<template>
  <nav class="navbar">
    <router-link to="/" class="nav-item" active-class="active" exact>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M9 21V12h6v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <span>Accueil</span>
    </router-link>

    <router-link to="/search" class="nav-item" active-class="active">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6"/>
        <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <span>Recherche</span>
    </router-link>

    <router-link to="/import" class="nav-item" active-class="active">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Import</span>
    </router-link>

    <router-link to="/favorites" class="nav-item" active-class="active">
      <svg width="20" height="20" viewBox="-1 -1 26 26" fill="none">
        <path d="M12 20s-7.5-4.6-9.7-9.1C.7 7.8 2.3 4.5 5.6 4.1c1.9-.2 3.5.7 4.4 2.1.9-1.4 2.5-2.3 4.4-2.1 3.3.4 4.9 3.7 3.3 6.8C19.5 15.4 12 20 12 20z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      </svg>
      <span>Favoris</span>
    </router-link>

    <router-link to="/library" class="nav-item" active-class="active">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
  align-items: center; justify-content: center; gap: 4px;
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
