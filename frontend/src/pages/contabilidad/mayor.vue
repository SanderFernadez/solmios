<script setup lang="ts">
// Libro mayor (CTB-7) — movimientos de una cuenta con saldo corriente.
import { ref, computed, onMounted } from 'vue'
import { AccountingService, type Account, type Ledger } from '@/services/Accounting.service'
import { useToast } from '@/composables/useToast'
import { useCurrency } from '@/composables/useCurrency'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const toast = useToast()
const { format } = useCurrency()
const accounts = ref<Account[]>([])
const selected = ref('')
const ledger = ref<Ledger | null>(null)
const loading = ref(false)

const postable = computed(() => accounts.value.filter(a => a.isPostable).sort((a, b) => a.code.localeCompare(b.code)))

async function loadAccounts() {
  try { accounts.value = (await AccountingService.listAccounts()).data || [] }
  catch (e: any) { toast.error(e.message || 'Error al cargar cuentas') }
}
async function loadLedger() {
  if (!selected.value) { ledger.value = null; return }
  loading.value = true
  try { ledger.value = await AccountingService.ledger(selected.value) }
  catch (e: any) { toast.error(e.message || 'Error al cargar el mayor') }
  finally { loading.value = false }
}

onMounted(loadAccounts)
</script>

<template>
  <div>
    <div class="mb-6">
      <h2 class="text-xl font-black text-navy">Libro Mayor</h2>
      <p class="text-sm text-text-muted mt-0.5">Los movimientos de una cuenta y su saldo corriente.</p>
    </div>

    <div class="mb-4 max-w-md">
      <select v-model="selected" @change="loadLedger" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer focus:outline-none focus:border-navy">
        <option value="">Elegí una cuenta…</option>
        <option v-for="a in postable" :key="a.id" :value="a.id">{{ a.code }} — {{ a.name }}</option>
      </select>
    </div>

    <SectionCard v-if="selected" :title="ledger?.account ? `${ledger.account.code} — ${ledger.account.name}` : 'Mayor'"
      :subtitle="ledger ? `Saldo: ${format(ledger.balance)}` : ''" body-class="p-0">
      <div v-if="loading" class="p-8 text-center text-sm text-text-muted">Cargando…</div>
      <EmptyState v-else-if="!ledger?.movements.length" title="Sin movimientos" message="Esta cuenta no tiene asientos posteados." />
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[520px] tbl-head">
          <thead><tr>
            <th class="text-left px-4 py-3 text-[10px]">Fecha</th>
            <th class="text-right px-4 py-3 text-[10px]">Debe</th>
            <th class="text-right px-4 py-3 text-[10px]">Haber</th>
            <th class="text-right px-4 py-3 text-[10px]">Saldo</th>
          </tr></thead>
          <tbody>
            <tr v-for="(m, i) in ledger.movements" :key="i" class="border-b border-border last:border-0 hover:bg-surface/60">
              <td class="px-4 py-2.5 text-sm">{{ m.date }}</td>
              <td class="px-4 py-2.5 text-sm text-right tabular-nums">{{ m.debit ? format(m.debit) : '—' }}</td>
              <td class="px-4 py-2.5 text-sm text-right tabular-nums">{{ m.credit ? format(m.credit) : '—' }}</td>
              <td class="px-4 py-2.5 text-sm text-right tabular-nums font-bold text-navy">{{ format(m.balance) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  </div>
</template>

<style scoped></style>
