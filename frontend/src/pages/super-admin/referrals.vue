<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-black text-navy">Programa de Referidos</h1>
        <p class="text-sm text-text-muted">Un hotel recomienda SOLMI OS a otro — 100% configurable, sin deploy</p>
      </div>
      <label class="flex items-center gap-2 text-sm font-bold text-text-secondary cursor-pointer">
        <input type="checkbox" :checked="program.enabled" @change="toggleEnabled" class="accent-cyan w-5 h-5" />
        {{ program.enabled ? 'Activado' : 'Desactivado' }}
      </label>
    </div>

    <SkeletonLoader v-if="loading" variant="card" :rows="3" class="mb-8" />
    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-2xl border border-border card-shadow p-5">
          <div class="text-2xl font-black text-navy">{{ metrics.totalReferrals }}</div>
          <div class="text-[11px] text-text-muted">referidos totales</div>
        </div>
        <div class="bg-white rounded-2xl border border-border card-shadow p-5">
          <div class="text-2xl font-black text-teal">{{ metrics.validatedCount }}</div>
          <div class="text-[11px] text-text-muted">validados ({{ metrics.conversionPct }}%)</div>
        </div>
        <div class="bg-white rounded-2xl border border-border card-shadow p-5">
          <div class="text-2xl font-black text-navy">{{ metrics.totalMonthsGranted }}</div>
          <div class="text-[11px] text-text-muted">meses de crédito otorgados</div>
        </div>
        <div class="bg-white rounded-2xl border border-border card-shadow p-5">
          <div class="text-2xl font-black text-navy">{{ metrics.topReferrers[0]?.hotelName ?? '—' }}</div>
          <div class="text-[11px] text-text-muted">top referidor{{ metrics.topReferrers[0] ? ` (${metrics.topReferrers[0].validatedCount})` : '' }}</div>
        </div>
      </div>

      <SectionCard title="Reglas del programa" subtitle="Validación, tope y ventana de clawback">
        <form @submit.prevent="saveProgram" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Nombre del programa</label>
            <input v-model="form.programName" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Meses activo para validar</label>
            <input v-model.number="form.activeMonthsRequired" type="number" min="1" max="60" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Días de ventana de clawback</label>
            <input v-model.number="form.clawbackWindowDays" type="number" min="0" max="365" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Tope de meses acumulables</label>
            <input v-model.number="form.maxAccumulatedMonths" type="number" min="0" max="240" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">% descuento bienvenida referido</label>
            <input v-model.number="form.referredRewardValue" type="number" min="0" max="100" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
          </div>
          <div class="flex items-end">
            <label class="flex items-center gap-2 text-sm font-bold text-text-secondary cursor-pointer">
              <input v-model="form.requirePaidStatus" type="checkbox" class="accent-cyan" />
              Exigir pago al día (no cuenta en gracia)
            </label>
          </div>
          <div class="md:col-span-3">
            <button type="submit" :disabled="savingProgram" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">
              {{ savingProgram ? 'Guardando...' : 'Guardar reglas' }}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Tramos escalonados" subtitle="Meses que suma cada referido validado, según cuántos ya tiene el referidor" class="mt-6">
        <template #actions>
          <button type="button" @click="openNewTier" class="bg-cyan text-navy font-extrabold text-xs px-4 py-2 rounded-lg hover:shadow-lg transition-all cursor-pointer">+ Tramo</button>
        </template>
        <SkeletonLoader v-if="loadingTiers" variant="table" :rows="3" />
        <EmptyState v-else-if="!tiers.length" title="Sin tramos configurados" message="Sin tramos, el programa no otorga meses aunque un referido valide." />
        <table v-else class="w-full tbl-head">
          <thead><tr class="border-b border-border">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Desde el referido nº</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Meses otorgados</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr></thead>
          <tbody>
            <tr v-for="t in tiers" :key="t.id" class="border-b border-border last:border-0">
              <td class="p-4 text-sm font-bold text-navy">{{ t.fromCount }}</td>
              <td class="p-4 text-sm">{{ t.monthsGranted }}</td>
              <td class="p-4 text-right space-x-2">
                <button type="button" @click="openEditTier(t)" class="px-3 py-1.5 bg-surface border border-border rounded-lg text-[11px] font-bold text-navy hover:bg-surface-dark transition-colors cursor-pointer">Editar</button>
                <button type="button" @click="removeTier(t)" class="px-3 py-1.5 bg-danger/10 text-danger rounded-lg text-[11px] font-bold hover:bg-danger/20 transition-colors cursor-pointer">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="tiers.length" class="mt-4 p-3 bg-surface rounded-xl text-xs text-text-secondary">
          Ejemplo: refiere 3 hoteles Starter → {{ previewExample }}
        </div>
      </SectionCard>

      <SectionCard v-if="metrics.topReferrers.length" title="Top referidores" class="mt-6">
        <table class="w-full tbl-head">
          <thead><tr class="border-b border-border">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Hotel</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Referidos validados</th>
          </tr></thead>
          <tbody>
            <tr v-for="r in metrics.topReferrers" :key="r.hotelId" class="border-b border-border last:border-0">
              <td class="p-4 text-sm font-bold text-navy">{{ r.hotelName }}</td>
              <td class="p-4 text-sm">{{ r.validatedCount }}</td>
            </tr>
          </tbody>
        </table>
      </SectionCard>
    </template>

    <AppModal v-if="showTierModal" size="sm" :title="`${editingTier ? 'Editar' : 'Nuevo'} tramo`" @close="showTierModal=false">
      <div class="space-y-4">
        <div>
          <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Desde el referido nº</label>
          <input v-model.number="tierForm.fromCount" type="number" min="1" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Meses otorgados</label>
          <input v-model.number="tierForm.monthsGranted" type="number" min="0" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
        </div>
      </div>
      <template #footer>
        <button @click="showTierModal=false" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
        <button @click="saveTier" :disabled="savingTier" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">{{ savingTier ? 'Guardando...' : 'Guardar' }}</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { ReferralsAdminService, type ReferralProgram, type ReferralTier, type ReferralMetrics } from '@/services/ReferralsAdmin.service'

