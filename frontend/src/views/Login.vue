<template>
  <div class="login-page">
    <div class="bg-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
    </div>

    <div class="login-wrap">
      <div class="logo">
        <div class="logo-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="11" r="6.2" stroke="white" stroke-width="1.7"/>
            <path d="M10.1 8.2v5.6l5-2.8z" fill="white"/>
            <g stroke="white" stroke-width="1.7" stroke-linecap="round">
              <path d="M9 20v-1.6"/>
              <path d="M12 20v-2.6"/>
              <path d="M15 20v-1.9"/>
            </g>
          </svg>
        </div>
        <span class="logo-text">Spotify Maison</span>
      </div>

      <div class="login-card glass-card">
        <h1>{{ isRegister ? 'Créer un compte' : 'Bon retour' }}</h1>
        <p class="subtitle">{{ isRegister ? 'Rejoins la communauté.' : 'Ta musique t\'attend.' }}</p>

        <form @submit.prevent="submit" class="form">
          <div v-if="isRegister" class="field">
            <label>Nom d'utilisateur</label>
            <input v-model="form.username" type="text" placeholder="Votre nom d'utilisateur" required autocomplete="username" />
          </div>

          <div class="field">
            <label>Adresse email</label>
            <input v-model="form.email" type="email" placeholder="exemple@email.com" required autocomplete="email" />
          </div>

          <div class="field">
            <label>Mot de passe</label>
            <div class="input-wrap">
              <input
                v-model="form.password"
                :type="showPwd ? 'text' : 'password'"
                placeholder="8 caractères minimum"
                required
                autocomplete="current-password"
              />
              <button type="button" class="eye-btn" @click="showPwd = !showPwd" tabindex="-1">
                <svg v-if="!showPwd" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.6"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
            <!-- Indicateur de force -->
            <div v-if="isRegister && form.password" class="strength-wrap">
              <div class="strength-bars">
                <div class="bar" :class="{ active: strength >= 1, [strengthColor]: strength >= 1 }"></div>
                <div class="bar" :class="{ active: strength >= 2, [strengthColor]: strength >= 2 }"></div>
                <div class="bar" :class="{ active: strength >= 3, [strengthColor]: strength >= 3 }"></div>
                <div class="bar" :class="{ active: strength >= 4, [strengthColor]: strength >= 4 }"></div>
              </div>
              <span class="strength-label" :class="strengthColor">{{ strengthLabel }}</span>
            </div>
          </div>

          <!-- Confirmation mot de passe (inscription seulement) -->
          <div v-if="isRegister" class="field">
            <label>Confirmer le mot de passe</label>
            <div class="input-wrap">
              <input
                v-model="form.confirm"
                :type="showConfirm ? 'text' : 'password'"
                placeholder="Répéter le mot de passe"
                required
                autocomplete="new-password"
              />
              <button type="button" class="eye-btn" @click="showConfirm = !showConfirm" tabindex="-1">
                <svg v-if="!showConfirm" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.6"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
            <p v-if="form.confirm && form.password !== form.confirm" class="field-hint error">
              Les mots de passe ne correspondent pas.
            </p>
            <p v-else-if="form.confirm && form.password === form.confirm" class="field-hint ok">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
              Les mots de passe correspondent.
            </p>
          </div>

          <p v-if="error" class="error-msg">{{ error }}</p>

          <button type="submit" class="btn btn-primary submit-btn" :disabled="loading || !canSubmit">
            <span v-if="loading" class="spinner"></span>
            <span v-else>{{ isRegister ? 'Créer le compte' : 'Se connecter' }}</span>
          </button>
        </form>

        <div class="divider"><span>ou</span></div>

        <button class="toggle-btn" @click="reset">
          {{ isRegister ? 'Déjà un compte ? Se connecter' : 'Pas encore de compte ? S\'inscrire' }}
        </button>
      </div>

      <p class="legal">En créant un compte, vous acceptez les conditions d'utilisation.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()
const isRegister = ref(false)
const loading = ref(false)
const error = ref('')
const showPwd = ref(false)
const showConfirm = ref(false)
const form = ref({ username: '', email: '', password: '', confirm: '' })

// Force du mot de passe
const strength = computed(() => {
  const p = form.value.password
  if (!p) return 0
  let s = 0
  if (p.length >= 8) s++
  if (p.length >= 12) s++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
  if (/[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)) s++
  return s
})
const strengthColor = computed(() => ['', 'weak', 'fair', 'good', 'strong'][strength.value])
const strengthLabel = computed(() => ['', 'Faible', 'Acceptable', 'Bon', 'Excellent'][strength.value])

