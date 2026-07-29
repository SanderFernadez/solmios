<template>
  <div class="min-h-screen bg-surface">
    <!-- Header -->
    <div class="bg-white border-b border-border px-6 py-4">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan to-blue flex items-center justify-center font-black text-white text-lg shadow-lg">S</div>
          <div>
            <div class="font-black text-xl text-navy">Motor de Reservas</div>
            <div class="text-xs text-text-muted">Google Hotel Ads · Widget Web</div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs font-bold px-3 py-1 rounded-full" :class="config?.enabled ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">
            ● {{ config?.enabled ? 'Activo' : 'Inactivo' }}
          </span>
          <button @click="saveConfig" :disabled="saving" class="px-4 py-2 bg-navy text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50">
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
          <button @click="verWidget" class="px-4 py-2 bg-cyan text-navy text-sm font-bold rounded-xl cursor-pointer">
            Ver Widget
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto p-6">
      <!-- KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl p-4 border border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase">Búsquedas</div>
          <div class="text-2xl font-black text-navy mt-1">{{ analytics?.totalSearches ?? 0 }}</div>
          <div class="text-[10px] text-teal font-bold mt-1">últimos 30 días</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase">Reservas Directas</div>
          <div class="text-2xl font-black text-navy mt-1">{{ analytics?.totalBookings ?? 0 }}</div>
          <div class="text-[10px] text-teal font-bold mt-1">{{ (analytics?.conversionRate ?? 0).toFixed(1) }}% conversión</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase">Ingresos Directos</div>
          <div class="text-2xl font-black text-navy mt-1">${{ (analytics?.totalRevenue ?? 0).toLocaleString() }}</div>
          <div class="text-[10px] text-teal font-bold mt-1">sin comisiones OTA</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase">Ticket Promedio</div>
          <div class="text-2xl font-black text-teal mt-1">${{ (analytics?.averageBookingValue ?? 0).toLocaleString() }}</div>
          <div class="text-[10px] text-teal font-bold mt-1">por reserva</div>
        </div>
      </div>

      <!-- F4 4.1 (D13) — Funnel de conversión real desde tracking_events. Muestra count por
           step + dropOff entre consecutivos. Vacío (todos 0) → EmptyState guía al admin. -->
      <SectionCard
        title="Funnel de Conversión"
        subtitle="Vista → Búsqueda → Selección → Upsell → Form → Pago → Confirmación"
        body-class="p-0"
        class="mb-6"
      >
        <div v-if="funnelHasData" class="p-5 space-y-3">
          <div v-for="(step, idx) in funnelRows" :key="step.step">
            <div class="flex items-center gap-3 mb-1.5">
              <div class="w-6 h-6 rounded-full bg-navy text-white text-[10px] font-black grid place-items-center flex-shrink-0">{{ idx + 1 }}</div>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-bold text-navy truncate">{{ step.label }}</div>
              </div>
              <div class="text-right">
                <div class="text-sm font-black text-navy tabular-nums">{{ step.count.toLocaleString() }}</div>
                <div v-if="step.dropOff !== null" class="text-[10px] font-bold tabular-nums"
                  :class="dropOffColor(step.dropOff)">
                  {{ step.dropOff }}% avanza
                </div>
                <div v-else class="text-[10px] font-bold text-text-muted">step final</div>
              </div>
            </div>
            <div class="ml-9 h-2 bg-surface rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                :class="funnelBarColor(idx)"
                :style="{ width: `${funnelBarWidth(step.count)}%` }"></div>
            </div>
          </div>
        </div>
        <EmptyState
          v-else
          icon="📊"
          title="Sin datos de funnel todavía"
          message="Los eventos del widget (vista, búsqueda, selección, pago) se acumulan acá a medida que los huéspedes navegan el motor de reservas. Hacé una reserva de prueba para ver el funnel poblarse."
        />
      </SectionCard>

      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Widget Config -->
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white rounded-2xl border border-border p-6">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-lg font-black text-navy">Configuración del Widget</h2>
            </div>

            <div class="grid md:grid-cols-2 gap-6">
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Tema del Widget</label>
                <div class="grid grid-cols-3 gap-2">
                  <button 
                    v-for="theme in themes" 
                    :key="theme.id"
                    @click="config!.theme = theme.id"
                    class="p-3 rounded-xl border-2 text-center transition-all cursor-pointer"
                    :class="config?.theme === theme.id ? 'border-cyan bg-cyan/5' : 'border-border hover:border-gray-300'"
                  >
                    <div class="w-6 h-6 rounded-full mx-auto mb-1" :class="theme.color"></div>
                    <div class="text-[10px] font-bold">{{ theme.name }}</div>
                  </button>
                </div>
              </div>

              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Posición en la Web</label>
                <select v-model="config!.position" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan cursor-pointer">
                  <option value="corner">Esquina inferior derecha</option>
                  <option value="center">Centro de pantalla</option>
                  <option value="inline">Integrado en página</option>
                  <option value="popup">Popup al cargar</option>
                </select>
              </div>

              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Moneda</label>
                <select v-model="config!.currency" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan cursor-pointer">
                  <option value="USD">USD - Dólar</option>
                  <option value="DOP">DOP - Peso Dominicano</option>
                  <option value="MXN">MXN - Peso Mexicano</option>
                  <option value="COP">COP - Peso Colombiano</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>

              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Idioma</label>
                <select v-model="config!.language" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan cursor-pointer">
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </div>

            <div class="mt-6 pt-6 border-t border-border">
              <label class="text-[10px] font-bold text-text-muted uppercase mb-3 block">Opciones de Reserva</label>
              <div class="grid md:grid-cols-2 gap-3">
                <label class="flex items-center gap-3 p-3 bg-surface rounded-xl cursor-pointer">
                  <input type="checkbox" v-model="config!.instantConfirmation" class="w-4 h-4 text-cyan rounded" />
                  <div>
                    <div class="text-sm font-bold text-navy">Confirmación Instantánea</div>
                    <div class="text-[10px] text-text-muted">Sin intervención manual</div>
                  </div>
                </label>
                <label class="flex items-center gap-3 p-3 bg-surface rounded-xl cursor-pointer">
                  <input type="checkbox" v-model="config!.googleAdsEnabled" class="w-4 h-4 text-cyan rounded" />
                  <div>
                    <div class="text-sm font-bold text-navy">Google Hotel Ads</div>
                    <div class="text-[10px] text-text-muted">Sincronizar tarifas</div>
                  </div>
                </label>
                <label class="flex items-center gap-3 p-3 bg-surface rounded-xl cursor-pointer">
                  <input type="checkbox" v-model="config!.whatsappConfirmation" class="w-4 h-4 text-cyan rounded" />
                  <div>
                    <div class="text-sm font-bold text-navy">Confirmación WhatsApp</div>
                    <div class="text-[10px] text-text-muted">Envío automático</div>
                  </div>
                </label>
                <label class="flex items-center gap-3 p-3 bg-surface rounded-xl cursor-pointer">
                  <input type="checkbox" v-model="config!.showComparison" class="w-4 h-4 text-cyan rounded" />
                  <div>
                    <div class="text-sm font-bold text-navy">Comparar con OTAs</div>
                    <div class="text-[10px] text-text-muted">Mostrar ahorro vs Booking/Expedia</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Widget Code -->
          <div class="bg-white rounded-2xl border border-border p-6">
            <h3 class="text-sm font-black text-navy mb-3">Código del Widget</h3>
            <p class="text-[10px] text-text-muted mb-3">Pega este código en tu sitio web antes del cierre de &lt;body&gt;</p>
            <div class="bg-navy rounded-xl p-4 overflow-x-auto">
              <code class="text-[11px] text-white/80 whitespace-pre">{{ embedCode }}</code>
            </div>
            <button @click="copyCode" class="w-full mt-3 py-2 bg-surface text-navy text-xs font-bold rounded-xl hover:bg-navy hover:text-white transition-all cursor-pointer">
              {{ copied ? '✓ Copiado' : 'Copiar Código' }}
            </button>
          </div>

          <!-- Widget Preview -->
          <div class="bg-white rounded-2xl border border-border p-6">
            <h3 class="text-sm font-black text-navy mb-3">Vista Previa</h3>
            <div class="aspect-video bg-surface rounded-xl flex items-center justify-center border border-border">
              <div class="text-center">
                <div class="text-3xl mb-2">🏨</div>
                <div class="text-xs text-text-muted">Widget Preview</div>
                <button @click="verWidget" class="mt-2 text-[10px] font-bold text-cyan hover:underline">Abrir widget →</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { BookingEngineService, type BookingConfig, type BookingAnalytics, type FunnelStep } from '@/services/BookingEngine.service'
