<template>
  <header class="topbar">
    <router-link to="/" class="brand">
      <span class="brand-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="11" r="6.2" stroke="white" stroke-width="1.8"/>
          <path d="M10.1 8.2v5.6l5-2.8z" fill="white"/>
        </svg>
      </span>
      <span class="brand-text">Spotify Maison</span>
    </router-link>

    <button class="logout-btn" @click="logout" title="Se déconnecter">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
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
  height: calc(var(--topbar-height) + env(safe-area-inset-top, 0px));
  padding-top: env(safe-area-inset-top, 0px);
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

.logout-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%;
  background: none; border: none; color: var(--text-2); cursor: pointer;
  transition: color .15s, background .15s;
}
.logout-btn:hover { color: var(--text); background: var(--glass); }
</style>