const canSubmit = computed(() => {
  if (loading.value) return false
  if (!form.value.email || !form.value.password) return false
  if (isRegister.value) {
    return form.value.password === form.value.confirm && form.value.password.length >= 8 && !!form.value.username
  }
  return true
})

function reset() {
  isRegister.value = !isRegister.value
  error.value = ''
  form.value = { username: '', email: '', password: '', confirm: '' }
}

async function submit() {
  if (!canSubmit.value) return
  loading.value = true; error.value = ''
  try {
    const ep = isRegister.value ? '/api/auth/register' : '/api/auth/login'
    const { data } = await axios.post(ep, form.value)
    auth.setAuth(data.token, data.user)
    router.push('/')
  } catch (e) {
    error.value = e.response?.data?.error || 'Une erreur est survenue'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100dvh; display: flex; align-items: center; justify-content: center;
  padding: 24px; position: relative; overflow: hidden; background: var(--bg);
}
.bg-orbs { position: absolute; inset: 0; pointer-events: none; }
.orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: .35; }
.orb-1 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, #7c5cfc 0%, transparent 70%);
  top: -180px; left: -100px;
  animation: drift 12s ease-in-out infinite alternate;
}
.orb-2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, #06d6c7 0%, transparent 70%);
  bottom: -150px; right: -80px;
  animation: drift 15s ease-in-out infinite alternate-reverse;
}
@keyframes drift { from { transform: translate(0,0); } to { transform: translate(30px, 20px); } }

.login-wrap {
  width: 100%; max-width: 400px;
  display: flex; flex-direction: column; align-items: center; gap: 24px;
  position: relative; z-index: 1;
}

.logo { display: flex; align-items: center; gap: 12px; }
.logo-icon {
  width: 48px; height: 48px; border-radius: 14px;
  background: var(--logo-gradient);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 28px rgba(124,92,252,0.45);
}
.logo-text { font-size: 20px; font-weight: 700; }

.login-card { width: 100%; padding: 32px 28px; display: flex; flex-direction: column; }
h1 { font-size: 22px; font-weight: 700; }
.subtitle { color: var(--text-2); font-size: 14px; margin-top: 4px; margin-bottom: 28px; }

.form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
label { font-size: 12px; font-weight: 600; color: var(--text-2); letter-spacing: .3px; }

/* Input avec bouton oeil */
.input-wrap { position: relative; display: flex; align-items: center; }
.input-wrap input { padding-right: 40px; }
.eye-btn {
  position: absolute; right: 10px;
  background: none; border: none; color: var(--text-3);
  cursor: pointer; display: flex; align-items: center; padding: 4px;
  transition: color .15s;
}
.eye-btn:hover { color: var(--text); }

/* Force du mot de passe */
.strength-wrap { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.strength-bars { display: flex; gap: 4px; flex: 1; }
.bar { flex: 1; height: 3px; border-radius: 2px; background: rgba(255,255,255,0.08); transition: background .3s; }
.bar.active.weak   { background: #f87171; }
.bar.active.fair   { background: #fbbf24; }
.bar.active.good   { background: #34d399; }
.bar.active.strong { background: #06d6c7; }
.strength-label { font-size: 11px; white-space: nowrap; }
.strength-label.weak   { color: #f87171; }
.strength-label.fair   { color: #fbbf24; }
.strength-label.good   { color: #34d399; }
.strength-label.strong { color: #06d6c7; }

/* Hints sous les champs */
.field-hint { font-size: 12px; display: flex; align-items: center; gap: 4px; }
.field-hint.error { color: #f87171; }
.field-hint.ok    { color: #34d399; }

.submit-btn { width: 100%; margin-top: 4px; height: 44px; font-size: 14px; }
.submit-btn:disabled { opacity: .5; cursor: not-allowed; transform: none !important; box-shadow: none !important; }

.spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.3);
  border-top-color: #fff; border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.error-msg {
  font-size: 13px; color: #f87171;
  background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.2);
  border-radius: var(--r-sm); padding: 10px 12px;
}

.divider {
  display: flex; align-items: center; gap: 12px;
  margin: 20px 0 0; color: var(--text-3); font-size: 12px;
}
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }

.toggle-btn {
  background: none; border: none; color: var(--accent);
  cursor: pointer; font-size: 13px; font-family: inherit;
  font-weight: 500; transition: opacity .15s; margin-top: 12px;
}
.toggle-btn:hover { opacity: .75; }

.legal { font-size: 11px; color: var(--text-3); text-align: center; }
</style>