import { http } from '@/services/http'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const config = ref<BookingConfig | null>(null)
const analytics = ref<BookingAnalytics | null>(null)
const saving = ref(false)
const copied = ref(false)
// F2 2.11-2.13 (solmi-direct-booking): el snippet embebible y la URL del widget ahora usan
// el SLUG público del hotel, no el hotelId. El slug se resuelve desde GET /api/hoteles/:id
// (endpoint ya existente; el modelo Hotels incluye `slug` desde F0 0.1). Si el hotel no tiene
// slug todavía (alta pre-seeder), el snippet muestra un placeholder y el preview se deshabilita.
const hotelSlug = ref<string>('')

// F4 4.1 (D13) — Funnel de conversión desde tracking_events. Si `analytics.funnel` viene
// vacío o todos los counts son 0, mostramos EmptyState (sin tráfico todavía).
const funnelRows = computed<FunnelStep[]>(() => analytics.value?.funnel ?? [])
const funnelHasData = computed(() => funnelRows.value.some((s) => s.count > 0))
const funnelMax = computed(() => Math.max(1, ...funnelRows.value.map((s) => s.count)))
function funnelBarWidth(count: number): number {
  return Math.max(2, Math.round((count / funnelMax.value) * 100))
}
function funnelBarColor(idx: number): string {
  // Degradado navy → cyan → teal a lo largo del funnel (visual "más cerca de convertir").
  const colors = ['bg-navy', 'bg-navy', 'bg-cyan', 'bg-cyan', 'bg-teal', 'bg-teal', 'bg-teal']
  return colors[idx] ?? 'bg-navy'
}
function dropOffColor(pct: number): string {
  // Drop-off alto (>=70%) → teal (buen avance). Medio (40-69%) → gold. Bajo (<40%) → rojo suave.
  if (pct >= 70) return 'text-teal'
  if (pct >= 40) return 'text-gold'
  return 'text-rose'
}

