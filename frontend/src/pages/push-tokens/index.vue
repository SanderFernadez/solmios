<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Notificaciones Push</h2>
        <p class="text-sm text-text-muted mt-0.5">Alta y baja de tokens de dispositivo para avisos push (chat, tareas)</p>
      </div>
    </div>

    <!-- Aviso de alcance -->
    <div class="rounded-[20px] border border-gold/30 bg-gold/5 p-4 mb-6 flex gap-3 items-start">
      <span class="w-5 h-5 text-gold shrink-0 mt-0.5" v-html="ICON_INFO"></span>
      <p class="text-xs text-navy/80">
        Los dispositivos se registran automáticamente desde la app móvil al iniciar sesión.
        Este panel lista los dispositivos de tu hotel y permite alta/baja manual para <strong>soporte</strong>.
      </p>
    </div>

    <!-- Listado de dispositivos del hotel -->
    <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-5 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-black text-navy">Dispositivos registrados ({{ tokens.length }})</h3>
        <button @click="loadTokens" :disabled="loading" class="text-xs font-bold text-cyan hover:underline cursor-pointer disabled:opacity-50">
          {{ loading ? 'Cargando…' : 'Actualizar' }}
        </button>
      </div>
      <p v-if="loading" class="text-xs text-text-muted">Cargando dispositivos…</p>
      <p v-else-if="!tokens.length" class="text-xs text-text-muted">No hay dispositivos registrados en este hotel.</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-left text-text-muted border-b border-border">
              <th class="py-2 pr-3 font-bold">Token</th>
              <th class="py-2 pr-3 font-bold">Plataforma</th>
              <th class="py-2 pr-3 font-bold">Usuario</th>
              <th class="py-2 pr-3 font-bold">Registrado</th>
              <th class="py-2 font-bold text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tokens" :key="t.id" class="border-b border-border/50">
              <td class="py-2 pr-3 font-mono text-navy">{{ t.token.slice(0, 20) }}…</td>
              <td class="py-2 pr-3 text-navy">{{ t.platform || '—' }}</td>
              <td class="py-2 pr-3 text-text-muted">{{ t.userId.slice(0, 8) }}</td>
              <td class="py-2 pr-3 text-text-muted">{{ new Date(t.createdAt).toLocaleString() }}</td>
              <td class="py-2 text-right">
                <button @click="unregisterToken(t.token)" class="text-coral font-bold hover:underline cursor-pointer">Dar de baja</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid md:grid-cols-2 gap-6">
      <!-- Registrar -->
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-5">
        <h3 class="text-sm font-black text-navy mb-1">Registrar dispositivo</h3>
        <p class="text-xs text-text-muted mb-4">Usá esto para dar de alta manualmente un token de Firebase (ej. reportado por soporte).</p>
        <div class="space-y-3">
          <div>
            <label class="block text-[11px] font-bold text-navy uppercase mb-2">Token FCM *</label>
            <input v-model="registerForm.token" type="text" placeholder="Token del dispositivo" class="w-full px-4 py-2.5 rounded-full border border-border text-sm" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-navy uppercase mb-2">Plataforma</label>
            <select v-model="registerForm.platform" class="w-full px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer">
              <option value="">Sin especificar</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
              <option value="web">Web</option>
            </select>
          </div>
          <button @click="register" :disabled="registering" class="w-full px-4 py-2.5 bg-cyan text-navy rounded-full text-sm font-bold hover:shadow-lg transition-all cursor-pointer disabled:opacity-50">
            {{ registering ? 'Registrando...' : 'Registrar' }}
          </button>
        </div>
      </div>

      <!-- Dar de baja -->
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-5">
        <h3 class="text-sm font-black text-navy mb-1">Dar de baja dispositivo</h3>
        <p class="text-xs text-text-muted mb-4">Borra un token. El backend solo lo borra si pertenece a tu usuario.</p>
        <div class="space-y-3">
          <div>
            <label class="block text-[11px] font-bold text-navy uppercase mb-2">Token FCM *</label>
            <input v-model="unregisterForm.token" type="text" placeholder="Token del dispositivo" class="w-full px-4 py-2.5 rounded-full border border-border text-sm" />
          </div>
          <button @click="unregister" :disabled="unregistering" class="w-full px-4 py-2.5 bg-coral text-white rounded-full text-sm font-bold hover:shadow-lg transition-all cursor-pointer disabled:opacity-50">
            {{ unregistering ? 'Dando de baja...' : 'Dar de baja' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Historial de acciones de esta sesión -->
    <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-5 mt-6" v-if="activity.length">
      <h3 class="text-sm font-black text-navy mb-3">Actividad de esta sesión</h3>
      <ul class="space-y-2">
        <li v-for="(a, i) in activity" :key="i" class="flex items-center gap-2 text-xs">
          <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="a.ok ? 'bg-teal' : 'bg-coral'"></span>
          <span class="text-text-muted">{{ a.time }}</span>
          <span class="text-navy">{{ a.message }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PushTokensService } from '@/services/PushTokens.service'
import type { PushToken } from '@/types'
import { useToast } from '@/composables/useToast'

const SVG_OPEN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
const ICON_INFO = `${SVG_OPEN}<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`

const toast = useToast()

const registerForm = ref({ token: '', platform: '' })
const unregisterForm = ref({ token: '' })
const registering = ref(false)
const unregistering = ref(false)

interface ActivityEntry { time: string; message: string; ok: boolean }
const activity = ref<ActivityEntry[]>([])

const tokens = ref<PushToken[]>([])
const loading = ref(false)

async function loadTokens() {
  loading.value = true
  try {
    tokens.value = await PushTokensService.list()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error al cargar dispositivos'
    toast.error(message)
  } finally {
    loading.value = false
  }
}

async function unregisterToken(token: string) {
  try {
    await PushTokensService.unregister(token)
    toast.success('Dispositivo dado de baja')
    logActivity(`Dado de baja: ${token.slice(0, 16)}…`, true)
    await loadTokens()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error al dar de baja'
    toast.error(message)
    logActivity(`Error al dar de baja: ${message}`, false)
  }
}

onMounted(loadTokens)

function logActivity(message: string, ok: boolean) {
  activity.value.unshift({ time: new Date().toLocaleTimeString(), message, ok })
}

async function register() {
  if (!registerForm.value.token.trim()) {
    toast.error('El token es obligatorio')
    return
  }
  registering.value = true
  try {
    await PushTokensService.register({
      token: registerForm.value.token.trim(),
      platform: registerForm.value.platform || undefined,
    })
    toast.success('Dispositivo registrado')
    logActivity(`Registrado: ${registerForm.value.token.trim().slice(0, 16)}…`, true)
    registerForm.value = { token: '', platform: '' }
    await loadTokens()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error al registrar'
    toast.error(message)
    logActivity(`Error al registrar: ${message}`, false)
  } finally {
    registering.value = false
  }
}

async function unregister() {
  if (!unregisterForm.value.token.trim()) {
    toast.error('El token es obligatorio')
    return
  }
  unregistering.value = true
  try {
    await PushTokensService.unregister(unregisterForm.value.token.trim())
    toast.success('Dispositivo dado de baja')
    logActivity(`Dado de baja: ${unregisterForm.value.token.trim().slice(0, 16)}…`, true)
    unregisterForm.value = { token: '' }
    await loadTokens()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error al dar de baja'
    toast.error(message)
    logActivity(`Error al dar de baja: ${message}`, false)
  } finally {
    unregistering.value = false
  }
}
</script>
