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
          <span v-if="!configLoaded" class="text-xs font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-500">
            ● Cargando…
          </span>
          <!-- FIX 2026-07-31 — QA encontró que esto era un badge de SOLO LECTURA: el toggle
               "Activo/Inactivo" ahora sí apaga/prende el motor público (ver public-rates.ts),
               pero no había forma de cambiarlo desde la UI. Ahora es clickeable — como el resto
               del form, requiere "Guardar" para persistir (sin autosave sorpresa). -->
          <button
            v-else
            type="button"
            @click="form.enabled = !form.enabled"
            :title="form.enabled ? 'Click para desactivar el motor de reservas' : 'Click para activar el motor de reservas'"
            class="text-xs font-bold px-3 py-1 rounded-full cursor-pointer transition-colors"
            :class="form.enabled ? 'bg-teal/10 text-teal hover:bg-teal/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
          >
            ● {{ form.enabled ? 'Activo' : 'Inactivo' }}
          </button>
          <button @click="saveConfig" :disabled="saving || !configLoaded" class="px-4 py-2 bg-navy text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50">
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
          <button @click="verWidget" class="px-4 py-2 bg-cyan text-navy text-sm font-bold rounded-xl cursor-pointer">
            Ver Widget
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto p-6 space-y-6">
      <!-- ═══ Widget embebible — CTA principal (prominente, arriba) ═══
           Antes enterrado al final del sidebar. Ahora es lo primero que ve
           el admin: cómo integrar el motor en su web. -->
      <SectionCard
        title="🔗 Integrá el widget en tu sitio web"
        subtitle="Pegá este código en el HTML de tu web, antes de cerrar </body>"
        body-class="p-5"
      >
        <template #actions>
          <span
            class="rounded-full px-3 py-1 text-[11px] font-bold whitespace-nowrap"
            :class="hotelSlug ? 'bg-teal/10 text-teal' : 'bg-warning/15 text-warning'"
          >
            {{ hotelSlug ? `Slug: ${hotelSlug}` : 'Falta configurar el slug' }}
          </span>
        </template>

        <!-- Aviso si no hay slug: el snippet no funciona sin él. -->
        <div v-if="!hotelSlug" class="mb-4 rounded-xl bg-warning/10 border border-warning/30 p-3 text-xs text-navy leading-relaxed">
          <strong>Antes necesitás tu slug público.</strong>
          Andá a
          <router-link to="/panel/pagina-publica" class="font-bold text-cyan hover:underline">Página pública → General</router-link>
          y configurá la URL de tu hotel. Sin slug, el widget no sabe qué hotel mostrar.
        </div>

        <div class="grid lg:grid-cols-[1fr_auto] gap-4 items-stretch">
          <!-- Snippet -->
          <div class="bg-navy rounded-xl p-4 overflow-x-auto">
            <code class="text-[11px] text-white/85 whitespace-pre leading-relaxed">{{ embedCode }}</code>
          </div>
          <!-- Copy + preview -->
          <div class="flex lg:flex-col gap-2 lg:w-44">
            <button
              @click="copyCode"
              class="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-cyan text-navy text-xs font-extrabold rounded-xl hover:shadow-lg transition-all cursor-pointer"
            >
              {{ copied ? '✓ Copiado' : 'Copiar código' }}
            </button>
            <button
              @click="verWidget"
              :disabled="!hotelSlug"
              class="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-surface text-navy text-xs font-bold rounded-xl hover:bg-navy hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ver demo ↗
            </button>
          </div>
        </div>

        <p class="mt-3 text-[11px] text-text-muted leading-relaxed">
          El widget carga el motor de reservas de tu hotel (búsqueda → selección → pago) embebido en
          tu propia web. Funciona en cualquier sitio (HTML, WordPress, Wix, etc.) — solo necesitás
          acceso para pegar el código.
        </p>
      </SectionCard>

      <!-- ═══ KPIs — con empty state cuando el motor está activo pero sin tráfico ═══ -->
      <div v-if="kpisHaveData" class="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      <SectionCard
        v-else
        title="Tu motor está activo"
        body-class="p-0"
      >
        <EmptyState
          icon="✅"
          title="Tu motor está activo"
          message="Cuando recibas las primeras búsquedas, acá vas a ver las estadísticas: búsquedas, reservas, ingresos y conversión. Mientras tanto, integrá el widget en tu web (arriba) para empezar a recibir tráfico."
        />
      </SectionCard>

      <!-- ═══ F4 4.1 (D13) — Funnel de conversión real desde tracking_events. ═══ -->
      <SectionCard
        title="Funnel de Conversión"
        subtitle="Vista → Búsqueda → Selección → Upsell → Form → Pago → Confirmación"
        body-class="p-0"
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
          <!-- Loading / error / form.
               Config puede llegar null si falla la red: antes los bindings `config!.X`
               crasheaban el panel entero. Ahora el form solo renderiza con datos reales
               cargados en `form` (reactive, siempre non-null); si cae, EmptyState con retry. -->
          <div v-if="configLoaded" class="bg-white rounded-2xl border border-border p-6">
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
                    @click="form.theme = theme.id"
                    class="p-3 rounded-xl border-2 text-center transition-all cursor-pointer"
                    :class="form.theme === theme.id ? 'border-cyan bg-cyan/5' : 'border-border hover:border-gray-300'"
                  >
                    <div class="w-6 h-6 rounded-full mx-auto mb-1" :class="theme.color"></div>
                    <div class="text-[10px] font-bold">{{ theme.name }}</div>
                  </button>
                </div>
              </div>

              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Posición en la Web</label>
                <select v-model="form.position" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan cursor-pointer">
                  <option value="corner">Esquina inferior derecha</option>
                  <option value="center">Centro de pantalla</option>
                  <option value="inline">Integrado en página</option>
                  <option value="popup">Popup al cargar</option>
                </select>
              </div>

              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Moneda</label>
                <select v-model="form.currency" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan cursor-pointer">
                  <option value="USD">USD - Dólar</option>
                  <option value="DOP">DOP - Peso Dominicano</option>
                  <option value="MXN">MXN - Peso Mexicano</option>
                  <option value="COP">COP - Peso Colombiano</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>

              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Idioma</label>
                <select v-model="form.language" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan cursor-pointer">
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </div>

            <!-- FIX 2026-07-31 — antes minNights/maxNights/cancellationPolicy se guardaban
                 (defaults 1/30/'') pero NO había ningún input para cambiarlos: el backend ya
                 los hacía cumplir (ver public-rates.ts) pero el admin no tenía forma de
                 configurarlos. -->
            <div class="mt-6 pt-6 border-t border-border">
              <label class="text-[10px] font-bold text-text-muted uppercase mb-3 block">Reglas de estadía</label>
              <div class="grid md:grid-cols-2 gap-6">
                <div>
                  <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Mínimo de noches</label>
                  <input
                    v-model.number="form.minNights"
                    type="number"
                    min="1"
                    class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan"
                  />
                </div>
                <div>
                  <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Máximo de noches</label>
                  <input
                    v-model.number="form.maxNights"
                    type="number"
                    min="1"
                    class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan"
                  />
                </div>
              </div>
              <div class="mt-4">
                <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Política de cancelación</label>
                <textarea
                  v-model="form.cancellationPolicy"
                  rows="2"
                  placeholder="Ej: Cancelación gratis hasta 48h antes del check-in."
                  class="w-full px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan resize-none"
                />
                <p class="mt-1 text-[10px] text-text-muted">Se muestra al huésped en el motor de reservas.</p>
              </div>
            </div>

            <div class="mt-6 pt-6 border-t border-border">
              <label class="text-[10px] font-bold text-text-muted uppercase mb-3 block">Opciones de Reserva</label>
              <div class="grid md:grid-cols-2 gap-3">
                <label class="flex items-center gap-3 p-3 bg-surface rounded-xl cursor-pointer">
                  <input type="checkbox" v-model="form.instantConfirmation" class="w-4 h-4 text-cyan rounded" />
                  <div>
                    <div class="text-sm font-bold text-navy">Confirmación Instantánea</div>
                    <div class="text-[10px] text-text-muted">Sin intervención manual</div>
                  </div>
                </label>
                <!-- FIX 2026-07-31 — googleAdsEnabled/whatsappConfirmation se guardaban pero no
                     existe ninguna integración real detrás (sin feed de Google Hotel Ads, sin
                     WhatsApp Business API conectado — deuda documentada en CLAUDE.md). Prenderlos
                     no hacía nada; mejor avisar "Próximamente" que mentirle al merchant. -->
                <label class="flex items-center gap-3 p-3 bg-surface rounded-xl opacity-60 cursor-not-allowed" title="Todavía no hay integración real detrás de esta opción">
                  <input type="checkbox" disabled class="w-4 h-4 rounded" />
                  <div>
                    <div class="text-sm font-bold text-navy">Google Hotel Ads</div>
                    <div class="text-[10px] text-text-muted">Sincronizar tarifas — Próximamente</div>
                  </div>
                </label>
                <label class="flex items-center gap-3 p-3 bg-surface rounded-xl opacity-60 cursor-not-allowed" title="Requiere conectar WhatsApp Business API">
                  <input type="checkbox" disabled class="w-4 h-4 rounded" />
                  <div>
                    <div class="text-sm font-bold text-navy">Confirmación WhatsApp</div>
                    <div class="text-[10px] text-text-muted">Envío automático — Próximamente</div>
                  </div>
                </label>
                <label class="flex items-center gap-3 p-3 bg-surface rounded-xl cursor-pointer">
                  <input type="checkbox" v-model="form.showComparison" class="w-4 h-4 text-cyan rounded" />
                  <div>
                    <div class="text-sm font-bold text-navy">Comparar con OTAs</div>
                    <div class="text-[10px] text-text-muted">Mostrar ahorro vs Booking/Expedia</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Error de carga de config: EmptyState con retry (no mostramos form con defaults). -->
          <SectionCard v-else-if="loadError" title="Configuración del Widget" body-class="p-0">
            <EmptyState
              icon="⚠️"
              title="No pudimos cargar la configuración"
              :message="loadError"
            >
              <template #action>
                <button
                  type="button"
                  @click="loadAll"
                  class="rounded-full bg-navy px-5 py-2 text-sm font-bold text-white hover:shadow-lg cursor-pointer"
                >
                  Reintentar
                </button>
              </template>
            </EmptyState>
          </SectionCard>

          <!-- Loading skeleton -->
          <div v-else class="bg-white rounded-2xl border border-border p-6">
            <div class="h-6 w-48 bg-surface rounded animate-pulse mb-6"></div>
            <div class="grid md:grid-cols-2 gap-6">
              <div v-for="i in 4" :key="i" class="h-10 bg-surface rounded-xl animate-pulse"></div>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
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
import { ref, reactive, computed, onMounted } from 'vue'
import { BookingEngineService, type BookingConfig, type BookingAnalytics, type FunnelStep } from '@/services/BookingEngine.service'
import { http } from '@/services/http'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

