<template>
  <Teleport to="body">
    <div v-if="modelValue" class="jam-overlay" @click.self="close">
      <div class="jam-sheet glass-card">
        <div class="jam-head">
          <h2>Jam</h2>
          <button class="close-btn" @click="close" title="Fermer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Pas de Jam en cours : démarrer ou rejoindre -->
        <div v-if="!jam.isActive" class="jam-body">
          <p class="jam-hint">Lance un Jam pour écouter en direct et en même temps que tes amis — tout le monde entend exactement la même chose, en synchro.</p>
          <button class="btn btn-primary" style="width:100%" :disabled="starting" @click="startJam">
            <span v-if="starting" class="spinner-sm"></span>
            <span v-else>Démarrer un Jam</span>
          </button>

          <div class="divider"><span>ou</span></div>

          <div class="join-row">
            <input v-model="joinCode" placeholder="Code du Jam (ex. AB3XQ9)" maxlength="6" @keyup.enter="joinJam" />
            <button class="btn btn-ghost" :disabled="!joinCode.trim() || joining" @click="joinJam">Rejoindre</button>
          </div>
        </div>

        <!-- Jam actif -->
        <div v-else class="jam-body">
          <div class="code-block">
            <span class="code-label">Code à partager</span>
            <div class="code-value" @click="copyCode">
              {{ jam.code }}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/>
                <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" stroke="currentColor" stroke-width="1.6"/>
              </svg>
            </div>
          </div>

          <div class="participants">
            <span class="section-title" style="margin:0">Participants ({{ jam.participants.length }})</span>
            <div class="participant-chips">
              <span v-for="p in jam.participants" :key="p.id" class="chip">{{ p.username }}</span>
            </div>
          </div>

          <div v-if="jam.queue.length" class="queue">
            <span class="section-title" style="margin:0">File du Jam</span>
            <div v-for="(item, i) in jam.queue" :key="item.track.id + i" class="queue-row">
              <span class="queue-title">{{ item.track.title }}</span>
              <span class="queue-by">ajouté par {{ item.addedByUsername }}</span>
            </div>
          </div>
          <p v-else class="jam-hint">Personne n'a encore ajouté de morceau — utilise le menu "..." d'un morceau puis "Ajouter au Jam".</p>

          <button class="btn btn-ghost danger" style="width:100%" @click="leaveJam">
            {{ jam.isHost ? 'Terminer le Jam' : 'Quitter le Jam' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { useJamStore } from '../stores/jam.js'
import { useToastStore } from '../stores/toast.js'

defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])

const jam = useJamStore()
const toast = useToastStore()
const starting = ref(false)
const joining = ref(false)
const joinCode = ref('')

function close() { emit('update:modelValue', false) }

async function startJam() {
  starting.value = true
  try {
    await jam.start()
    toast.success('Jam démarré — partage le code avec tes amis')
  } catch {
    toast.error('Impossible de démarrer le Jam')
  } finally {
    starting.value = false
  }
}

async function joinJam() {
  if (!joinCode.value.trim()) return
  joining.value = true
  try {
    await jam.join(joinCode.value)
    joinCode.value = ''
  } finally {
    joining.value = false
  }
}

async function leaveJam() {
  await jam.leave()
  close()
}

function copyCode() {
  navigator.clipboard?.writeText(jam.code)
  toast.success('Code copié')
}
</script>

<style scoped>
.jam-overlay {
  position: fixed; inset: 0; z-index: 600;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: flex-end; justify-content: center;
}
@media (min-width: 640px) {
  .jam-overlay { align-items: center; }
}
.jam-sheet {
  width: 100%; max-width: 440px;
  max-height: 85vh; overflow-y: auto;
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  padding: 22px 20px calc(var(--safe-bottom) + 22px);
}
@media (min-width: 640px) {
  .jam-sheet { border-radius: var(--r-xl); }
}
.jam-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.jam-head h2 { font-size: 19px; font-weight: 800; }
.close-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--glass); border: none; color: var(--text); cursor: pointer;
}
.jam-body { display: flex; flex-direction: column; gap: 16px; }
.jam-hint { font-size: 13px; color: var(--text-2); line-height: 1.5; }

.divider { display: flex; align-items: center; gap: 10px; color: var(--text-3); font-size: 12px; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }

.join-row { display: flex; gap: 8px; }
.join-row input { text-transform: uppercase; letter-spacing: 1px; }

.code-block {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 18px; background: var(--glass); border-radius: var(--r); text-align: center;
}
.code-label { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 1px; }
.code-value {
  font-size: 28px; font-weight: 800; letter-spacing: 3px; cursor: pointer;
  display: flex; align-items: center; gap: 10px; color: var(--accent-2);
}

.participants, .queue { display: flex; flex-direction: column; gap: 10px; }
.participant-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  font-size: 12px; padding: 5px 12px; border-radius: 50px;
  background: var(--glass); color: var(--text-2);
}
.queue-row {
  display: flex; flex-direction: column; gap: 1px;
  padding: 8px 10px; border-radius: var(--r-sm); background: var(--glass);
}
.queue-title { font-size: 13px; font-weight: 500; }
.queue-by { font-size: 11px; color: var(--text-3); }

.btn-ghost.danger { color: #f87171; border-color: rgba(248,113,113,0.3); }
.btn-ghost.danger:hover { background: rgba(248,113,113,0.1); }

.spinner-sm {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3);
  border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
