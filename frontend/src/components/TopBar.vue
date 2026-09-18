<template>
  <header class="topbar">
    <router-link to="/" class="brand">
      <span class="brand-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="11" r="6.2" stroke="white" stroke-width="1.8"/>
          <path d="M10.1 8.2v5.6l5-2.8z" fill="white"/>
        </svg>
      </span>
      <span class="brand-text">Hostify</span>
    </router-link>

    <div class="actions">
      <router-link to="/friends" class="icon-btn" title="Amis">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.6"/>
          <path d="M2.5 19c0-3 3-5 6.5-5s6.5 2 6.5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          <circle cx="17.5" cy="8.5" r="2.5" stroke="currentColor" stroke-width="1.4"/>
          <path d="M15.8 13.2c2.6.3 4.7 2 4.7 4.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </router-link>
      <router-link to="/settings" class="icon-btn" title="Paramètres">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0A1.65 1.65 0 009.94 3.1V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </router-link>
      <button class="icon-btn" @click="logout" title="Se déconnecter">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup>
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()
function logout() { auth.logout(); router.push('/login') }
</script>

<style scoped>
.topbar {
  position: fixed; top: 0; left: 0; right: 0;
  /* La zone Dynamic Island / encoche empiète sinon sur le logo et le bouton */
  height: calc(var(--topbar-height) + var(--safe-top));
  padding-top: var(--safe-top);
  box-sizing: border-box;
  display: flex; align-items: center; justify-content: space-between;
  padding-left: 18px; padding-right: 18px;
  background: rgba(7, 7, 15, 0.85);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid var(--border);
  z-index: 101;
}
.brand { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--text); }
.brand-icon {
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--logo-gradient);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.brand-text { font-size: 14px; font-weight: 700; letter-spacing: .2px; }

.actions { display: flex; align-items: center; gap: 4px; }
.icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%;
  background: none; border: none; color: var(--text-2); cursor: pointer;
  transition: color .15s, background .15s; text-decoration: none;
}
.icon-btn:hover { color: var(--text); background: var(--glass); }
</style>