// ─── Config: form reactivo SIEMPRE non-null (defaults) + bandera de carga ──
// Antes `config` era `ref<BookingConfig | null>(null)` y los bindings `config!.X`
// crasheaban si la red fallaba. Ahora el form parte de defaults concretos y se
// hidrata al cargar; `configLoaded` separa "tengo datos reales" de "estoy mostrando
// defaults", así el form nunca se renderiza con datos inválidos.
const configLoaded = ref(false)
const loadError = ref('')
const saving = ref(false)
const copied = ref(false)
// F2 2.11-2.13 (solmi-direct-booking): el snippet embebible y la URL del widget usan
// el SLUG público del hotel, no el hotelId. Si el hotel no tiene slug todavía (alta
// pre-seeder), el snippet muestra un placeholder y el CTA "Ver demo" se deshabilita.
const hotelSlug = ref<string>('')

function defaultConfig(): BookingConfig {
  return {
    id: '',
    hotelId: '',
    enabled: false,
    theme: 'navy',
    position: 'corner',
    currency: 'USD',
    language: 'es',
    minNights: 1,
    maxNights: 30,
    cancellationPolicy: '',
    showComparison: false,
    googleAdsEnabled: false,
    whatsappConfirmation: false,
    instantConfirmation: false,
    stripeAccountId: '',
    allowedCountries: [],
  }
}

