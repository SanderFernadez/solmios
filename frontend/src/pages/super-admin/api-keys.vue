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

    <!-- API Keys -->
    <div class="bg-white rounded-2xl border border-border overflow-hidden mb-6">
      <div class="px-5 py-4 bg-navy">
        <h3 class="font-extrabold text-white">API Keys Activas</h3>
      </div>
      <div class="p-6">
      <SkeletonLoader v-if="loading" variant="table" :rows="4" />
      <div v-else class="overflow-x-auto">
        <table class="w-full tbl-head">
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
            <tr v-if="!apiKeys.length">
              <td colspan="7">
                <EmptyState title="Sin API keys" message="Todavía no generaste ninguna clave. Creá una para conectar servicios externos." />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>

    <!-- Webhooks -->
    <div class="bg-white rounded-2xl border border-border overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 bg-navy">
        <h3 class="font-extrabold text-white">Webhooks Configurados</h3>
        <button @click="openCreateWebhook" class="px-3 py-2 bg-white/10 text-white text-xs font-bold rounded-xl cursor-pointer">
          + Nuevo Webhook
        </button>
      </div>
      <div class="p-6">
      <SkeletonLoader v-if="loadingWebhooks" variant="table" :rows="3" />
      <div v-else class="overflow-x-auto">
        <table class="w-full tbl-head">
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
                <button @click="testWebhook(wh.id)" :disabled="testingId === wh.id" class="text-[10px] font-bold text-cyan hover:underline cursor-pointer mr-2 disabled:opacity-50">
                  {{ testingId === wh.id ? 'Probando...' : 'Probar' }}
                </button>
                <button @click="deleteWebhook(wh.id)" class="text-[10px] font-bold text-coral hover:underline cursor-pointer">Eliminar</button>
              </td>
            </tr>
            <tr v-if="!webhooks.length">
              <td colspan="7">
                <EmptyState title="Sin webhooks" message="Configurá un webhook para recibir eventos de la plataforma en tu servidor." />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>

    <!-- Create Webhook Modal -->
    <AppModal v-if="showCreateWebhook" size="sm" title="Nuevo Webhook" @close="showCreateWebhook = false">
      <div class="space-y-3">
        <div>
          <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">URL de destino</label>
          <input v-model="newWebhook.url" type="text" placeholder="https://tu-servidor.com/webhooks/solmios" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan" />
        </div>
        <div>
          <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Hotel</label>
          <select v-model="newWebhook.hotel" class="w-full h-10 px-4 rounded-xl border border-border text-sm cursor-pointer">
            <option value="">Seleccioná un hotel</option>
            <option v-for="h in hotels" :key="h.id" :value="h.id">{{ h.name }}</option>
          </select>
        </div>
        <div>
          <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Eventos</label>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="ev in webhookEvents" :key="ev" @click="toggleWebhookEvent(ev)"
              class="text-[10px] font-bold px-2 py-1 rounded-full border transition-all cursor-pointer"
              :class="newWebhook.events.includes(ev) ? 'bg-cyan border-cyan text-navy' : 'bg-surface border-border text-text-muted hover:border-cyan'">
              {{ ev }}
            </button>
          </div>
        </div>
      </div>
      <template #footer>
        <button @click="showCreateWebhook = false" class="bg-surface text-navy text-sm font-bold rounded-xl cursor-pointer px-4 py-2.5">Cancelar</button>
        <button @click="createWebhook" :disabled="creatingWebhook" class="bg-navy text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50 px-4 py-2.5">
          {{ creatingWebhook ? 'Creando...' : 'Crear' }}
        </button>
      </template>
    </AppModal>

    <!-- Reveal new webhook secret (one-time — necesario para configurar la verificación HMAC) -->
    <AppModal v-if="revealWebhookSecret" size="md" title="Guardá el secreto del webhook ahora" @close="revealWebhookSecret = null">
      <p class="text-xs text-coral font-bold mb-3">⚠️ Por seguridad no se volverá a mostrar. Usalo para verificar la firma HMAC-SHA256 (header x-solmios-signature) en tu servidor.</p>
      <div class="bg-surface rounded-xl p-3 flex items-center gap-2">
        <code class="flex-1 text-xs font-mono text-navy break-all">{{ revealWebhookSecret }}</code>
        <button @click="copyWebhookSecret" class="shrink-0 px-3 py-1.5 bg-navy text-white text-[10px] font-bold rounded-lg cursor-pointer hover:bg-navy-light">Copiar</button>
      </div>
      <template #footer>
        <button @click="revealWebhookSecret = null" class="bg-surface text-navy text-sm font-bold rounded-xl cursor-pointer px-4 py-2.5">Listo, ya lo guardé</button>
      </template>
    </AppModal>

    <!-- Create API Key Modal -->
    <AppModal v-if="showCreateKey" size="sm" title="Nueva API Key" @close="showCreateKey = false">
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
      <template #footer>
        <button @click="showCreateKey = false" class="bg-surface text-navy text-sm font-bold rounded-xl cursor-pointer px-4 py-2.5">Cancelar</button>
        <button @click="generateKey" :disabled="creating" class="bg-navy text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50 px-4 py-2.5">
          {{ creating ? 'Generando...' : 'Generar' }}
        </button>
      </template>
    </AppModal>

    <!-- Reveal new API Key (one-time secret — persistente, no toast) -->
    <AppModal v-if="revealKey" size="md" title="Guardá tu API Key ahora" @close="revealKey = null">
      <p class="text-xs text-coral font-bold mb-3">⚠️ Por seguridad no se volverá a mostrar. Copiala y guardala en un lugar seguro.</p>
      <div class="bg-surface rounded-xl p-3 flex items-center gap-2">
        <code class="flex-1 text-xs font-mono text-navy break-all">{{ revealKey }}</code>
        <button @click="copyPlainKey" class="shrink-0 px-3 py-1.5 bg-navy text-white text-[10px] font-bold rounded-lg cursor-pointer hover:bg-navy-light">Copiar</button>
      </div>
      <template #footer>
        <button @click="revealKey = null" class="bg-surface text-navy text-sm font-bold rounded-xl cursor-pointer px-4 py-2.5">Listo, ya la guardé</button>
      </template>
    </AppModal>

    <ConfirmModal v-if="confirmModal" :title="confirmModal.title" :message="confirmModal.message"
      :confirm-label="confirmModal.confirmLabel" :danger="confirmModal.danger" :loading="confirmBusy"
      @confirm="runConfirm" @close="confirmModal = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AppModal from '@/components/ui/AppModal.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import { ApikeysService } from '@/services/Apikeys.service'
