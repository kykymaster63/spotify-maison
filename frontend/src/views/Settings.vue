<template>
  <div class="settings-page">
    <header class="page-header">
      <h1>Paramètres</h1>
    </header>

    <!-- Profil -->
    <section class="section glass-card">
      <p class="section-title">Profil</p>
      <div class="field">
        <label>Nom d'utilisateur</label>
        <input v-model="profile.username" placeholder="Nom d'utilisateur" />
      </div>
      <div class="field">
        <label>Adresse email</label>
        <input v-model="profile.email" type="email" placeholder="exemple@email.com" />
      </div>

      <button class="link-btn" @click="showPwd = !showPwd">
        {{ showPwd ? 'Annuler le changement de mot de passe' : 'Changer le mot de passe' }}
      </button>

      <template v-if="showPwd">
        <div class="field">
          <label>Mot de passe actuel</label>
          <input v-model="profile.currentPassword" type="password" placeholder="Mot de passe actuel" />
        </div>
        <div class="field">
          <label>Nouveau mot de passe</label>
          <input v-model="profile.newPassword" type="password" placeholder="8 caractères minimum" />
        </div>
      </template>

      <p v-if="profileMsg" class="msg" :class="profileMsg.type">{{ profileMsg.text }}</p>

      <button class="btn btn-primary" style="width:100%" @click="saveProfile" :disabled="savingProfile">
        <span v-if="savingProfile" class="spinner-sm"></span>
        <span v-else>Enregistrer</span>
      </button>
    </section>

    <!-- Égaliseur -->
    <section class="section glass-card">
      <div class="section-head">
        <p class="section-title" style="margin:0">Égaliseur</p>
        <button class="link-btn" @click="player.resetEq()">Réinitialiser</button>
      </div>
      <div class="eq-rows">
        <div v-for="(freq, i) in EQ_BANDS" :key="freq" class="eq-row">
          <span class="eq-label">{{ fmtFreq(freq) }}</span>
          <input
            type="range" min="-12" max="12" step="0.5"
            :value="player.eqGains[i]"
            @input="player.setEqGain(i, +$event.target.value)"
            class="eq-slider"
          />
          <span class="eq-value">{{ player.eqGains[i] > 0 ? '+' : '' }}{{ player.eqGains[i] }}</span>
        </div>
      </div>
      <p class="eq-hint">S'applique en direct, y compris au morceau en cours.</p>
    </section>

    <!-- Lecture -->
    <section class="section glass-card">
      <p class="section-title">Lecture</p>

      <label class="switch-row">
        <div class="switch-text">
          <span>Sauter les silences</span>
          <span class="switch-hint">Ignore les blancs détectés en tout début et toute fin de morceau.</span>
        </div>
        <span class="switch" :class="{ on: player.skipSilence }" @click="player.setSkipSilence(!player.skipSilence)"></span>
      </label>

      <label class="switch-row">
        <div class="switch-text">
          <span>Fondu entre les morceaux</span>
          <span class="switch-hint">Le morceau suivant monte en volume pendant que l'actuel redescend.</span>
        </div>
        <span class="switch" :class="{ on: player.crossfadeEnabled }" @click="player.setCrossfadeEnabled(!player.crossfadeEnabled)"></span>
      </label>

      <div v-if="player.crossfadeEnabled" class="fade-options">
        <button
          v-for="s in CROSSFADE_OPTIONS" :key="s"
          class="fade-opt" :class="{ active: player.crossfadeSeconds === s }"
          @click="player.setCrossfadeSeconds(s)"
        >{{ s }}s</button>
      </div>
    </section>

    <!-- Thème -->
    <section class="section glass-card">
      <p class="section-title">Thème</p>
      <div class="theme-grid">
        <button
          v-for="t in theme.themes" :key="t.id"
          class="theme-swatch" :class="{ active: theme.current === t.id }"
          @click="theme.apply(t.id)"
        >
          <span class="swatch-dot" :style="{ background: t.swatch }"></span>
          {{ t.name }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'
import { usePlayerStore, EQ_BANDS, CROSSFADE_OPTIONS } from '../stores/player.js'
import { useAuthStore } from '../stores/auth.js'
import { useToastStore } from '../stores/toast.js'
import { useThemeStore } from '../stores/theme.js'

const player = usePlayerStore()
const auth = useAuthStore()
const toast = useToastStore()
const theme = useThemeStore()

const profile = reactive({ username: '', email: '', currentPassword: '', newPassword: '' })
const showPwd = ref(false)
const savingProfile = ref(false)
const profileMsg = ref(null)

function fmtFreq(f) {
  return f >= 1000 ? `${f / 1000}kHz` : `${f}Hz`
}

async function loadProfile() {
  const { data } = await axios.get('/api/auth/me')
  profile.username = data.username
  profile.email = data.email
}

async function saveProfile() {
  savingProfile.value = true
  profileMsg.value = null
  try {
    const body = { username: profile.username, email: profile.email }
    if (showPwd.value && profile.newPassword) {
      body.currentPassword = profile.currentPassword
      body.newPassword = profile.newPassword
    }
    const { data } = await axios.patch('/api/auth/me', body)
    auth.user = { ...auth.user, ...data }
    localStorage.setItem('user', JSON.stringify(auth.user))
    profile.currentPassword = ''
    profile.newPassword = ''
    showPwd.value = false
    profileMsg.value = { type: 'success', text: 'Profil mis à jour.' }
    toast.success('Profil mis à jour')
  } catch (e) {
    profileMsg.value = { type: 'error', text: e.response?.data?.error || 'Erreur lors de la mise à jour' }
  } finally {
    savingProfile.value = false
  }
}

onMounted(loadProfile)
</script>

<style scoped>
.settings-page { padding: 24px 20px; max-width: 560px; margin: 0 auto; }
.page-header { margin-bottom: 24px; }
h1 { font-size: 24px; font-weight: 800; }

.section { padding: 20px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 14px; }
.section-head { display: flex; align-items: center; justify-content: space-between; }

.field { display: flex; flex-direction: column; gap: 6px; }
label { font-size: 12px; font-weight: 600; color: var(--text-2); }

.link-btn {
  background: none; border: none; color: var(--accent); cursor: pointer;
  font-size: 12px; font-weight: 600; font-family: inherit; text-align: left; padding: 0;
}
.link-btn:hover { opacity: .8; }

.msg { font-size: 12px; padding: 8px 12px; border-radius: var(--r-sm); }
.msg.success { background: rgba(6,214,199,.1); color: var(--accent-2); }
.msg.error { background: rgba(248,113,113,.1); color: #f87171; }

.spinner-sm {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3);
  border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Égaliseur */
.eq-rows { display: flex; flex-direction: column; gap: 12px; }
.eq-row { display: grid; grid-template-columns: 48px 1fr 40px; align-items: center; gap: 12px; }
.eq-label { font-size: 12px; color: var(--text-2); font-variant-numeric: tabular-nums; }
.eq-value { font-size: 12px; color: var(--text-3); text-align: right; font-variant-numeric: tabular-nums; }
.eq-slider {
  width: 100%; height: 4px; appearance: none; background: rgba(255,255,255,0.12);
  border-radius: 2px; cursor: pointer; outline: none; padding: 0; border: none;
}
.eq-slider::-webkit-slider-thumb {
  appearance: none; width: 15px; height: 15px; border-radius: 50%;
  background: var(--gradient); cursor: pointer;
}
.eq-hint { font-size: 11px; color: var(--text-3); }

/* Lecture */
.switch-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; cursor: pointer; }
.switch-text { display: flex; flex-direction: column; gap: 3px; }
.switch-text span:first-child { font-size: 13px; font-weight: 600; }
.switch-hint { font-size: 11px; color: var(--text-3); line-height: 1.4; }
.switch {
  position: relative; flex-shrink: 0;
  width: 44px; height: 26px; border-radius: 50px;
  background: var(--glass-hover); border: 1px solid var(--border);
  transition: background .2s;
}
.switch::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--text-2); transition: transform .2s, background .2s;
}
.switch.on { background: var(--gradient); border-color: transparent; }
.switch.on::after { transform: translateX(18px); background: #fff; }

.fade-options { display: flex; gap: 8px; }
.fade-opt {
  flex: 1; padding: 9px 0; border-radius: var(--r-sm);
  background: var(--glass); border: 1px solid var(--border);
  color: var(--text-2); font-size: 13px; font-weight: 600; font-family: inherit;
  cursor: pointer; transition: border-color .15s, color .15s;
}
.fade-opt:hover { color: var(--text); }
.fade-opt.active { border-color: var(--accent); color: var(--text); background: var(--glass-hover); }

/* Thème */
.theme-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.theme-swatch {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; border-radius: var(--r-sm);
  background: var(--glass); border: 1px solid var(--border);
  color: var(--text-2); font-size: 13px; font-weight: 600; font-family: inherit;
  cursor: pointer; transition: border-color .15s, color .15s;
}
.theme-swatch:hover { color: var(--text); }
.theme-swatch.active { border-color: var(--accent); color: var(--text); }
.swatch-dot { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; }
</style>