const toast = useToast()
const loading = ref(true)
const loadingTiers = ref(true)
const savingProgram = ref(false)
const savingTier = ref(false)

const emptyProgram = (): ReferralProgram => ({
  enabled: false, programName: '', activeMonthsRequired: 3, requirePaidStatus: true,
  referredRewardValue: 100, maxAccumulatedMonths: 12, creditExpiresMonths: 12, clawbackWindowDays: 30,
})
const program = ref<ReferralProgram>(emptyProgram())
const form = ref<ReferralProgram>(emptyProgram())
const tiers = ref<ReferralTier[]>([])
const metrics = ref<ReferralMetrics>({ totalReferrals: 0, validatedCount: 0, conversionPct: 0, totalMonthsGranted: 0, topReferrers: [] })

const showTierModal = ref(false)
const editingTier = ref<ReferralTier | null>(null)
const tierForm = ref({ fromCount: 1, monthsGranted: 1 })

const previewExample = computed(() => {
  const applicable = [...tiers.value].filter((t) => t.fromCount <= 3).sort((a, b) => b.fromCount - a.fromCount)
  const months = applicable[0]?.monthsGranted ?? 0
  return months > 0 ? `${months} ${months === 1 ? 'mes gratis' : 'meses gratis'} de su suscripción` : 'todavía no suma nada (falta un tramo desde el 3)'
})

async function loadAll() {
  loading.value = true
  loadingTiers.value = true
  try {
    const [p, t, m] = await Promise.all([
      ReferralsAdminService.getProgram(), ReferralsAdminService.listTiers(), ReferralsAdminService.getMetrics(),
    ])
    program.value = p
    form.value = { ...p }
    tiers.value = t.data ?? []
    metrics.value = m
  } catch (e: any) {
    toast.error(e.message || 'No se pudo cargar el programa de referidos')
  } finally {
    loading.value = false
    loadingTiers.value = false
  }
}

async function toggleEnabled() {
  try {
    program.value = await ReferralsAdminService.updateProgram({ enabled: !program.value.enabled })
    form.value.enabled = program.value.enabled
    toast.success(program.value.enabled ? 'Programa activado' : 'Programa desactivado')
  } catch (e: any) {
    toast.error(e.message || 'No se pudo actualizar')
  }
}

async function saveProgram() {
  savingProgram.value = true
  try {
    program.value = await ReferralsAdminService.updateProgram(form.value)
    toast.success('Reglas actualizadas')
  } catch (e: any) {
    toast.error(e.message || 'No se pudieron guardar las reglas')
  } finally {
    savingProgram.value = false
  }
}

function openNewTier() {
  editingTier.value = null
  tierForm.value = { fromCount: (tiers.value[tiers.value.length - 1]?.fromCount ?? 0) + 1, monthsGranted: 1 }
  showTierModal.value = true
}
function openEditTier(t: ReferralTier) {
  editingTier.value = t
  tierForm.value = { fromCount: t.fromCount, monthsGranted: t.monthsGranted }
  showTierModal.value = true
}
async function saveTier() {
  savingTier.value = true
  try {
    if (editingTier.value) await ReferralsAdminService.updateTier(editingTier.value.id, tierForm.value)
    else await ReferralsAdminService.createTier(tierForm.value)
    toast.success('Tramo guardado')
    showTierModal.value = false
    const { data } = await ReferralsAdminService.listTiers()
    tiers.value = data ?? []
  } catch (e: any) {
    toast.error(e.message || 'No se pudo guardar el tramo')
  } finally {
    savingTier.value = false
  }
}
async function removeTier(t: ReferralTier) {
  try {
    await ReferralsAdminService.deleteTier(t.id)
    tiers.value = tiers.value.filter((x) => x.id !== t.id)
    toast.success('Tramo eliminado')
  } catch (e: any) {
    toast.error(e.message || 'No se pudo eliminar el tramo')
  }
}

onMounted(loadAll)
</script>
