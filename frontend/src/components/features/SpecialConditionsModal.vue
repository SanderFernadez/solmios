<template>
  <AppModal size="lg" :title="`Condiciones especiales`" :subtitle="hotelName" @close="emit('close')">
    <SkeletonLoader v-if="loading" variant="card" :rows="3" />
    <div v-else class="space-y-5">
      <div class="bg-surface rounded-xl p-3 text-xs text-text-secondary flex flex-wrap gap-x-4 gap-y-1">
        <span>Plan actual: <strong class="text-navy">{{ (detail?.plan as any)?.name || '—' }}</strong></span>
        <span>Estado: <strong class="text-navy">{{ (detail?.subscription as any)?.status || '—' }}</strong></span>
        <span>Categoría: <strong class="text-navy">{{ categoryLabel(currentCategory) || 'Ninguna' }}</strong></span>
        <span v-if="activeDiscountPct">Descuento activo: <strong class="text-teal">{{ activeDiscountPct }}%</strong></span>
      </div>

      <div class="flex gap-1 border-b border-border">
        <button v-for="t in TABS" :key="t.key" type="button" @click="tab = t.key"
          class="px-4 py-2 text-sm font-bold border-b-2 -mb-px cursor-pointer transition-colors"
          :class="tab === t.key ? 'border-cyan text-navy' : 'border-transparent text-text-muted hover:text-text-secondary'">
          {{ t.label }}
        </button>
      </div>

      <!-- Categoría -->
      <div v-if="tab === 'category'" class="space-y-2">
        <label class="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-surface/50">
          <input type="radio" value="" v-model="selectedCategory" class="accent-cyan" />
          <span class="text-sm font-bold text-text-secondary">Ninguna (desasignar)</span>
        </label>
        <label v-for="c in categories" :key="c.key"
          class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
          :class="categoryEnabled(c) || c.key === currentCategory ? 'border-border hover:bg-surface/50' : 'border-border bg-surface opacity-60 cursor-not-allowed'">
          <input type="radio" :value="c.key" v-model="selectedCategory" class="accent-cyan mt-0.5"
            :disabled="!categoryEnabled(c) && c.key !== currentCategory" />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-bold text-navy">{{ categoryLabel(c.key) }} — {{ c.discountPct }}% off</div>
            <div class="text-xs text-text-muted">{{ c.occupiedCount }}/{{ c.totalSlots }} cupos · {{ STATUS_LABELS[c.status] }}</div>
            <div v-if="categoryDisabledReason(c) && c.key !== currentCategory" class="text-[11px] text-danger mt-1">{{ categoryDisabledReason(c) }}</div>
          </div>
        </label>
      </div>

      <!-- Descuento manual -->
      <div v-else-if="tab === 'percentage'" class="space-y-4">
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[10px] font-bold text-text-muted uppercase">Descuento</label>
            <span class="text-lg font-black text-teal">{{ discountPct }}%</span>
          </div>
          <input type="range" min="0" max="100" v-model.number="discountPct" class="w-full accent-cyan" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[10px] font-bold text-text-muted uppercase">Duración</label>
            <span class="text-sm font-black text-navy">{{ durationLabel }}</span>
          </div>
          <!-- Escala 1-13 (#514): 1-12 = meses, 13 = "De por vida". Nunca 100% permanente por
               defecto — el slider arranca en 1 mes, "de por vida" es una elección explícita. -->
          <input type="range" min="1" max="13" v-model.number="durationScale" class="w-full accent-cyan" />
          <div class="flex justify-between text-[9px] text-text-muted mt-1">
            <span>1 mes</span><span>12 meses</span><span>De por vida</span>
          </div>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Motivo</label>
          <textarea v-model="reason" rows="2" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm resize-none"></textarea>
        </div>
      </div>

      <!-- Mes gratis -->
      <div v-else class="text-sm text-text-secondary p-4 bg-surface rounded-xl">
        Aplica <strong>100% de descuento durante 1 mes</strong> sobre el plan actual del hotel.
      </div>
    </div>

    <template #footer>
      <button type="button" @click="emit('close')" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
      <button type="button" @click="apply" :disabled="applying || loading"
        class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">
        {{ applying ? 'Aplicando...' : 'Aplicar' }}
      </button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import { useToast } from '@/composables/useToast'
import {
  SubscriptionsAdminService, type SpecialCategoryConfig, type SpecialCategoryKey, type SubscriptionDetail,
} from '@/services/SubscriptionsAdmin.service'

const props = defineProps<{ hotelId: string; hotelName: string }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const toast = useToast()
const loading = ref(true)
const applying = ref(false)
const detail = ref<SubscriptionDetail | null>(null)
const categories = ref<SpecialCategoryConfig[]>([])

const TABS = [
  { key: 'category' as const, label: 'Categoría' },
  { key: 'percentage' as const, label: 'Descuento manual' },
  { key: 'free_month' as const, label: 'Mes gratis' },
]
const tab = ref<'category' | 'percentage' | 'free_month'>('category')

const selectedCategory = ref<SpecialCategoryKey | ''>('')
const discountPct = ref(10)
// Escala 1-13 del slider de duración (#514, reglas de negocio): 1-12 representan meses, 13 es
// "De por vida" (permanente — mismo `endsAt: null` que ya interpreta el backend cuando
// `durationMonths` no viene). Arranca en 1 mes, nunca en "de por vida" por defecto.
const DURATION_LIFETIME_SCALE = 13
const durationScale = ref(1)
const durationMonths = computed<number | null>(() => (durationScale.value >= DURATION_LIFETIME_SCALE ? null : durationScale.value))
const durationLabel = computed(() => (durationMonths.value == null ? 'De por vida' : `${durationMonths.value} ${durationMonths.value === 1 ? 'mes' : 'meses'}`))
const reason = ref('')

const CATEGORY_LABELS: Record<string, string> = { founder_one: 'Fundador Uno', founder_two: 'Fundador Dos', pioneer: 'Pionero' }
const STATUS_LABELS: Record<string, string> = { closed: 'Cerrada', open: 'Abierta', full: 'Llena' }
const categoryLabel = (key?: string | null) => (key ? CATEGORY_LABELS[key] ?? key : '')

const currentCategory = computed(() => ((detail.value?.subscription as any)?.specialCategory as string | null) ?? null)
const activeDiscountPct = computed(() => {
  const now = Date.now()
  const active = (detail.value?.discounts ?? []).filter((d) => d.status === 'active' && (!d.endsAt || new Date(d.endsAt).getTime() > now))
  return active.length ? Math.max(...active.map((d) => d.discountPct)) : null
})
const planSortOrder = computed(() => Number((detail.value?.plan as any)?.sortOrder ?? -1))
const lostCategories = computed(() => new Set((detail.value?.founderHistory ?? []).map((h) => h.category)))

function categoryDisabledReason(c: SpecialCategoryConfig): string {
  if (c.status !== 'open') return 'Categoría cerrada'
  if (c.occupiedCount >= c.totalSlots) return 'Sin cupo disponible'
  if (c.minPlanSortOrder != null && planSortOrder.value < c.minPlanSortOrder) return 'El plan actual no califica'
  if (lostCategories.value.has(c.key)) return 'Este hotel ya perdió esta categoría — no puede volver'
  return ''
}
function categoryEnabled(c: SpecialCategoryConfig): boolean {
  return !categoryDisabledReason(c)
}

async function load() {
  loading.value = true
  try {
    const [d, cats] = await Promise.all([
      SubscriptionsAdminService.detail(props.hotelId),
      SubscriptionsAdminService.listCategories(),
    ])
    detail.value = d
    categories.value = cats.data ?? []
    selectedCategory.value = (currentCategory.value as SpecialCategoryKey) ?? ''
  } catch (e: any) {
    toast.error(e.message || 'No se pudo cargar el detalle de la suscripción')
  } finally {
    loading.value = false
  }
}

async function apply() {
  applying.value = true
  try {
    if (tab.value === 'category') {
      await SubscriptionsAdminService.applySpecialConditions(props.hotelId, {
        type: 'category', category: selectedCategory.value || null,
      })
    } else if (tab.value === 'percentage') {
      await SubscriptionsAdminService.applySpecialConditions(props.hotelId, {
        type: 'percentage', discountPct: discountPct.value, durationMonths: durationMonths.value || null, reason: reason.value || undefined,
      })
    } else {
      await SubscriptionsAdminService.applySpecialConditions(props.hotelId, { type: 'free_month' })
    }
    toast.success('Condición especial aplicada')
    emit('saved')
    emit('close')
  } catch (e: any) {
    toast.error(e.message || 'No se pudo aplicar la condición especial')
  } finally {
    applying.value = false
  }
}

onMounted(load)
</script>