// Form editable (reactive). Siempre non-null → los v-model del template son seguros.
const form = reactive<BookingConfig>(defaultConfig())

const analytics = ref<BookingAnalytics | null>(null)

// Tiempo que el botón "Copiar código" muestra el check de confirmación (UX micro-timing).
const COPY_FEEDBACK_MS = 2000

// ─── KPIs — "motor activo sin tráfico" se ve como EmptyState, no como ceros rotos ─
const kpisHaveData = computed(() =>
  (analytics.value?.totalSearches ?? 0) > 0 || (analytics.value?.totalBookings ?? 0) > 0,
)

// F4 4.1 (D13) — Funnel de conversión desde tracking_events.
const funnelRows = computed<FunnelStep[]>(() => analytics.value?.funnel ?? [])
const funnelHasData = computed(() => funnelRows.value.some((s) => s.count > 0))
const funnelMax = computed(() => Math.max(1, ...funnelRows.value.map((s) => s.count)))
function funnelBarWidth(count: number): number {
  return Math.max(2, Math.round((count / funnelMax.value) * 100))
}
function funnelBarColor(idx: number): string {
  const colors = ['bg-navy', 'bg-navy', 'bg-cyan', 'bg-cyan', 'bg-teal', 'bg-teal', 'bg-teal']
  return colors[idx] ?? 'bg-navy'
}
function dropOffColor(pct: number): string {
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
  if (!configLoaded.value) return
  saving.value = true
  try {
    const updated = await BookingEngineService.updateConfig(form)
    // El backend puede normalizar/normalizar campos: reflotar el form con la respuesta.
    Object.assign(form, updated)
    toast.success('Configuración guardada')
  } catch {
    toast.error('Error al guardar')
  } finally {
    saving.value = false
  }
}

