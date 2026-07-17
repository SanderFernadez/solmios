<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">API Keys & Webhooks</h2>
        <p class="text-sm text-text-muted mt-0.5">Gestiona claves API, webhooks y accesos externos</p>
      </div>
      <button @click="showCreateKey = true" class="px-4 py-2 bg-navy text-white text-sm font-bold rounded-xl hover:bg-navy-light transition-colors cursor-pointer">
        + Nueva API Key
      </button>
    </div>

    <div class="grid lg:grid-cols-3 gap-6 mb-6">
      <!-- API Keys -->
      <div class="lg:col-span-2 bg-white rounded-2xl border border-border overflow-hidden">
        <div class="px-5 py-4 bg-navy">
          <h3 class="font-extrabold text-white">API Keys Activas</h3>
        </div>
        <div class="p-6">
        <div class="overflow-x-auto">
          <table class="w-full tbl-navy">
            <thead>
              <tr class="border-b border-border">
                <th class="text-left py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Nombre</th>
                <th class="text-left py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Clave</th>
                <th class="text-left py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Hotel</th>
                <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Peticiones</th>
                <th class="text-left py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Último Uso</th>
                <th class="text-left py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Estado</th>
                <th class="text-right py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="key in apiKeys" :key="key.id" class="border-b border-border/50 hover:bg-surface/50 transition-colors">
                <td class="py-3 px-3">
                  <div class="text-xs font-bold text-navy">{{ key.name }}</div>
                  <div class="text-[9px] text-text-muted">{{ key.scope }}</div>
                </td>
                <td class="py-3 px-3">
                  <div class="flex items-center gap-2">
                    <code class="text-[10px] font-mono text-text-muted bg-surface px-2 py-0.5 rounded">{{ key.masked }}</code>
                    <button @click="copyKey(key)" class="text-text-muted hover:text-cyan transition-colors cursor-pointer">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"/></svg>
                    </button>
                  </div>
                </td>
                <td class="py-3 px-3 text-xs text-navy">{{ key.hotel }}</td>
                <td class="py-3 px-3 text-center text-xs font-bold text-navy">{{ key.requests.toLocaleString() }}</td>
                <td class="py-3 px-3 text-xs text-text-muted">{{ key.lastUsed }}</td>
                <td class="py-3 px-3">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="key.active ? 'bg-teal/10 text-teal' : 'bg-coral/10 text-coral'">
                    {{ key.active ? 'Activa' : 'Revocada' }}
                  </span>
                </td>
                <td class="py-3 px-3 text-right">
                  <button @click="revokeKey(key.id)" class="text-[10px] font-bold text-coral hover:underline cursor-pointer">
                    {{ key.active ? 'Revocar' : 'Reactivar' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
      </div>

      <!-- Rate Limits -->
      <div class="bg-white rounded-2xl border border-border overflow-hidden">
        <div class="px-5 py-4 bg-navy">
          <h3 class="font-extrabold text-white">Rate Limits</h3>
        </div>
        <div class="p-6">
        <div class="space-y-3">
          <div v-for="plan in rateLimits" :key="plan.plan" class="bg-surface rounded-xl p-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-navy">{{ plan.plan }}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-navy/10 text-navy">{{ plan.rpm }} req/min</span>
            </div>
            <div class="flex justify-between text-[10px] text-text-muted">
              <span>{{ plan.used }} usados hoy</span>
              <span>{{ plan.remaining }} restantes</span>
            </div>
            <div class="h-1.5 bg-white rounded-full overflow-hidden mt-2">
              <div class="h-full rounded-full transition-all" :class="plan.used / plan.daily * 100 > 80 ? 'bg-coral' : 'bg-cyan'" :style="{ width: (plan.used / plan.daily * 100) + '%' }"></div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>

    <!-- Webhooks -->
    <div class="bg-white rounded-2xl border border-border overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 bg-navy">
        <h3 class="font-extrabold text-white">Webhooks Configurados</h3>
        <button class="px-3 py-2 bg-white/10 text-white text-xs font-bold rounded-xl cursor-pointer">
          + Nuevo Webhook
        </button>
      </div>
      <div class="p-6">
      <div class="overflow-x-auto">
        <table class="w-full tbl-navy">
          <thead>
            <tr class="border-b border-border">
              <th class="text-left py-3 px-3 text-[10px] font-bold text-text-muted uppercase">URL</th>
              <th class="text-left py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Eventos</th>
              <th class="text-left py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Hotel</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Entregados</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Fallidos</th>
              <th class="text-left py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Estado</th>
              <th class="text-right py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="wh in webhooks" :key="wh.id" class="border-b border-border/50 hover:bg-surface/50 transition-colors">
              <td class="py-3 px-3 text-[10px] text-text-muted font-mono truncate max-w-[250px]">{{ wh.url }}</td>
              <td class="py-3 px-3">
                <div class="flex flex-wrap gap-1">
                  <span v-for="ev in wh.events" :key="ev" class="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-surface text-text-muted">{{ ev }}</span>
                </div>
              </td>
              <td class="py-3 px-3 text-xs text-navy">{{ wh.hotel }}</td>
              <td class="py-3 px-3 text-center text-xs font-bold text-teal">{{ wh.delivered }}</td>
              <td class="py-3 px-3 text-center text-xs" :class="wh.failed > 0 ? 'font-bold text-coral' : 'text-text-muted'">{{ wh.failed }}</td>
              <td class="py-3 px-3">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="wh.failed > 5 ? 'bg-coral/10 text-coral' : 'bg-teal/10 text-teal'">
                  {{ wh.failed > 5 ? 'Degradado' : 'Saludable' }}
                </span>
              </td>
              <td class="py-3 px-3 text-right">
                <button class="text-[10px] font-bold text-cyan hover:underline cursor-pointer mr-2">Probar</button>
                <button class="text-[10px] font-bold text-coral hover:underline cursor-pointer">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>

    <!-- Create API Key Modal -->
    <div v-if="showCreateKey" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
        <div class="flex items-center justify-between gap-3 bg-navy px-6 py-4">
          <h3 class="text-lg font-black text-white truncate">Nueva API Key</h3>
          <button @click="showCreateKey = false" class="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
        <div class="space-y-3">
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Nombre</label>
            <input v-model="newKey.name" type="text" placeholder="Ej: Conexión Channex" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan" />
          </div>
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Hotel</label>
            <select v-model="newKey.hotel" class="w-full h-10 px-4 rounded-xl border border-border text-sm cursor-pointer">
              <option value="">Global (todos)</option>
              <option v-for="h in hotels" :key="h.id" :value="h.id">{{ h.name }}</option>
            </select>
          </div>
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Scope / Permisos</label>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="s in scopes" :key="s" @click="toggleScope(s)"
                class="text-[10px] font-bold px-2 py-1 rounded-full border transition-all cursor-pointer"
                :class="newKey.scopes.includes(s) ? 'bg-cyan border-cyan text-navy' : 'bg-surface border-border text-text-muted hover:border-cyan'">
                {{ s }}
              </button>
            </div>
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button @click="showCreateKey = false" class="flex-1 py-2.5 bg-surface text-navy text-sm font-bold rounded-xl cursor-pointer">Cancelar</button>
          <button @click="generateKey" :disabled="creating" class="flex-1 py-2.5 bg-navy text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50">
            {{ creating ? 'Generando...' : 'Generar' }}
          </button>
        </div>
        </div>
      </div>
    </div>

    <!-- Reveal new API Key (one-time secret — persistente, no toast) -->
    <div v-if="revealKey" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        <div class="flex items-center justify-between gap-3 bg-navy px-6 py-4">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-2xl">🔑</span>
            <h3 class="text-lg font-black text-white truncate">Guardá tu API Key ahora</h3>
          </div>
          <button @click="revealKey = null" class="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
        <p class="text-xs text-coral font-bold mb-3">⚠️ Por seguridad no se volverá a mostrar. Copiala y guardala en un lugar seguro.</p>
        <div class="bg-surface rounded-xl p-3 mb-4 flex items-center gap-2">
          <code class="flex-1 text-xs font-mono text-navy break-all">{{ revealKey }}</code>
          <button @click="copyPlainKey" class="shrink-0 px-3 py-1.5 bg-navy text-white text-[10px] font-bold rounded-lg cursor-pointer hover:bg-navy-light">Copiar</button>
        </div>
        <button @click="revealKey = null" class="w-full py-2.5 bg-surface text-navy text-sm font-bold rounded-xl cursor-pointer">Listo, ya la guardé</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ApikeysService } from '@/services/Apikeys.service'
import { SuperAdminService } from '@/services/SuperAdmin.service'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const showCreateKey = ref(false)
const creating = ref(false)
const revealKey = ref<string | null>(null)
const hotels = ref<Array<{ id: string; name: string }>>([])

const scopes = ['read:reservations', 'write:reservations', 'read:rooms', 'write:rooms', 'read:billing', 'write:billing', 'read:guests', 'write:guests']

const newKey = ref<{ name: string; hotel: string; scopes: string[] }>({ name: '', hotel: '', scopes: [] })

const apiKeys = ref<any[]>([])

const rateLimits = ref<any[]>([
  { plan: 'Enterprise', rpm: 600, used: 234, daily: 50000, remaining: 49766 },
  { plan: 'Professional', rpm: 200, used: 89, daily: 10000, remaining: 9911 },
  { plan: 'Starter', rpm: 60, used: 12, daily: 2000, remaining: 1988 },
])

const webhooks = ref<any[]>([])

async function loadHotels() {
  try {
    const r = await SuperAdminService.hotels()
    const list = (r as any)?.data || (r as any)?.hotels || []
    hotels.value = list.map((h: any) => ({ id: h.id, name: h.name }))
  } catch { hotels.value = [] }
}

async function loadKeys() {
  try {
    const r = await ApikeysService.list()
    apiKeys.value = (r.data || []).map((k: any) => ({
      id: k.id,
      name: k.name,
      scope: k.scope || '—',
      masked: k.masked || '••••••••',
      hotel: k.hotelId ? (hotels.value.find(h => h.id === k.hotelId)?.name || k.hotelId) : 'Global',
      requests: k.requests || 0,
      lastUsed: k.lastUsed || 'Nunca',
      active: k.active === 1 || k.active === true,
    }))
  } catch {
    apiKeys.value = []
  }
}

onMounted(async () => {
  await loadHotels()
  await loadKeys()
})

function toggleScope(s: string) {
  const idx = newKey.value.scopes.indexOf(s)
  if (idx >= 0) newKey.value.scopes.splice(idx, 1)
  else newKey.value.scopes.push(s)
}

async function generateKey() {
  if (!newKey.value.name) { toast.error('Nombre requerido'); return }
  creating.value = true
  try {
    const created = await ApikeysService.create({
      name: newKey.value.name,
      hotelId: newKey.value.hotel || undefined,
      scope: newKey.value.scopes.join(','),
    })
    // Si el backend devuelve la clave en plain text, mostrarla una sola vez (modal persistente — un toast auto-cerraría y perdería el secret)
    const plainKey = (created as { plainKey?: string } | null)?.plainKey
    if (plainKey) {
      revealKey.value = plainKey
    } else {
      toast.success('API Key creada')
    }
    showCreateKey.value = false
    newKey.value = { name: '', hotel: '', scopes: [] }
    await loadKeys()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Error al crear API Key')
  } finally {
    creating.value = false
  }
}

async function revokeKey(id: string) {
  const key = apiKeys.value.find(k => k.id === id)
  if (!key) return
  if (key.active) {
    if (!confirm(`¿Revocar la API Key "${key.name}"?`)) return
    try {
      await ApikeysService.revoke(id)
      key.active = false
      toast.success('Revocada')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') }
  } else {
    try {
      await ApikeysService.reactivate(id)
      key.active = true
      toast.success('Reactivada')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') }
  }
}

async function copyKey(key: any) {
  try {
    await navigator.clipboard.writeText(key.masked)
    toast.success('Clave copiada')
  } catch { toast.error('No se pudo copiar') }
}

async function copyPlainKey() {
  try {
    await navigator.clipboard.writeText(revealKey.value || '')
    toast.success('API Key copiada')
  } catch { toast.error('No se pudo copiar') }
}

async function deleteKey(id: string) {
  if (!confirm('¿Eliminar definitivamente esta API Key?')) return
  try {
    await ApikeysService.remove(id)
    apiKeys.value = apiKeys.value.filter(k => k.id !== id)
    toast.success('Eliminada')
  } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') }
}
</script>
