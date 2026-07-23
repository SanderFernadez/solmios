<script setup lang="ts">
// pages/restaurante/cobrar.vue — Liquidación de la comanda (RES-7). Dos vías EXCLUYENTES: cargo a la
// habitación (folio, sin propina) o cobro directo (payment, con propina). La propina se persiste con
// billOrder antes del cobro directo; el backend recalcula y cobra el total bruto. Ver settlement.ts.
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  RestaurantService,
  type OrderWithLines,
  ORDER_STATUS_LABELS, ORDER_TYPE_LABELS,
} from '@/services/Restaurant.service'
import { SettingsService } from '@/services/Settings.service'
import { currencySymbol } from '@/composables/useCurrency'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { usePermissions } from '@/composables/usePermissions'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { can } = usePermissions()
const orderId = computed(() => String(route.params.id))
const canPay = computed(() => can('restaurant', 'edit'))

const loading = ref(true)
const busy = ref(false)
const order = ref<OrderWithLines | null>(null)
const currency = ref('USD')
const tip = ref(0)
const method = ref('cash')
const reservationId = ref('')

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
]
const TIP_PRESETS = [0, 0.1, 0.15, 0.2]

const SETTLED = ['charged', 'paid']
const settled = computed(() => !!order.value && SETTLED.includes(order.value.status))
const cancelled = computed(() => order.value?.status === 'cancelled')
const money = (n: number): string => `${currencySymbol(currency.value)}${Number(n || 0).toFixed(2)}`

// Subtotal/impuesto vienen del backend; la propina es editable y NO se grava. Total = subtotal + tax + tip.
const previewTotal = computed(() => {
  const o = order.value
  if (!o) return 0
  return Math.round((Number(o.subtotal || 0) + Number(o.tax || 0) + Number(tip.value || 0)) * 100) / 100
})
const canChargeRoom = computed(() => !!order.value && (!!reservationId.value.trim() || !!order.value.reservationId))

function applyTipPreset(pct: number) {
  const base = Number(order.value?.subtotal || 0)
  tip.value = Math.round(base * pct * 100) / 100
}

async function load() {
  loading.value = true
  try {
    const [ord, settings] = await Promise.all([
      RestaurantService.getOrder(orderId.value),
      SettingsService.get().catch(() => null),
    ])
    order.value = ord
    tip.value = Number(ord.tip || 0)
    reservationId.value = ord.reservationId || ''
    currency.value = (settings as any)?.hotel?.currency || 'USD'
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'No se pudo cargar la comanda')
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function payDirect() {
  if (!canPay.value || busy.value || !order.value) return
  if (previewTotal.value <= 0) { toast.warning('La comanda no tiene monto para cobrar'); return }
  busy.value = true
  try {
    // Persistir la propina (billOrder la fija y deja la comanda en `billed`), luego cobrar el total bruto.
    await RestaurantService.billOrder(orderId.value, { tip: Number(tip.value) || 0 })
    await RestaurantService.payOrder(orderId.value, { method: method.value })
    toast.success('Comanda cobrada')
    router.push('/panel/restaurante/salon')
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'No se pudo cobrar')
    await load()
  } finally {
    busy.value = false
  }
}