function verWidget() {
  if (!hotelSlug.value) {
    toast.error('Definí el slug del hotel en Página pública → General')
    return
  }
  // F2 2.13: abrimos el widget en modo embed (mismo layout que tendría embebido en sitio externo).
  window.open(`/book/${encodeURIComponent(hotelSlug.value)}?embed=1`, '_blank')
}

function copyCode() {
  navigator.clipboard.writeText(embedCode.value)
  copied.value = true
  setTimeout(() => (copied.value = false), COPY_FEEDBACK_MS)
}

async function loadAll() {
  loadError.value = ''
  configLoaded.value = false
  try {
    const tasks: Promise<unknown>[] = [
      BookingEngineService.getConfig(),
      BookingEngineService.getAnalytics(),
    ]
    if (hotelId.value) {
      tasks.push(http.get<{ slug?: string }>(`/hoteles/${hotelId.value}`))
    }
    const [cfg, stats, hotel] = await Promise.all(tasks) as [BookingConfig, BookingAnalytics, { slug?: string } | undefined]
    // Hidratar el form reactivo (NO pisar la referencia: tablas reactivas se mutan).
    Object.assign(form, cfg)
    analytics.value = stats
    if (hotel && typeof hotel.slug === 'string' && hotel.slug.trim() !== '') {
      hotelSlug.value = hotel.slug.trim()
    }
    configLoaded.value = true
  } catch (e) {
    // Sin config: dejamos el form con defaults pero NO marcamos como cargado → EmptyState con retry.
    loadError.value = (e as Error)?.message || 'No pudimos cargar la configuración del motor.'
  }
}

onMounted(loadAll)
</script>
