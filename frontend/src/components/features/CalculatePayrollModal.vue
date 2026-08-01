<template>
  <AppModal size="xl" body-class="p-0" @close="$emit('close')">
    <template #header>
      <div class="min-w-0">
        <h3 class="flex items-center gap-2 text-base sm:text-lg font-black text-white truncate">
          <span class="w-5 h-5 shrink-0" v-html="ICON_CALC"></span>Calcular Nómina — {{ run.period }}
        </h3>
        <p class="text-[11px] text-white/60 mt-0.5 truncate">Prellenado desde los fichajes. Revisá y corregí antes de calcular.</p>
      </div>
    </template>

        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-16">
          <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
        </div>

        <!-- Error de carga -->
        <div v-else-if="loadError" class="px-6 pt-6 py-10 text-center">
          <p class="text-sm font-bold text-coral">{{ loadError }}</p>
          <button @click="load" class="mt-3 px-4 py-2 border border-border rounded-xl text-xs font-bold text-text-secondary cursor-pointer">Reintentar</button>
        </div>

        <!-- Sin empleados -->
        <div v-else-if="!rows.length" class="px-6 pt-6 py-10 text-center">
          <p class="text-sm text-text-muted">No hay empleados activos con legajo en este hotel. Cargá los legajos en Empleados antes de liquidar.</p>
        </div>

        <!-- Tabla editable -->
        <template v-else>
          <div class="overflow-auto px-6 pt-4">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-white">
                <tr class="border-b border-border text-left">
                  <th class="py-2 pr-2 text-[10px] font-bold text-text-muted uppercase tracking-wider">Empleado</th>
                  <th class="py-2 px-2 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Salario base</th>
                  <th class="py-2 px-2 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Días</th>
                  <th class="py-2 px-2 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Horas</th>
                  <th class="py-2 px-2 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Extra</th>
                  <th class="py-2 px-2 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Ausencias</th>
                  <th class="py-2 pl-2 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Tarde</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.employeeId" class="border-b border-border/60 last:border-0">
                  <td class="py-2 pr-2">
                    <div class="font-bold text-navy">{{ row.employeeName }}</div>
                    <div v-if="!row.hasAttendance" class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 mt-0.5">
                      <span class="w-3 h-3 shrink-0" v-html="ICON_WARN"></span>Sin fichajes en el período
                    </div>
                  </td>
                  <td class="py-1.5 px-2"><input v-model.number="row.baseSalary" type="number" min="0" class="w-24 px-2 py-1.5 rounded-lg border border-border text-sm text-right focus:outline-none focus:border-navy" /></td>
                  <td class="py-1.5 px-2"><input v-model.number="row.daysWorked" type="number" min="0" class="w-16 px-2 py-1.5 rounded-lg border border-border text-sm text-right focus:outline-none focus:border-navy" /></td>
                  <td class="py-1.5 px-2"><input v-model.number="row.hoursWorked" type="number" min="0" class="w-16 px-2 py-1.5 rounded-lg border border-border text-sm text-right focus:outline-none focus:border-navy" /></td>
                  <td class="py-1.5 px-2"><input v-model.number="row.overtimeHours" type="number" min="0" class="w-16 px-2 py-1.5 rounded-lg border border-border text-sm text-right focus:outline-none focus:border-navy" /></td>
                  <td class="py-1.5 px-2"><input v-model.number="row.absences" type="number" min="0" class="w-16 px-2 py-1.5 rounded-lg border border-border text-sm text-right focus:outline-none focus:border-navy" /></td>
                  <td class="py-1.5 pl-2"><input v-model.number="row.lateArrivals" type="number" min="0" class="w-16 px-2 py-1.5 rounded-lg border border-border text-sm text-right focus:outline-none focus:border-navy" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="formError || run.status !== 'draft'" class="px-6 pt-3">
            <p v-if="formError" class="text-xs font-bold text-coral mb-1">{{ formError }}</p>
            <p v-if="run.status !== 'draft'" class="text-xs font-bold text-amber-600">
              Esta liquidación ya no está en borrador ({{ run.status }}): no se puede recalcular.
            </p>
          </div>
        </template>

    <template #footer>
      <button @click="$emit('close')" class="flex-1 py-2.5 border-2 border-navy/30 rounded-xl text-sm font-bold text-text-secondary cursor-pointer hover:bg-surface transition-colors">Cancelar</button>
      <button v-if="rows.length" @click="submit" :disabled="calculating || run.status !== 'draft'" class="flex-1 py-2.5 bg-navy border-2 border-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50 hover:bg-navy-light transition-colors">
        {{ calculating ? 'Calculando...' : `Calcular ${rows.length} empleados` }}
      </button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { PayrollService, type PayrollRun, type PayrollPrefillRow } from '@/services/Payroll.service'

const props = defineProps<{ run: PayrollRun }>()
const emit = defineEmits<{ close: []; calculated: [result: { employeeCount: number; totalNet: number }] }>()

const ICON_CALC = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4.5" y="3" width="15" height="18" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M8 7.5h8M8 12h1.5m3.25 0h1.5m3.25 0h0M8 15.75h1.5m3.25 0h1.5m3.25 0h0M8 19.5h1.5m3.25 0h1.5m3.25 0h0"/></svg>'
const ICON_WARN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>'

const rows = ref<PayrollPrefillRow[]>([])
const loading = ref(true)
const loadError = ref('')
const formError = ref('')
const calculating = ref(false)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    rows.value = await PayrollService.prefill(props.run.id)
  } catch {
    loadError.value = 'No se pudieron cargar los datos de asistencia.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

/** Espeja parseEmployeeInputs del backend: no manda nada que el server vaya a rechazar. */
function validate(): string | null {
  const fields: Array<keyof PayrollPrefillRow> = ['baseSalary', 'daysWorked', 'hoursWorked', 'overtimeHours', 'absences', 'lateArrivals']
  for (const row of rows.value) {
    for (const f of fields) {
      const v = row[f] as number
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        return `${row.employeeName}: "${f}" debe ser un número mayor o igual a cero.`
      }
    }
  }
  return null
}

async function submit() {
  formError.value = ''
  const invalid = validate()
  if (invalid) { formError.value = invalid; return }

  calculating.value = true
  try {
    const result = await PayrollService.calculate(props.run.id, rows.value)
    emit('calculated', { employeeCount: result.employeeCount, totalNet: result.totalNet })
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'No se pudo calcular la nómina.'
  } finally {
    calculating.value = false
  }
}
</script>

<style scoped>
input[type='number']::-webkit-inner-spin-button { opacity: 0.4; }
</style>