async function chargeRoom() {
  if (!canPay.value || busy.value || !order.value) return
  if (Number(tip.value) > 0) { toast.warning('El cargo a habitación no incluye propina. Quitala o cobrá directo.'); return }
  busy.value = true
  try {
    const rid = reservationId.value.trim() || order.value.reservationId
    await RestaurantService.chargeToRoom(orderId.value, { reservationId: rid || undefined })
    toast.success('Cargado a la habitación')
    router.push('/panel/restaurante/salon')
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'No se pudo cargar a la habitación')
    await load()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-2xl mx-auto">
    <div v-if="loading" class="py-20 text-center text-text-muted">Cargando…</div>

    <template v-else-if="order">
      <header class="mb-4">
        <router-link :to="`/panel/restaurante/comanda/${orderId}`" class="text-xs font-bold text-navy hover:underline">← Comanda</router-link>
        <h1 class="text-xl sm:text-2xl font-black text-navy mt-1">Cobrar {{ order.number || '' }}</h1>
        <p class="text-sm text-text-muted">{{ ORDER_TYPE_LABELS[order.type] }} · <span class="font-bold">{{ ORDER_STATUS_LABELS[order.status] }}</span></p>
      </header>

      <div v-if="cancelled">
        <EmptyState title="Comanda cancelada" message="Una comanda cancelada no se puede cobrar." />
      </div>
      <div v-else-if="settled">
        <SectionCard title="Comanda liquidada">
          <div class="py-6 text-center">
            <p class="text-navy font-bold">
              {{ order.status === 'paid' ? 'Cobrada directamente.' : 'Cargada a la habitación.' }}
            </p>
            <p class="text-2xl font-black text-navy mt-2 tabular-nums">{{ money(order.total) }}</p>
            <router-link to="/panel/restaurante/salon" class="inline-block mt-4 px-4 py-2 rounded-lg bg-navy text-white text-sm font-bold">Volver al salón</router-link>
          </div>
        </SectionCard>
      </div>

      <template v-else>
        <!-- Desglose -->
        <SectionCard title="Cuenta" class="mb-4">
          <div class="divide-y divide-border mb-3">
            <div v-for="l in order.lines" :key="l.id" class="py-2 flex justify-between text-sm">
              <span class="text-navy">{{ l.quantity }}× {{ l.name }}</span>
              <span class="tabular-nums text-text-muted">{{ money(l.lineTotal) }}</span>
            </div>
          </div>
          <div class="space-y-1.5 text-sm">
            <div class="flex justify-between text-text-muted"><span>Subtotal</span><span class="tabular-nums">{{ money(order.subtotal) }}</span></div>
            <div class="flex justify-between text-text-muted"><span>Impuesto</span><span class="tabular-nums">{{ money(order.tax) }}</span></div>
            <div class="flex justify-between text-text-muted"><span>Propina</span><span class="tabular-nums">{{ money(tip) }}</span></div>
            <div class="flex justify-between text-navy font-black text-lg pt-1 border-t-2 border-navy/10"><span>Total</span><span class="tabular-nums">{{ money(previewTotal) }}</span></div>
          </div>
        </SectionCard>

        <!-- Propina (solo cobro directo) -->
        <SectionCard title="Propina" subtitle="Aplica al cobro directo. El cargo a habitación no la incluye." class="mb-4">
          <div class="flex flex-wrap items-center gap-2">
            <button v-for="p in TIP_PRESETS" :key="p" @click="applyTipPreset(p)"
              class="px-3 py-1.5 rounded-lg border-2 border-border text-navy text-xs font-bold hover:bg-surface">
              {{ p === 0 ? 'Sin propina' : `${p * 100}%` }}
            </button>
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-text-muted">Monto</span>
              <input v-model.number="tip" type="number" min="0" step="0.01"
                class="w-24 px-2 py-1.5 rounded-lg border-2 border-border text-sm text-navy focus:border-navy focus:outline-none tabular-nums" />
            </div>
          </div>
        </SectionCard>

        <!-- Cobro directo -->
        <SectionCard title="Cobro directo" class="mb-4">
          <div class="flex flex-wrap gap-2 mb-3">
            <button v-for="m in PAYMENT_METHODS" :key="m.value" @click="method = m.value"
              :class="['px-3 py-1.5 rounded-lg text-sm font-bold border-2', method === m.value ? 'bg-navy text-white border-navy' : 'border-border text-navy hover:bg-surface']">
              {{ m.label }}
            </button>
          </div>
          <button @click="payDirect" :disabled="!canPay || busy"
            class="w-full py-3 rounded-xl bg-teal text-white font-black hover:bg-teal/80 disabled:opacity-50">
            Cobrar {{ money(previewTotal) }}
          </button>
        </SectionCard>

        <!-- Cargo a habitación -->
        <SectionCard title="Cargar a habitación" subtitle="Suma el consumo neto al folio de una reserva. Sin propina.">
          <label class="block text-xs font-bold text-text-muted mb-1">ID de reserva</label>
          <input v-model="reservationId" type="text" placeholder="Reserva asociada (si la comanda ya la tiene, se usa esa)"
            class="w-full px-3 py-2 rounded-lg border-2 border-border text-sm text-navy focus:border-navy focus:outline-none mb-3" />
          <button @click="chargeRoom" :disabled="!canPay || busy || !canChargeRoom"
            class="w-full py-3 rounded-xl bg-navy text-white font-black hover:bg-navy-light disabled:opacity-50">
            Cargar {{ money(order.subtotal) }} al folio
          </button>
          <p v-if="!canChargeRoom" class="text-[11px] text-text-muted mt-2">La comanda no tiene reserva asociada. Ingresá un ID de reserva o cobrá directo.</p>
        </SectionCard>
      </template>
    </template>

    <EmptyState v-else title="Comanda no encontrada" message="La comanda no existe o no tenés acceso." />
  </div>
</template>
