<template>
  <div>
    <!-- Planes: catálogo real (/admin/plans). Solo lectura acá — crear/editar plan vive en
         "+ Nuevo Plan" del menú (pages/admin/plans, PlansService.create/update). -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <SkeletonLoader v-if="loading" variant="card" :rows="3" class="col-span-3" />
      <EmptyState
        v-else-if="!plans.length"
        title="Todavía no hay planes creados"
        message="Creá el primer plan desde “Crear Plan” en el menú."
        class="col-span-3"
      />
      <div v-for="plan in plans" :key="plan.id" class="bg-white rounded-2xl border border-border card-shadow p-6">
        <h3 class="text-lg font-black text-navy mb-2">{{ plan.name }}</h3>
        <div class="text-3xl font-black text-teal mb-2">${{ plan.price }}<span class="text-sm text-text-muted">/mes</span></div>
        <div v-if="plan.description" class="text-sm text-text-secondary mb-4">{{ plan.description }}</div>
        <div class="space-y-2 mb-6">
          <div v-for="(feature, i) in plan.features" :key="i" class="flex items-center gap-2 text-sm">
            <span class="text-teal">✓</span><span>{{ feature }}</span>
          </div>
        </div>
        <div class="flex items-center justify-between pt-4 border-t border-border">
          <div>
            <div class="text-2xl font-black text-navy">{{ subscriberCount(plan.id) }}</div>
            <div class="text-[10px] text-text-muted">suscriptores</div>
          </div>
          <div class="text-right">
            <div class="text-sm font-bold text-teal">${{ planMrr(plan).toLocaleString() }}/mes</div>
            <div class="text-[10px] text-text-muted">MRR activo</div>
          </div>
        </div>
      </div>
    </div>

    <SectionCard title="Suscripciones por hotel" :subtitle="`${subscriptions.length} hoteles · MRR total $${mrrTotal.toLocaleString()}/mes`">
      <template #actions>
        <div class="flex items-center gap-2">
          <router-link to="/admin/subscriptions/founders-pioneers"
            class="h-9 px-4 flex items-center rounded-lg border border-white/20 text-white text-xs font-bold hover:bg-white/10 transition-colors">
            Cupos Fundador/Pionero
          </router-link>
          <div class="relative">
            <input v-model="searchQuery" type="text" placeholder="Buscar hotel..." class="w-56 h-9 pl-9 pr-4 rounded-lg border border-white/20 text-sm bg-white/10 text-white placeholder-white/50 focus:outline-none focus:border-cyan">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
          <form @submit.prevent="searchByEmail" class="flex items-center gap-2">
            <input v-model="emailQuery" type="email" placeholder="Email de la cuenta..." class="w-56 h-9 px-3 rounded-lg border border-white/20 text-sm bg-white/10 text-white placeholder-white/50 focus:outline-none focus:border-cyan">
            <button type="submit" :disabled="searchingByEmail || !emailQuery"
              class="h-9 px-4 bg-cyan text-navy font-extrabold text-xs rounded-lg hover:shadow-lg transition-all cursor-pointer disabled:opacity-50">
              {{ searchingByEmail ? 'Buscando...' : 'Condiciones especiales' }}
            </button>
          </form>
        </div>
      </template>

      <SkeletonLoader v-if="loading" variant="table" :rows="6" />
      <EmptyState
        v-else-if="!filteredSubscriptions.length"
        title="Sin resultados"
        message="Ningún hotel coincide con la búsqueda."
      />
      <table v-else class="w-full tbl-head">
        <thead><tr class="border-b border-border">
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Hotel</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Plan</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Categoría</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Vence / renueva</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Facturación</th>
          <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
        </tr></thead>
        <tbody>
          <tr v-for="row in filteredSubscriptions" :key="row.hotelId" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
            <td class="p-4 text-sm font-bold text-navy">{{ row.hotelName }}</td>
            <td class="p-4">
              <span v-if="row.planName" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-navy/10 text-navy">{{ row.planName }}</span>
              <span v-else class="text-xs text-text-muted">—</span>
            </td>
            <td class="p-4">
              <span v-if="row.specialCategory" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/10 text-warning">{{ categoryLabel(row.specialCategory) }}</span>
              <span v-else class="text-xs text-text-muted">—</span>
            </td>
            <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span></td>
            <td class="p-4 text-sm text-text-muted">{{ periodLabel(row) }}</td>
            <td class="p-4 text-sm">
              <span v-if="row.hasStripeCustomer" class="text-teal font-bold">Stripe conectado</span>
              <span v-else class="text-text-muted">Sin cobrar todavía</span>
            </td>
            <td class="p-4 text-right">
              <button type="button" @click="openConditions(row.hotelId, row.hotelName)"
                class="px-3 py-1.5 bg-surface border border-border rounded-lg text-[11px] font-bold text-navy hover:bg-surface-dark transition-colors cursor-pointer">
                Condiciones especiales
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </SectionCard>

    <SpecialConditionsModal v-if="conditionsTarget" :hotel-id="conditionsTarget.hotelId" :hotel-name="conditionsTarget.hotelName"
      @close="conditionsTarget = null" @saved="onConditionsSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { PlatformService } from '@/services/Platform.service'
