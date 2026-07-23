<script setup lang="ts">
// Dashboard de tesorería (TES-6) — liquidez: flujo de caja + resumen AR/AP.
import { ref, onMounted } from 'vue'
import { TreasuryService, type CashFlow, type Receivables, type Payables } from '@/services/Treasury.service'
import { useToast } from '@/composables/useToast'
import { useCurrency } from '@/composables/useCurrency'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const toast = useToast()
const { format } = useCurrency()
const cf = ref<CashFlow | null>(null)
const ar = ref<Receivables | null>(null)
const ap = ref<Payables | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const [c, r, p] = await Promise.all([TreasuryService.cashFlow(undefined, undefined, 'month'), TreasuryService.receivables(), TreasuryService.payables()])
    cf.value = c; ar.value = r; ap.value = p
  } catch (e: any) { toast.error(e.message || 'Error al cargar la tesorería') }
  finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="mb-6">
      <h2 class="text-xl font-black text-navy">Tesorería — Liquidez</h2>
      <p class="text-sm text-text-muted mt-0.5">El flujo de caja del hotel y lo que te deben / debés.</p>
    </div>

    <div v-if="loading" class="p-8 text-center text-sm text-text-muted">Cargando…</div>
    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div class="rounded-2xl border border-border bg-white p-4 card-shadow">
          <div class="text-[10px] font-extrabold uppercase tracking-wide text-text-muted">Entradas</div>
          <div class="text-xl font-black text-teal mt-1 tabular-nums">{{ format(cf?.totalIn ?? 0) }}</div>
          <div class="text-[11px] text-text-secondary mt-0.5">Cobros del período</div>
        </div>
        <div class="rounded-2xl border border-border bg-white p-4 card-shadow">
          <div class="text-[10px] font-extrabold uppercase tracking-wide text-text-muted">Salidas</div>
          <div class="text-xl font-black text-danger mt-1 tabular-nums">{{ format(cf?.totalOut ?? 0) }}</div>
          <div class="text-[11px] text-text-secondary mt-0.5">Gastos pagados</div>
        </div>
        <div class="rounded-2xl border border-border bg-white p-4 card-shadow">
          <div class="text-[10px] font-extrabold uppercase tracking-wide text-text-muted">Por Cobrar (AR)</div>
          <div class="text-xl font-black text-navy mt-1 tabular-nums">{{ format(ar?.total ?? 0) }}</div>
          <div class="text-[11px] text-text-secondary mt-0.5">Saldo de huéspedes</div>
        </div>
        <div class="rounded-2xl border border-border bg-white p-4 card-shadow">
          <div class="text-[10px] font-extrabold uppercase tracking-wide text-text-muted">Por Pagar (AP)</div>
          <div class="text-xl font-black text-navy mt-1 tabular-nums">{{ format(ap?.total ?? 0) }}</div>
          <div class="text-[11px] text-text-secondary mt-0.5">Deuda a proveedores</div>
        </div>
      </div>

      <SectionCard title="Flujo de Caja" :subtitle="`Neto: ${format(cf?.net ?? 0)}`" body-class="p-0">
        <EmptyState v-if="!cf?.rows.length" title="Sin movimientos" message="No hay cobros ni gastos registrados todavía." />
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[520px] tbl-head">
            <thead><tr>
              <th class="text-left px-4 py-3 text-[10px]">Período</th>
              <th class="text-right px-4 py-3 text-[10px]">Entradas</th>
              <th class="text-right px-4 py-3 text-[10px]">Salidas</th>
              <th class="text-right px-4 py-3 text-[10px]">Neto</th>
              <th class="text-right px-4 py-3 text-[10px]">Acumulado</th>
            </tr></thead>
            <tbody>
              <tr v-for="r in cf.rows" :key="r.period" class="border-b border-border last:border-0 hover:bg-surface/60">
                <td class="px-4 py-2.5 text-sm font-mono">{{ r.period }}</td>
                <td class="px-4 py-2.5 text-sm text-right tabular-nums text-teal">{{ format(r.inflow) }}</td>
                <td class="px-4 py-2.5 text-sm text-right tabular-nums text-danger">{{ format(r.outflow) }}</td>
                <td class="px-4 py-2.5 text-sm text-right tabular-nums" :class="r.net >= 0 ? 'text-navy' : 'text-danger'">{{ format(r.net) }}</td>
                <td class="px-4 py-2.5 text-sm text-right tabular-nums font-bold text-navy">{{ format(r.balance) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </template>
  </div>
</template>

<style scoped></style>
