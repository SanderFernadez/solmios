<script setup lang="ts">
// Cuentas por cobrar / pagar con aging (TES-6).
import { ref, onMounted } from 'vue'
import { TreasuryService, type Receivables, type Payables, type Aging } from '@/services/Treasury.service'
import { useToast } from '@/composables/useToast'
import { useCurrency } from '@/composables/useCurrency'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const toast = useToast()
const { format } = useCurrency()
const tab = ref<'ar' | 'ap'>('ar')
const ar = ref<Receivables | null>(null)
const ap = ref<Payables | null>(null)
const loading = ref(false)

const BUCKETS: (keyof Aging)[] = ['current', '1-30', '31-60', '61-90', '90+']
const bucketLabel: Record<keyof Aging, string> = { current: 'Corriente', '1-30': '1-30 d', '31-60': '31-60 d', '61-90': '61-90 d', '90+': '+90 d' }

async function load() {
  loading.value = true
  try {
    if (tab.value === 'ar' && !ar.value) ar.value = await TreasuryService.receivables()
    if (tab.value === 'ap' && !ap.value) ap.value = await TreasuryService.payables()
  } catch (e: any) { toast.error(e.message || 'Error al cargar') }
  finally { loading.value = false }
}
function switchTab(t: typeof tab.value) { tab.value = t; load() }

onMounted(load)
</script>

<template>
  <div>
    <div class="mb-6">
      <h2 class="text-xl font-black text-navy">Cuentas Corrientes</h2>
      <p class="text-sm text-text-muted mt-0.5">Lo que te deben los huéspedes (por cobrar) y lo que debés a proveedores (por pagar), por antigüedad.</p>
    </div>

    <div class="flex gap-2 mb-4">
      <button @click="switchTab('ar')" class="px-4 py-2 rounded-full text-sm font-bold cursor-pointer" :class="tab === 'ar' ? 'bg-navy text-white' : 'bg-navy/5 text-navy hover:bg-navy/10'">Por Cobrar (AR)</button>
      <button @click="switchTab('ap')" class="px-4 py-2 rounded-full text-sm font-bold cursor-pointer" :class="tab === 'ap' ? 'bg-navy text-white' : 'bg-navy/5 text-navy hover:bg-navy/10'">Por Pagar (AP)</button>
    </div>

    <div v-if="loading" class="p-8 text-center text-sm text-text-muted">Cargando…</div>

    <!-- AR -->
    <SectionCard v-else-if="tab === 'ar' && ar" title="Cuentas por Cobrar" :subtitle="`Total: ${format(ar.total)}`" body-class="p-0">
      <EmptyState v-if="!ar.rows.length" title="Sin deuda de huéspedes" message="Todas las facturas están cobradas." />
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[640px] tbl-head">
          <thead><tr>
            <th class="text-left px-4 py-3 text-[10px]">Huésped</th>
            <th v-for="b in BUCKETS" :key="b" class="text-right px-3 py-3 text-[10px]">{{ bucketLabel[b] }}</th>
            <th class="text-right px-4 py-3 text-[10px]">Total</th>
          </tr></thead>
          <tbody>
            <tr v-for="r in ar.rows" :key="r.guestId" class="border-b border-border last:border-0 hover:bg-surface/60">
              <td class="px-4 py-2.5 text-sm truncate max-w-[160px]">{{ r.guestId }}</td>
              <td v-for="b in BUCKETS" :key="b" class="px-3 py-2.5 text-sm text-right tabular-nums" :class="b === '90+' && r.aging[b] ? 'text-danger font-bold' : 'text-text-secondary'">{{ r.aging[b] ? format(r.aging[b]) : '—' }}</td>
              <td class="px-4 py-2.5 text-sm text-right tabular-nums font-bold text-navy">{{ format(r.outstanding) }}</td>
            </tr>
          </tbody>
          <tfoot><tr class="bg-surface font-bold text-navy"><td class="px-4 py-2.5 text-sm">Total</td><td v-for="b in BUCKETS" :key="b" class="px-3 py-2.5 text-sm text-right tabular-nums">{{ ar.aging[b] ? format(ar.aging[b]) : '—' }}</td><td class="px-4 py-2.5 text-sm text-right tabular-nums">{{ format(ar.total) }}</td></tr></tfoot>
        </table>
      </div>
    </SectionCard>

    <!-- AP -->
    <SectionCard v-else-if="tab === 'ap' && ap" title="Cuentas por Pagar" :subtitle="`Total: ${format(ap.total)}`" body-class="p-0">
      <EmptyState v-if="!ap.rows.length" title="Sin deuda a proveedores" message="No hay gastos impagos." />
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[640px] tbl-head">
          <thead><tr>
            <th class="text-left px-4 py-3 text-[10px]">Proveedor</th>
            <th v-for="b in BUCKETS" :key="b" class="text-right px-3 py-3 text-[10px]">{{ bucketLabel[b] }}</th>
            <th class="text-right px-4 py-3 text-[10px]">Total</th>
          </tr></thead>
          <tbody>
            <tr v-for="(r, i) in ap.rows" :key="i" class="border-b border-border last:border-0 hover:bg-surface/60">
              <td class="px-4 py-2.5 text-sm truncate max-w-[160px]">{{ r.provider }}</td>
              <td v-for="b in BUCKETS" :key="b" class="px-3 py-2.5 text-sm text-right tabular-nums" :class="b === '90+' && r.aging[b] ? 'text-danger font-bold' : 'text-text-secondary'">{{ r.aging[b] ? format(r.aging[b]) : '—' }}</td>
              <td class="px-4 py-2.5 text-sm text-right tabular-nums font-bold text-navy">{{ format(r.owed) }}</td>
            </tr>
          </tbody>
          <tfoot><tr class="bg-surface font-bold text-navy"><td class="px-4 py-2.5 text-sm">Total</td><td v-for="b in BUCKETS" :key="b" class="px-3 py-2.5 text-sm text-right tabular-nums">{{ ap.aging[b] ? format(ap.aging[b]) : '—' }}</td><td class="px-4 py-2.5 text-sm text-right tabular-nums">{{ format(ap.total) }}</td></tr></tfoot>
        </table>
      </div>
    </SectionCard>
  </div>
</template>

<style scoped></style>