import { PlansService, type Plan } from '@/services/Plans.service'
import { SubscriptionsAdminService, type SpecialCategoryKey } from '@/services/SubscriptionsAdmin.service'
import SectionCard from '@/components/ui/SectionCard.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SpecialConditionsModal from '@/components/features/SpecialConditionsModal.vue'

/** Fila real de GET /api/admin/subscriptions (dashboard-queries.ts:listSubscriptions —
 * cruce de Hotels + Subscriptions + Plans, no el `hotels.plan` de texto libre). */
interface SubscriptionRow {
  hotelId: string
  hotelName: string
  status: string
  planId: string
  planName: string
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  canceledAt: string | null
  hasStripeCustomer: boolean
  mrr: number
  specialCategory?: SpecialCategoryKey | null
}

const toast = useToast()
const searchQuery = ref('')
const emailQuery = ref('')
const searchingByEmail = ref(false)
const loading = ref(true)
const plans = ref<Plan[]>([])
const subscriptions = ref<SubscriptionRow[]>([])
const conditionsTarget = ref<{ hotelId: string; hotelName: string } | null>(null)
// El envelope del framework (buildEnvelope en kernel/http/server.ts) solo deja pasar
// `data`+`meta.pagination` cuando el body trae un array `data` con `total` — cualquier otra
// clave del body (acá, `mrrTotal`) se descarta antes de llegar al fetch. Se recalcula del
// lado del cliente sumando `mrr` de cada fila, que sí viaja dentro de `data`.
const mrrTotal = computed(() => subscriptions.value.reduce((s, r) => s + Number(r.mrr || 0), 0))

const STATUS_LABELS: Record<string, string> = {
  trialing: 'En prueba', active: 'Activa', past_due: 'Pago pendiente',
  expired: 'Vencida', canceled: 'Cancelada', suspended: 'Suspendida', none: 'Sin suscripción',
}
const statusLabel = (s: string) => STATUS_LABELS[s] ?? s
const statusClass = (s: string) => ({
  active: 'bg-teal/10 text-teal',
  trialing: 'bg-cyan/10 text-cyan',
  past_due: 'bg-warning/10 text-warning',
  none: 'bg-surface text-text-muted',
}[s] ?? 'bg-danger/10 text-danger') // expired / canceled / suspended

const CATEGORY_LABELS: Record<string, string> = { founder_one: 'Fundador Uno', founder_two: 'Fundador Dos', pioneer: 'Pionero' }
const categoryLabel = (key?: string | null) => (key ? CATEGORY_LABELS[key] ?? key : '')

function openConditions(hotelId: string, hotelName: string) {
  conditionsTarget.value = { hotelId, hotelName }
}
function onConditionsSaved() {
  loadSubscriptions()
}
async function searchByEmail() {
  if (!emailQuery.value) return
  searchingByEmail.value = true
  try {
    const result = await SubscriptionsAdminService.search(emailQuery.value)
    conditionsTarget.value = { hotelId: result.hotelId, hotelName: result.hotelName }
  } catch (e: any) {
    toast.error(e.message || 'No se encontró ninguna cuenta con ese email')
  } finally {
    searchingByEmail.value = false
  }
}

function periodLabel(row: SubscriptionRow): string {
  const date = row.status === 'trialing' ? row.trialEndsAt : row.currentPeriodEnd
  return date ? new Date(date).toLocaleDateString('es-DO') : '—'
}

function subscriberCount(planId: string): number {
  return subscriptions.value.filter((s) => s.planId === planId && s.status === 'active').length
}
function planMrr(plan: Plan): number {
  return subscriberCount(plan.id) * Number(plan.price || 0)
}

const filteredSubscriptions = computed(() => {
  if (!searchQuery.value) return subscriptions.value
  const q = searchQuery.value.toLowerCase()
  return subscriptions.value.filter((s) => s.hotelName?.toLowerCase().includes(q))
})

async function loadSubscriptions() {
  loading.value = true
  try {
    const [plansRes, subsRes] = await Promise.all([
      PlansService.list(),
      PlatformService.subscriptions(),
    ])
    plans.value = plansRes.data ?? []
    subscriptions.value = subsRes.data ?? []
  } catch {
    toast.error('No se pudieron cargar las suscripciones')
  } finally {
    loading.value = false
  }
}

onMounted(loadSubscriptions)
</script>
