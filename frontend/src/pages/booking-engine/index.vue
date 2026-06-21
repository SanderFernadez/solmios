<template>
  <div class="min-h-screen bg-surface">
    <!-- Header -->
    <div class="bg-white border-b border-border px-6 py-4">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan to-blue flex items-center justify-center font-black text-white text-lg shadow-lg">M</div>
          <div>
            <div class="font-black text-xl text-navy">Motor de Reservas</div>
            <div class="text-xs text-text-muted">Google Hotel Ads · Widget Web</div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs font-bold px-3 py-1 rounded-full bg-teal/10 text-teal">● Activo</span>
          <button @click="saveConfig" class="px-4 py-2 bg-navy text-white text-sm font-bold rounded-xl cursor-pointer">💾 Guardar</button>
          <button class="px-4 py-2 bg-cyan text-navy text-sm font-bold rounded-xl cursor-pointer">
            Ver Widget
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto p-6">
      <!-- KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl p-4 border border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase">Reservas Directas</div>
          <div class="text-2xl font-black text-navy mt-1">{{ (engineData as any)?.directas ?? 0 }}</div>
          <div class="text-[10px] text-teal font-bold mt-1">de {{ (engineData as any)?.totalReservas ?? 0 }} totales</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase">Tasa Conversión</div>
          <div class="text-2xl font-black text-navy mt-1">{{ ((engineData as any)?.totalReservas ?? 0) > 0 ? Math.round(((engineData as any)?.directas ?? 0) / Math.max((engineData as any)?.totalReservas ?? 1, 1) * 100) : 0 }}%</div>
          <div class="text-[10px] text-teal font-bold mt-1">directas vs OTA</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase">Ingresos Directos</div>
          <div class="text-2xl font-black text-navy mt-1">\${{ ((engineData as any)?.revenueDirecta ?? 0).toLocaleString() }}</div>
          <div class="text-[10px] text-teal font-bold mt-1">sin comisiones OTA</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase">Comisiones Ahorradas</div>
          <div class="text-2xl font-black text-teal mt-1">\${{ ((engineData as any)?.comisionesAhorradas ?? 0).toLocaleString() }}</div>
          <div class="text-[10px] text-teal font-bold mt-1">~15% de comisión OTA</div>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Widget Preview -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Widget Config -->
          <div class="bg-white rounded-2xl border border-border p-6">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-lg font-black text-navy">Configuración del Widget</h2>
              <button class="text-xs font-bold text-cyan hover:underline cursor-pointer">Personalizar</button>
            </div>

            <div class="grid md:grid-cols-2 gap-6">
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Tema del Widget</label>
                <div class="grid grid-cols-3 gap-2">
                  <button 
                    v-for="theme in themes" 
                    :key="theme.id"
                    @click="selectedTheme = theme.id"
                    class="p-3 rounded-xl border-2 text-center transition-all cursor-pointer"
                    :class="selectedTheme === theme.id ? 'border-cyan bg-cyan/5' : 'border-border hover:border-gray-300'"
                  >
                    <div class="w-6 h-6 rounded-full mx-auto mb-1" :class="theme.color"></div>
                    <div class="text-[10px] font-bold">{{ theme.name }}</div>
                  </button>
                </div>
              </div>

              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Posición en la Web</label>
                <select v-model="widgetPosition" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan cursor-pointer">
                  <option value="corner">Esquina inferior derecha</option>
                  <option value="center">Centro de pantalla</option>
                  <option value="inline">Integrado en página</option>
                  <option value="popup">Popup al cargar</option>
                </select>
              </div>

              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Moneda</label>
                <select v-model="currency" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan cursor-pointer">
                  <option value="USD">USD - Dólar</option>
                  <option value="DOP">DOP - Peso Dominicano</option>
                  <option value="MXN">MXN - Peso Mexicano</option>
                  <option value="COP">COP - Peso Colombiano</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>

              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Idioma</label>
                <select v-model="language" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan cursor-pointer">
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
                  <input type="checkbox" v-model="options.instantConfirmation" class="w-4 h-4 text-cyan rounded" />
                  <div>
                    <div class="text-sm font-bold text-navy">Confirmación Instantánea</div>
                    <div class="text-[10px] text-text-muted">Sin intervención manual</div>
                  </div>
                </label>
                <label class="flex items-center gap-3 p-3 bg-surface rounded-xl cursor-pointer">
                  <input type="checkbox" v-model="options.payNow" class="w-4 h-4 text-cyan rounded" />
                  <div>
                    <div class="text-sm font-bold text-navy">Pago en Línea</div>
                    <div class="text-[10px] text-text-muted">Stripe / PayPal</div>
                  </div>
                </label>
                <label class="flex items-center gap-3 p-3 bg-surface rounded-xl cursor-pointer">
                  <input type="checkbox" v-model="options.googleHotel" class="w-4 h-4 text-cyan rounded" />
                  <div>
                    <div class="text-sm font-bold text-navy">Google Hotel Ads</div>
                    <div class="text-[10px] text-text-muted">Sincronizar tarifas</div>
                  </div>
                </label>
                <label class="flex items-center gap-3 p-3 bg-surface rounded-xl cursor-pointer">
                  <input type="checkbox" v-model="options.whatsappConfirmation" class="w-4 h-4 text-cyan rounded" />
                  <div>
                    <div class="text-sm font-bold text-navy">Confirmación WhatsApp</div>
                    <div class="text-[10px] text-text-muted">Envío automático</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Recent Bookings -->
          <div class="bg-white rounded-2xl border border-border p-6">
            <h2 class="text-lg font-black text-navy mb-4">Últimas Reservas Directas</h2>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-border">
                    <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Huésped</th>
                    <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Habitación</th>
                    <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Fechas</th>
                    <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Monto</th>
                    <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Fuente</th>
                    <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="booking in recentBookings" :key="booking.id" class="border-b border-border/50 hover:bg-surface/50 transition-colors">
                    <td class="py-3">
                      <div class="text-sm font-bold text-navy">{{ booking.guest }}</div>
                      <div class="text-[10px] text-text-muted">{{ booking.email }}</div>
                    </td>
                    <td class="py-3 text-sm text-navy">{{ booking.room }}</td>
                    <td class="py-3">
                      <div class="text-xs text-navy">{{ booking.checkIn }}</div>
                      <div class="text-[10px] text-text-muted">→ {{ booking.checkOut }}</div>
                    </td>
                    <td class="py-3 text-sm font-bold text-navy">${{ booking.amount }}</td>
                    <td class="py-3">
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="sourceClass(booking.source)">
                        {{ booking.source }}
                      </span>
                    </td>
                    <td class="py-3">
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="statusClass(booking.status)">
                        {{ booking.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
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

          <!-- Room Types Preview -->
          <div class="bg-white rounded-2xl border border-border p-6">
            <h3 class="text-sm font-black text-navy mb-4">Room Types</h3>
            <div class="grid grid-cols-2 gap-3">
              <div v-for="rt in roomTypes" :key="rt.id" class="bg-surface rounded-xl p-3 border" :class="'border-' + themeBorder">
                <div class="text-sm font-bold text-navy">{{ rt.number || 'Room' }}</div>
                <div class="text-[10px] text-text-muted capitalize">{{ rt.type }}</div>
                <div class="text-xs font-black mt-1" :class="'text-' + themeColor">${{ rt.basePrice }}/night</div>
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
import { OperationsService } from '@/services/Operations.service'
import { ReservationService } from '@/services/Reservation.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const selectedTheme = ref('navy')
const widgetPosition = ref('corner')
const currency = ref('USD')
const language = ref('es')
const copied = ref(false)

const options = reactive({
  instantConfirmation: true,
  payNow: true,
  googleHotel: true,
  whatsappConfirmation: false,
})

const themes = [
  { id: 'navy', name: 'Navy', color: 'bg-navy' },
  { id: 'cyan', name: 'Cyan', color: 'bg-cyan' },
  { id: 'teal', name: 'Teal', color: 'bg-teal' },
  { id: 'white', name: 'Claro', color: 'bg-white border border-gray-200' },
  { id: 'dark', name: 'Oscuro', color: 'bg-gray-800' },
]

const engineData = ref<Awaited<ReturnType<typeof OperationsService.bookingEngine>> | null>(null)
const hotelSlug = computed(() => engineData.value?.hotel?.name?.toLowerCase().replace(/\s+/g, '-') ?? 'mi-hotel')

const themeColor = computed(() => ({ navy: 'navy', cyan: 'cyan', teal: 'teal', white: 'navy', dark: 'white' })[selectedTheme.value] || 'navy')
const themeBorder = computed(() => ({ navy: 'navy/20', cyan: 'cyan/20', teal: 'teal/20', white: 'gray-200', dark: 'gray-600' })[selectedTheme.value] || 'navy/20')
const themeBg = computed(() => ({ navy: 'bg-navy', cyan: 'bg-cyan', teal: 'bg-teal', white: 'bg-white', dark: 'bg-gray-800' })[selectedTheme.value] || 'bg-navy')

const embedCode = computed(() =>
  `<div id="managerhotel-widget"\n` +
  `  data-hotel="${hotelSlug.value}"\n` +
  `  data-theme="${selectedTheme.value}"\n` +
  `  data-position="${widgetPosition.value}"\n` +
  `  data-currency="${currency.value}"\n` +
  `  data-lang="${language.value}">\n` +
  `</div>`
)

const roomTypes = computed(() => engineData.value?.roomTypes ?? [])
const recentBookings = ref<any[]>([])

function sourceClass(source: string) {
  return source === 'Direct' ? 'bg-teal/10 text-teal' : 'bg-cyan/10 text-cyan'
}

function statusLabel(status: string) {
  const map: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', checked_in: 'Checked-in', checked_out: 'Checked-out', cancelled: 'Cancelled' }
  return map[status] || status
}

function statusClass(status: string) {
  const map: Record<string, string> = { pending: 'bg-gold/10 text-gold', confirmed: 'bg-teal/10 text-teal', checked_in: 'bg-cyan/10 text-cyan' }
  return map[status] || 'bg-surface text-text-muted'
}

async function saveConfig() {
  try {
    const { ConfigService } = await import('@/services/Platform.service')
    await ConfigService.set('booking_engine_config', { selectedTheme: selectedTheme.value, widgetPosition: widgetPosition.value, currency: currency.value, language: language.value, options: { ...options } }, hotelId.value)
    toast.success('Configuración guardada')
  } catch { toast.error('Error al guardar') }
}

onMounted(async () => {
  try {
    engineData.value = await OperationsService.bookingEngine(hotelId.value)
    
    // Load saved config
    try {
      const { ConfigService } = await import('@/services/Platform.service')
      const saved = await ConfigService.get('booking_engine_config', hotelId.value)
      if (saved) {
        if (saved.selectedTheme) selectedTheme.value = saved.selectedTheme
        if (saved.widgetPosition) widgetPosition.value = saved.widgetPosition
        if (saved.currency) currency.value = saved.currency
        if (saved.language) language.value = saved.language
        if (saved.options) Object.assign(options, saved.options)
      }
    } catch {}
    
    const { GuestService } = await import('@/services/Guest.service')
    const { RoomService } = await import('@/services/Room.service')
    const [resResult, guestsResult, roomsResult] = await Promise.all([
      ReservationService.list({ hotelId: hotelId.value }),
      GuestService.list({ hotelId: hotelId.value }).catch(() => ({ guests: [], total: 0 })),
      RoomService.list({ hotelId: hotelId.value }).catch(() => ({ rooms: [], total: 0 })),
    ])
    const guestMap = new Map((guestsResult.guests || []).map((g: any) => [g.id, g]))
    const roomMap = new Map((roomsResult.rooms || []).map((r: any) => [r.id, r]))
    recentBookings.value = resResult.reservations.map(r => {
      const guest = guestMap.get(r.guestId)
      const room = roomMap.get(r.roomId)
      return {
        id: r.id, guest: guest?.name ?? 'Guest', email: guest?.email ?? '',
        room: room?.number ?? '—',
        checkIn: String(r.checkIn).slice(5, 10), checkOut: String(r.checkOut).slice(5, 10),
        amount: String(r.totalAmount), source: r.source === 'direct' ? 'Direct' : 'OTA',
        status: statusLabel(r.status),
      }
    })
  } catch { }
})

function copyCode() {
  const code = '<script src="https://widget.managerhotel.com/loader.js"\n' +
    '  data-hotel="' + hotelSlug.value + '"\n' +
    '  data-theme="' + selectedTheme.value + '"\n' +
    '  data-position="' + widgetPosition.value + '"\n' +
    '  data-currency="' + currency.value + '">\n' +
    '<' + '/script>'
  navigator.clipboard.writeText(code)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}
</script>