import { WebhooksService } from '@/services/Webhooks.service'
import { SuperAdminService } from '@/services/SuperAdmin.service'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import ConfirmModal from '@/components/features/ConfirmModal.vue'

const toast = useToast()
const { confirmModal, confirmBusy, askConfirm, runConfirm } = useConfirm({
  onError: (e) => toast.error(e instanceof Error ? e.message : 'Error'),
})
const showCreateKey = ref(false)
const creating = ref(false)
const loading = ref(true)
const revealKey = ref<string | null>(null)
const hotels = ref<Array<{ id: string; name: string }>>([])

const scopes = ['read:reservations', 'write:reservations', 'read:rooms', 'write:rooms', 'read:billing', 'write:billing', 'read:guests', 'write:guests']

const newKey = ref<{ name: string; hotel: string; scopes: string[] }>({ name: '', hotel: '', scopes: [] })

const apiKeys = ref<any[]>([])

const webhookEvents = [
  'reservation.created', 'reservation.updated', 'reservation.checked_out',
  'payment.completed', 'payment.failed', 'payment.refunded',
]

const showCreateWebhook = ref(false)
const creatingWebhook = ref(false)
const loadingWebhooks = ref(true)
const revealWebhookSecret = ref<string | null>(null)
const testingId = ref<string | null>(null)
const newWebhook = ref<{ url: string; hotel: string; events: string[] }>({ url: '', hotel: '', events: [] })

const webhooks = ref<any[]>([])

async function loadHotels() {
  try {
    const r = await SuperAdminService.hotels()
    const list = (r as any)?.data || (r as any)?.hotels || []
    hotels.value = list.map((h: any) => ({ id: h.id, name: h.name }))
  } catch { hotels.value = [] }
}