const themes = [
  { id: 'navy', name: 'Navy', color: 'bg-navy' },
  { id: 'cyan', name: 'Cyan', color: 'bg-cyan' },
  { id: 'teal', name: 'Teal', color: 'bg-teal' },
  { id: 'white', name: 'Claro', color: 'bg-white border border-gray-200' },
  { id: 'dark', name: 'Oscuro', color: 'bg-gray-800' },
]

const embedCode = computed(() =>
  `<script src="${window.location.origin}/widget/loader.js"\n` +
  `  data-hotel="${hotelSlug.value || 'SLUG-DEL-HOTEL'}">\n` +
  `<\/script>`
)

async function saveConfig() {
  if (!config.value) return
  saving.value = true
  try {
    await BookingEngineService.updateConfig(config.value)
    toast.success('Configuración guardada')
  } catch {
    toast.error('Error al guardar')
  } finally {
    saving.value = false
  }
}

function verWidget() {
  if (!hotelSlug.value) {
    toast.error('Definí el slug del hotel en Configuración → Página pública')
    return
  }
  // F2 2.13: abrimos el widget en modo embed (mismo layout que tendría embebido en sitio externo).
  window.open(`/book/${encodeURIComponent(hotelSlug.value)}?embed=1`, '_blank')
}

function copyCode() {
  navigator.clipboard.writeText(embedCode.value)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}

onMounted(async () => {
  try {
    const tasks: Promise<unknown>[] = [
      BookingEngineService.getConfig(),
      BookingEngineService.getAnalytics(),
    ]
    // Resolver el slug del propio hotel para el snippet embebible y el preview (F2 2.13).
    if (hotelId.value) {
      tasks.push(http.get<{ slug?: string }>(`/hoteles/${hotelId.value}`))
    }
    const [cfg, stats, hotel] = await Promise.all(tasks) as [BookingConfig, BookingAnalytics, { slug?: string } | undefined]
    config.value = cfg
    analytics.value = stats
    if (hotel && typeof hotel.slug === 'string' && hotel.slug.trim() !== '') {
      hotelSlug.value = hotel.slug.trim()
    }
  } catch {
    toast.error('Error al cargar configuración')
  }
})
</script>
