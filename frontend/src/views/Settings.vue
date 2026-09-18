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

    <!-- Diagnostic (temporaire, pour déboguer l'affichage sur iPhone) -->
    <section class="section glass-card diag">
      <p class="section-title">Diagnostic affichage</p>
      <div class="diag-row"><span>Mode plein écran (standalone)</span><strong :class="diag.standalone ? 'ok' : 'bad'">{{ diag.standalone ? 'Oui' : 'Non' }}</strong></div>
      <div class="diag-row"><span>Zone sûre en haut</span><strong>{{ diag.safeTop }}</strong></div>
      <div class="diag-row"><span>Zone sûre en bas</span><strong>{{ diag.safeBottom }}</strong></div>
      <div class="diag-row"><span>window.innerHeight</span><strong>{{ diag.innerHeight }}</strong></div>
      <div class="diag-row"><span>visualViewport.height</span><strong>{{ diag.visualViewport }}</strong></div>
      <div class="diag-row"><span>screen.height</span><strong>{{ diag.screenHeight }}</strong></div>
      <div class="diag-row"><span>100dvh (rendu réel CSS)</span><strong>{{ diag.dvhRendered }}</strong></div>
      <div class="diag-row"><span>100vh (rendu réel CSS)</span><strong>{{ diag.vhRendered }}</strong></div>
      <div class="diag-row wrap"><span>Écart bas navbar / fenêtre</span><strong>{{ diag.navBottomGap }}</strong></div>
      <p class="eq-hint">Envoie une capture de ce bloc si le souci de barre persiste — ça permet de trancher sans deviner.</p>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'
import { usePlayerStore, EQ_BANDS } from '../stores/player.js'
import { useAuthStore } from '../stores/auth.js'
import { useToastStore } from '../stores/toast.js'

const player = usePlayerStore()
const auth = useAuthStore()
const toast = useToastStore()

const profile = reactive({ username: '', email: '', currentPassword: '', newPassword: '' })
const showPwd = ref(false)
const savingProfile = ref(false)
const profileMsg = ref(null)

function fmtFreq(f) {
  return f >= 1000 ? `${f / 1000}kHz` : `${f}Hz`
}

const diag = reactive({
  standalone: false, safeTop: '?', safeBottom: '?', innerHeight: '?', visualViewport: '?', screenHeight: '?',
  dvhRendered: '?', vhRendered: '?', navBottomGap: '?'
})
function readDiagnostics() {
  diag.standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

  // Les variables CSS ne résolvent pas env()/calc() quand on les lit
  // directement : on mesure via un élément-sonde dont le padding, lui,
  // est bien calculé en pixels réels par le navigateur.
  const probe = document.createElement('div')
  probe.style.position = 'fixed'
  probe.style.top = '0'
  probe.style.paddingTop = 'env(safe-area-inset-top, 0px)'
  probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  diag.safeTop = style.paddingTop
  diag.safeBottom = style.paddingBottom
  document.body.removeChild(probe)

  diag.innerHeight = `${window.innerHeight}px`
  diag.visualViewport = window.visualViewport ? `${Math.round(window.visualViewport.height)}px` : 'non supporté'
  diag.screenHeight = `${window.screen.height}px`

  // window.innerHeight n'est pas garanti d'être ce que 100dvh/100vh calcule
  // réellement en CSS sur WebKit -> on mesure directement le rendu.
  const dvhProbe = document.createElement('div')
  dvhProbe.style.position = 'fixed'
  dvhProbe.style.top = '0'
  dvhProbe.style.height = '100dvh'
  dvhProbe.style.visibility = 'hidden'
  document.body.appendChild(dvhProbe)
  diag.dvhRendered = `${Math.round(dvhProbe.getBoundingClientRect().height)}px`
  document.body.removeChild(dvhProbe)

  const vhProbe = document.createElement('div')
  vhProbe.style.position = 'fixed'
  vhProbe.style.top = '0'
  vhProbe.style.height = '100vh'
  vhProbe.style.visibility = 'hidden'
  document.body.appendChild(vhProbe)
  diag.vhRendered = `${Math.round(vhProbe.getBoundingClientRect().height)}px`
  document.body.removeChild(vhProbe)

  // Où le bas de la navbar réelle tombe-t-il par rapport au bas de l'écran ?
  const nav = document.querySelector('.navbar')
  if (nav) {
    const rect = nav.getBoundingClientRect()
    diag.navBottomGap = `${Math.round(window.innerHeight - rect.bottom)}px (bas de la navbar à ${Math.round(rect.bottom)}px, fenêtre à ${window.innerHeight}px)`
  } else {
    diag.navBottomGap = 'navbar introuvable (recharge la page sur Accueil/Bibliothèque puis reviens ici)'
  }
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

onMounted(() => { loadProfile(); readDiagnostics() })
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

/* Diagnostic */
.diag-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; }
.diag-row span { color: var(--text-2); flex-shrink: 0; }
.diag-row strong { font-variant-numeric: tabular-nums; text-align: right; }
.diag-row strong.ok { color: var(--accent-2); }
.diag-row strong.bad { color: #f87171; }
.diag-row.wrap { flex-direction: column; align-items: flex-start; gap: 2px; }
.diag-row.wrap strong { text-align: left; font-size: 12px; color: var(--text-2); font-weight: 500; }
</style>