async function loadKeys() {
  loading.value = true
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
    toast.error('No se pudieron cargar las API keys')
  } finally { loading.value = false }
}

async function loadWebhooks() {
  loadingWebhooks.value = true
  try {
    const r = await WebhooksService.list()
    webhooks.value = (r.data || []).map((w: any) => ({
      id: w.id,
      url: w.url,
      events: w.events || [],
      hotel: w.hotelId ? (hotels.value.find(h => h.id === w.hotelId)?.name || w.hotelId) : 'Global',
      delivered: w.delivered || 0,
      failed: w.failed || 0,
    }))
  } catch {
    webhooks.value = []
    toast.error('No se pudieron cargar los webhooks')
  } finally { loadingWebhooks.value = false }
}

onMounted(async () => {
  await loadHotels()
  await loadKeys()
  await loadWebhooks()
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

function revokeKey(id: string) {
  const key = apiKeys.value.find(k => k.id === id)
  if (!key) return
  if (key.active) {
    askConfirm({
      title: 'Revocar API Key',
      message: `¿Revocar la API Key "${key.name}"? Dejará de funcionar inmediatamente.`,
      confirmLabel: 'Revocar', danger: true,
      run: async () => {
        await ApikeysService.revoke(id)
        key.active = false
        toast.success('Revocada')
      },
    })
  } else {
    reactivateKey(id, key)
  }
}

async function reactivateKey(id: string, key: any) {
  try {
    await ApikeysService.reactivate(id)
    key.active = true
    toast.success('Reactivada')
  } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') }
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

function deleteKey(id: string) {
  askConfirm({
    title: 'Eliminar API Key',
    message: '¿Eliminar definitivamente esta API Key? No se puede deshacer.',
    confirmLabel: 'Eliminar', danger: true,
    run: async () => {
      await ApikeysService.remove(id)
      apiKeys.value = apiKeys.value.filter(k => k.id !== id)
      toast.success('Eliminada')
    },
  })
}

function openCreateWebhook() {
  newWebhook.value = { url: '', hotel: '', events: [] }
  showCreateWebhook.value = true
}

function toggleWebhookEvent(ev: string) {
  const idx = newWebhook.value.events.indexOf(ev)
  if (idx >= 0) newWebhook.value.events.splice(idx, 1)
  else newWebhook.value.events.push(ev)
}

async function createWebhook() {
  if (!newWebhook.value.url) { toast.error('URL requerida'); return }
  if (!newWebhook.value.hotel) { toast.error('Seleccioná un hotel'); return }
  if (!newWebhook.value.events.length) { toast.error('Seleccioná al menos un evento'); return }
  creatingWebhook.value = true
  try {
    const created = await WebhooksService.create({
      hotelId: newWebhook.value.hotel, url: newWebhook.value.url, events: newWebhook.value.events,
    })
    const secret = (created as { secret?: string } | null)?.secret
    if (secret) revealWebhookSecret.value = secret
    else toast.success('Webhook creado')
    showCreateWebhook.value = false
    await loadWebhooks()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Error al crear el webhook')
  } finally {
    creatingWebhook.value = false
  }
}

async function testWebhook(id: string) {
  testingId.value = id
  try {
    const result = await WebhooksService.test(id)
    if (result?.delivered) toast.success('Entrega exitosa: el endpoint respondió 2xx')
    else toast.error('No se pudo entregar: el endpoint no respondió 2xx tras los reintentos')
    await loadWebhooks()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Error al probar el webhook')
  } finally {
    testingId.value = null
  }
}

function deleteWebhook(id: string) {
  askConfirm({
    title: 'Eliminar webhook',
    message: '¿Eliminar definitivamente este webhook? Dejará de recibir eventos.',
    confirmLabel: 'Eliminar', danger: true,
    run: async () => {
      await WebhooksService.remove(id)
      webhooks.value = webhooks.value.filter(w => w.id !== id)
      toast.success('Eliminado')
    },
  })
}

async function copyWebhookSecret() {
  try {
    await navigator.clipboard.writeText(revealWebhookSecret.value || '')
    toast.success('Secreto copiado')
  } catch { toast.error('No se pudo copiar') }
}
</script>
