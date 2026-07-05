<template>
  <div class="min-h-screen bg-surface">
    <!-- Header -->
    <div class="bg-white border-b border-border px-6 py-4">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 class="text-xl font-black text-navy">Channel Manager</h1>
          <p class="text-xs text-text-muted">Canales conectados · Disponibilidad en tiempo real</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs font-bold px-3 py-1 rounded-full bg-teal/10 text-teal inline-flex items-center gap-1">
            <span class="w-2 h-2 bg-teal rounded-full animate-pulse"></span>
            Sincronizando cada 15 min
          </span>
          <button @click="syncNow" :disabled="syncing" class="px-4 py-2 bg-navy text-white text-sm font-bold rounded-xl hover:bg-navy-light transition-colors cursor-pointer disabled:opacity-50">
            {{ syncing ? 'Sincronizando...' : 'Forzar Sync Ahora' }}
          </button>
          <button @click="ingestBookings" :disabled="ingesting" class="px-4 py-2 bg-teal text-white text-sm font-bold rounded-xl hover:bg-teal/80 transition-colors cursor-pointer disabled:opacity-50">
            {{ ingesting ? 'Ingestando...' : 'Recibir Reservas' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Connection Dialog -->
    <div v-if="connectDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 backdrop-blur-sm" @click.self="cancelConnect">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
        <h2 class="text-lg font-black text-navy mb-4">Conectar {{ connectDialog.channelName }}</h2>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-text-muted mb-1">Código OTA</label>
            <input :value="connectDialog.channelCode" readonly class="w-full px-3 py-2 bg-surface rounded-xl text-sm text-navy font-mono" />
          </div>
          <div>
            <label class="block text-xs font-bold text-text-muted mb-1">Título del canal</label>
            <input v-model="connectDialog.title" class="w-full px-3 py-2 border border-border rounded-xl text-sm text-navy focus:border-cyan focus:ring-1 focus:ring-cyan outline-none" />
          </div>

          <div v-if="connectError" class="text-xs font-bold text-coral bg-coral/10 rounded-xl px-3 py-2">{{ connectError }}</div>
          <div v-if="connectResult" class="text-xs font-bold text-teal bg-teal/10 rounded-xl px-3 py-2">{{ connectResult }}</div>

          <div class="flex gap-3 pt-2">
            <button @click="cancelConnect" class="flex-1 py-2.5 border border-border text-text-muted text-xs font-bold rounded-xl hover:bg-surface transition-colors cursor-pointer">Cancelar</button>
            <button @click="confirmConnect" :disabled="connecting" class="flex-1 py-2.5 bg-cyan text-navy text-xs font-bold rounded-xl hover:shadow-lg hover:shadow-cyan/30 transition-all cursor-pointer disabled:opacity-60">
              {{ connecting ? 'Conectando...' : 'Conectar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Config Dialog -->
    <div v-if="configDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 backdrop-blur-sm" @click.self="closeConfig">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 mx-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-black text-navy">{{ configDialog.name }}</h2>
          <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full', configDialog.active ? 'bg-teal/10 text-teal' : 'bg-coral/10 text-coral']">{{ configDialog.active ? 'Activo' : 'Inactivo' }}</span>
        </div>
        <div class="space-y-3">
          <div>
            <span class="text-[10px] text-text-muted uppercase">ID en Channex</span>
            <p class="text-xs font-mono text-navy mt-0.5 truncate">{{ configDialog.id }}</p>
          </div>
          <div>
            <span class="text-[10px] text-text-muted uppercase">Código OTA</span>
            <p class="text-xs font-bold text-navy mt-0.5">{{ configDialog.otaCode }}</p>
          </div>
          <div class="flex gap-4">
            <div>
              <span class="text-[10px] text-text-muted uppercase">Reservas</span>
              <p class="text-sm font-black text-navy mt-0.5">{{ configDialog.bookings }}</p>
            </div>
            <div>
              <span class="text-[10px] text-text-muted uppercase">Última Sync</span>
              <p class="text-xs text-teal mt-0.5">{{ configDialog.lastSync }}</p>
            </div>
          </div>
          <button @click="closeConfig" class="w-full py-2.5 bg-navy text-white text-xs font-bold rounded-xl hover:bg-navy-light transition-colors cursor-pointer mt-2">Cerrar</button>
        </div>
      </div>
    </div>

    <!-- Channex iFrame -->
    <div v-if="showIframe" class="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 backdrop-blur-sm">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] mx-4 flex flex-col">
        <div class="flex items-center justify-between px-6 py-3 border-b border-border">
          <h2 class="text-lg font-black text-navy">Channex — Conectar Canales</h2>
          <button @click="showIframe = false; loadStatus()" class="px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl hover:bg-navy-light transition-colors cursor-pointer">Cerrar y Refrescar</button>
        </div>
        <iframe v-if="iframeUrl" :src="iframeUrl" class="flex-1 w-full rounded-b-2xl" frameborder="0" />
        <div v-else class="flex-1 flex items-center justify-center text-text-muted text-sm">Cargando...</div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto p-6">
      <!-- Connected Channels -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-black text-navy">Canales Conectados</h2>
          <span class="text-xs font-bold text-text-muted">{{ connectedChannels.filter(c => c.connected).length }} de {{ connectedChannels.length }}</span>
        </div>
        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div v-for="channel in connectedChannels" :key="channel.id"
            class="bg-white rounded-2xl border-2 p-5 transition-all hover:shadow-lg cursor-pointer"
            :class="[channel.connected ? 'border-transparent' : 'border-dashed border-border hover:border-cyan/50']">
            <!-- Channel Icon -->
            <div class="flex items-center justify-between mb-4">
              <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm" :class="channel.bgColor">{{ channel.icon }}</div>
              <div class="flex items-center gap-1">
                <span class="w-2.5 h-2.5 rounded-full" :class="channel.connected ? 'bg-teal animate-pulse' : 'bg-gray-300'"></span>
                <span class="text-[10px] font-bold" :class="channel.connected ? 'text-teal' : 'text-text-muted'">{{ channel.connected ? 'Conectado' : 'Disponible' }}</span>
              </div>
            </div>
            <h3 class="text-sm font-black text-navy mb-1">{{ channel.name }}</h3>
            <p class="text-[10px] text-text-muted mb-3">{{ channel.description }}</p>
            <template v-if="channel.connected">
              <div class="bg-surface rounded-xl p-3 space-y-2 mb-3">
                <div class="flex justify-between text-[10px]">
                  <span class="text-text-muted">Reservas (mes)</span>
                  <span class="font-bold text-navy">{{ channel.bookings }}</span>
                </div>
                <div class="flex justify-between text-[10px]">
                  <span class="text-text-muted">Última Sync</span>
                  <span class="font-bold text-teal">{{ channel.lastSync }}</span>
                </div>
              </div>
              <div class="flex gap-2">
                <button @click="configChannel(channel)" class="flex-1 py-2 bg-surface text-navy text-[10px] font-bold rounded-lg hover:bg-navy hover:text-white transition-all cursor-pointer">Configurar</button>
                <button @click="disconnectChannel(channel.id)" class="py-2 px-3 bg-surface text-coral text-[10px] font-bold rounded-lg hover:bg-coral hover:text-white transition-all cursor-pointer">Desconectar</button>
              </div>
            </template>
            <template v-else>
              <button @click="connectChannel(channel.id)" class="w-full py-2.5 bg-cyan text-navy text-xs font-bold rounded-xl hover:shadow-lg hover:shadow-cyan/30 transition-all cursor-pointer flex items-center justify-center gap-2">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 005.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                Conectar
              </button>
            </template>
          </div>
        </div>
      </div>

      <!-- Available Channels -->
      <div class="mb-8">
        <h2 class="text-lg font-black text-navy mb-4">Canales Disponibles para Conectar</h2>
        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div v-for="channel in availableChannels" :key="channel.id"
            class="bg-white rounded-2xl border border-border p-5 hover:border-cyan/30 hover:shadow-md transition-all cursor-pointer group">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl" :class="channel.bgColor">{{ channel.icon }}</div>
              <div>
                <div class="text-sm font-bold text-navy">{{ channel.name }}</div>
                <div class="text-[10px] text-text-muted">{{ channel.category }}</div>
              </div>
            </div>
            <button class="w-full py-2 text-[10px] font-bold rounded-lg border border-border text-text-muted group-hover:border-cyan group-hover:text-cyan transition-all cursor-pointer">
              Solicitar Conexión
            </button>
          </div>
        </div>
      </div>

      <!-- Sync Log -->
      <div class="bg-white rounded-2xl border border-border p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-black text-navy">Historial de Sincronización</h2>
          <span class="text-[10px] text-text-muted">{{ syncLog.length }} registros</span>
        </div>
        <div v-if="syncLog.length === 0" class="text-center py-8 text-text-muted text-sm">
          Sin sincronizaciones registradas
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-border">
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Acción</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Canal</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Fecha</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Estado</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Detalle</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in syncLog" :key="log.id" class="border-b border-border/50 hover:bg-surface/50 transition-colors">
                <td class="py-3 text-sm font-bold text-navy">{{ log.action }}</td>
                <td class="py-3 text-xs text-text-muted">{{ log.channel || '—' }}</td>
                <td class="py-3 text-xs text-text-muted">{{ log.createdAt?.slice(0, 16)?.replace('T', ' ') }}</td>
                <td class="py-3">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="log.status === 'success' ? 'bg-teal/10 text-teal' : 'bg-red/10 text-red'">{{ log.status === 'success' ? 'Exitoso' : 'Error' }}</span>
                </td>
                <td class="py-3 text-xs text-text-muted max-w-xs truncate">{{ log.details }}</td>
                <td class="py-3 text-xs text-text-muted">{{ log.detail }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChannelService } from '@/services/Channel.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { http } from '@/services/http'

const auth = useAuthStore()
const toast = useToast()
const router = useRouter()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const DEFAULT_OTA_CATALOG = [
  { id: 'airbnb', name: 'Airbnb', channexCode: 'AirBNB', icon: '🏠', bgColor: 'bg-coral/10', type: 'ota', connected: false },
  { id: 'booking', name: 'Booking.com', channexCode: 'BookingCom', icon: '🌐', bgColor: 'bg-cyan/10', type: 'ota', connected: false },
  { id: 'expedia', name: 'Expedia', channexCode: 'A-Expedia', icon: '✈️', bgColor: 'bg-gold/10', type: 'ota', connected: false },
  { id: 'google', name: 'Google Hotels', channexCode: 'GHA', icon: '🔍', bgColor: 'bg-blue/10', type: 'metasearch', connected: false },
  { id: 'hostelworld', name: 'Hostelworld', channexCode: 'HW', icon: '🏘️', bgColor: 'bg-orange/10', type: 'ota', connected: false },
  { id: 'agoda', name: 'Agoda', channexCode: 'Agoda', icon: '🏝️', bgColor: 'bg-red/10', type: 'ota', connected: false },
  { id: 'despegar', name: 'Despegar', channexCode: 'Despegar', icon: '🛫', bgColor: 'bg-purple/10', type: 'ota', connected: false },
  { id: 'trip', name: 'Trip.com', channexCode: 'TripCom', icon: '🌏', bgColor: 'bg-teal/10', type: 'ota', connected: false },
]

const status = ref<Awaited<ReturnType<typeof ChannelService.status>> | null>(null)
const syncing = ref(false)

const connectedChannels = ref<any[]>([])
const availableChannels = ref<any[]>([])
const syncLog = ref<any[]>([])

const connectDialog = ref<{ channelId: string; channelName: string; channelCode: string; title: string; connected: boolean } | null>(null)
const configDialog = ref<{ id: string; name: string; otaCode: string; active: boolean; bookings: number; lastSync: string; connected: boolean } | null>(null)
const connecting = ref(false)
const ingesting = ref(false)
const connectError = ref('')
const connectResult = ref('')
const showIframe = ref(false)
const iframeUrl = ref('')

async function loadStatus() {
  try {
    status.value = await ChannelService.status(hotelId.value)
    connectedChannels.value = status.value.data.map((c: any) => ({
      id: c.id ?? c.name,
      name: c.name || 'OTA',
      icon: c.icon || '🔗',
      bgColor: c.color || 'bg-gray-50',
      description: c.description || c.descripcion || '',
      connected: !!(c.connected ?? c.conectado),
      active: c.active,
      bookings: c.bookings ?? 0,
      lastSync: c.lastSync || c.ultimaSync || status.value?.lastSync || '—',
      otaCode: c.otaCode || c.channexCode,
    }))
  } catch { toast.error("Error al cargar datos") }
  try {
    const { ConfigService } = await import('@/services/Platform.service')
    const otas = await ConfigService.get('ota_catalog', 'platform')
      || await ConfigService.get('catalogo_otas', 'platform')
    if (Array.isArray(otas) && otas.length > 0) {
      availableChannels.value = otas
    } else {
      availableChannels.value = DEFAULT_OTA_CATALOG
    }
  } catch { availableChannels.value = DEFAULT_OTA_CATALOG }
  // Load sync history from DB
  try {
    const logData = await ChannelService.syncLog(hotelId.value)
    syncLog.value = (logData?.data || []).slice(0, 20)
  } catch {}
}

async function syncNow() {
  syncing.value = true
  try {
    await ChannelService.sync(hotelId.value)
    await loadStatus()
  } catch (e) {
    toast.error('Error al sincronizar')
  } finally { syncing.value = false }
}

onMounted(loadStatus)

function connectChannel(id: string) {
  const ch = connectedChannels.value.find(c => c.id === id)
  if (!ch) return
  const code = ch.otaCode || ch.name
  connectDialog.value = { channelId: id, channelName: ch.name, channelCode: String(code), title: ch.name, connected: ch.connected }
  connectError.value = ''
  connectResult.value = ''
}

async function confirmConnect() {
  const dlg = connectDialog.value
  if (!dlg || !hotelId.value) return
  connecting.value = true
  connectError.value = ''
  connectResult.value = ''
  try {
    const groups = await ChannelService.groups(hotelId.value)
    const groupId = groups[0]?.id
    if (!groupId) { connectError.value = 'No hay grupos configurados en Channex'; return }

    const st = status.value || await ChannelService.status(hotelId.value)
    const propertyId = st.channexPropertyId
    if (!propertyId) { connectError.value = 'No hay propiedad configurada en Channex'; return }

    const result = await ChannelService.connect({
      hotelId: hotelId.value,
      channel: dlg.channelCode,
      title: dlg.title,
      groupId,
      propertyId,
      ratePlans: [],
    })

    if (result.success) {
      connectResult.value = result.message
      setTimeout(async () => { connectDialog.value = null; await loadStatus() }, 1200)
    } else {
      connectError.value = result.message
    }
  } catch (e: any) {
    connectError.value = e?.message || 'Error al conectar'
  } finally { connecting.value = false }
}

function cancelConnect() {
  connectDialog.value = null
  connectError.value = ''
  connectResult.value = ''
}

function configChannel(channel: any) {
  if (channel.id && channel.connected) {
    router.push(`/panel/channel/${channel.id}`)
    return
  }
  configDialog.value = {
    id: channel.id,
    name: channel.name,
    otaCode: channel.otaCode || channel.name,
    active: channel.active === undefined ? channel.connected : channel.active,
    bookings: channel.bookings || 0,
    lastSync: channel.lastSync || '—',
    connected: channel.connected,
  }
}

function closeConfig() {
  configDialog.value = null
}

async function ingestBookings() {
  ingesting.value = true
  try {
    const result = await ChannelService.ingestBookings(hotelId.value)
    toast.success(result.message || 'Ingesta completada')
    await loadStatus()
  } catch (e: any) {
    toast.error('Error al ingestar reservas')
  } finally { ingesting.value = false }
}

async function disconnectChannel(id: string) {
  const ch = connectedChannels.value.find(c => c.id === id)
  if (!ch || !hotelId.value) return
  if (!ch.connected) return
  if (!ch.otaCode) { ch.connected = false; return }
  try {
    const result = await ChannelService.deactivate(hotelId.value, ch.id)
    if (result.success) await loadStatus()
    else toast.warning(result.message)
  } catch (e: any) {
    toast.error('Error al desconectar')
  }
}
</script>
