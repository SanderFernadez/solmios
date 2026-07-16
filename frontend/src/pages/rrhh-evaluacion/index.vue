<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Evaluación de Desempeño</h2>
        <p class="text-sm text-text-muted mt-0.5">Motor automático: puntúa al personal con datos reales de limpieza y asistencia</p>
      </div>
      <button @click="runEvaluation" :disabled="running || !config"
        class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLAY"></span>
        {{ running ? 'Ejecutando…' : 'Ejecutar evaluación del período' }}
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
      <span class="ml-3 text-sm text-text-muted font-bold">Cargando configuración...</span>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <!-- Config -->
      <section class="card p-5 lg:col-span-1 space-y-4">
        <h3 class="font-extrabold text-navy text-sm flex items-center gap-2">
          <span class="w-4 h-4 text-navy shrink-0" v-html="ICON_COG"></span>Configuración
        </h3>

        <div>
          <label class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Período</label>
          <select v-model="form.period" class="input mt-1">
            <option value="monthly">Mensual</option>
            <option value="quarterly">Trimestral</option>
          </select>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <label class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Pesos (deben sumar 100)</label>
            <span class="text-[11px] font-black" :class="weightsSum === 100 ? 'text-teal' : 'text-coral'">{{ weightsSum }}/100</span>
          </div>
          <div class="grid grid-cols-2 gap-2 mt-1">
            <div v-for="w in WEIGHT_KEYS" :key="w.key">
              <span class="text-[10px] text-text-muted">{{ w.label }}</span>
              <input type="number" min="0" max="100" v-model.number="form.weights[w.key]" class="input" />
            </div>
          </div>
        </div>

        <div>
          <label class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Umbrales de banda (descendentes)</label>
          <div class="grid grid-cols-3 gap-2 mt-1">
            <div v-for="t in THRESHOLD_KEYS" :key="t.key">
              <span class="text-[10px] text-text-muted">{{ t.label }}</span>
              <input type="number" min="0" max="100" v-model.number="form.thresholds[t.key]" class="input" />
            </div>
          </div>
        </div>

        <div>
          <label class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Minutos estándar por tarea</label>
          <input type="number" min="1" v-model.number="form.standardTaskMinutes" class="input mt-1" />
        </div>

        <label class="flex items-center gap-2 cursor-pointer text-sm font-bold text-text-secondary select-none">
          <input type="checkbox" v-model="form.enabled" class="accent-cyan cursor-pointer" />
          Motor habilitado
        </label>

        <button @click="saveConfig" :disabled="saving || weightsSum !== 100"
          class="w-full bg-navy text-white font-extrabold text-sm px-4 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {{ saving ? 'Guardando…' : 'Guardar configuración' }}
        </button>
        <p v-if="weightsSum !== 100" class="text-[11px] text-coral font-bold text-center">Los pesos deben sumar exactamente 100.</p>
      </section>

      <!-- Resumen + Resultados -->
      <div class="lg:col-span-2 space-y-5">
        <div v-if="summary" class="card p-5">
          <h3 class="font-extrabold text-navy text-sm mb-3">Última ejecución — {{ summary.period }}</h3>
          <div class="grid grid-cols-3 gap-3">
            <div class="rounded-xl bg-teal/10 p-3 text-center">
              <div class="text-2xl font-black text-teal">{{ summary.evaluated }}</div>
              <div class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Evaluados</div>
            </div>
            <div class="rounded-xl bg-gold/10 p-3 text-center">
              <div class="text-2xl font-black text-gold">{{ summary.skipped }}</div>
              <div class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Sin datos</div>
            </div>
            <div class="rounded-xl bg-navy/5 p-3 text-center">
              <div class="text-2xl font-black text-navy capitalize">{{ summary.periodType === 'monthly' ? 'Mensual' : 'Trimestral' }}</div>
              <div class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Período</div>
            </div>
          </div>
        </div>

        <section class="card overflow-hidden">
          <header class="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 class="font-extrabold text-navy text-sm">Resultados</h3>
            <span class="text-[11px] text-text-muted">{{ results.length }} evaluaciones</span>
          </header>
          <div v-if="results.length" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border bg-surface/50">
                  <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Empleado</th>
                  <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Período</th>
                  <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Puntaje</th>
                  <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Banda</th>
                  <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Desglose (Prod / Cal / Punt / Asis)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in results" :key="r.id" class="border-b border-border/60 last:border-0 hover:bg-surface/50">
                  <td class="px-4 py-2.5 font-bold text-navy whitespace-nowrap">{{ employeeName(r.employeeId) }}</td>
                  <td class="px-4 py-2.5 text-text-secondary">{{ r.period || '—' }}</td>
                  <td class="px-4 py-2.5 text-right font-black" :class="scoreClass(r.score)">{{ r.score ?? '—' }}</td>
                  <td class="px-4 py-2.5">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="bandBg(bandOf(r))">{{ bandLabel(bandOf(r)) }}</span>
                  </td>
                  <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap text-[11px]">{{ breakdownText(r) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="p-10 text-center text-text-muted text-sm">Todavía no hay evaluaciones. Ejecutá el motor para generarlas.</p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import {
  EmpleadosService, type EmployeeProfile, type PerformanceReview,
  type EvalPeriodType, type EvalBand, type EvalBreakdown, type EvalWeights, type EvalThresholds, type AutoEvalSummary,
} from '@/services/Empleados.service'
import { useToast } from '@/composables/useToast'

const ICON_PLAY = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 0 1 0 1.971l-11.54 6.347a1.125 1.125 0 0 1-1.667-.985V5.653Z"/></svg>'
const ICON_COG = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.241.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>'

const toast = useToast()

const WEIGHT_KEYS: { key: keyof EvalWeights; label: string }[] = [
  { key: 'productivity', label: 'Productividad' },
  { key: 'quality', label: 'Calidad' },
  { key: 'punctuality', label: 'Puntualidad' },
  { key: 'attendance', label: 'Asistencia' },
]
const THRESHOLD_KEYS: { key: keyof EvalThresholds; label: string }[] = [
  { key: 'excellent', label: 'Excelente' },
  { key: 'good', label: 'Bueno' },
  { key: 'fair', label: 'Regular' },
]

const loading = ref(true)
const saving = ref(false)
const running = ref(false)
const config = ref<Awaited<ReturnType<typeof EmpleadosService.getEvalConfig>> | null>(null)
const results = ref<PerformanceReview[]>([])
const summary = ref<AutoEvalSummary | null>(null)
const profilesById = ref<Map<string, string>>(new Map())

const form = reactive<{
  period: EvalPeriodType
  weights: EvalWeights
  thresholds: EvalThresholds
  standardTaskMinutes: number
  enabled: boolean
}>({
  period: 'monthly',
  weights: { productivity: 30, quality: 35, punctuality: 20, attendance: 15 },
  thresholds: { excellent: 90, good: 75, fair: 60 },
  standardTaskMinutes: 30,
  enabled: true,
})

const weightsSum = computed(() => WEIGHT_KEYS.reduce((s, w) => s + (Number(form.weights[w.key]) || 0), 0))

function employeeName(profileId: string): string {
  return profilesById.value.get(profileId) || profileId.slice(0, 8)
}

const BAND_LABELS: Record<EvalBand, string> = { excellent: 'Excelente', good: 'Bueno', fair: 'Regular', poor: 'Bajo' }
function bandLabel(band: EvalBand | null) { return band ? BAND_LABELS[band] : '—' }
function bandBg(band: EvalBand | null) {
  return ({
    excellent: 'bg-teal/10 text-teal', good: 'bg-cyan/10 text-cyan',
    fair: 'bg-gold/10 text-gold', poor: 'bg-coral/10 text-coral',
  } as Record<string, string>)[band ?? ''] ?? 'bg-navy/5 text-navy'
}
function scoreClass(score: number | null) {
  if (score == null) return 'text-text-muted'
  if (score >= 80) return 'text-teal'
  if (score >= 60) return 'text-gold'
  return 'text-coral'
}

/** El motor guarda { band, breakdown } serializado en `answers`. */
function parseAnswers(r: PerformanceReview): { band?: EvalBand; breakdown?: EvalBreakdown } {
  try { return JSON.parse(r.answers || '{}') } catch { return {} }
}
function bandOf(r: PerformanceReview): EvalBand | null { return parseAnswers(r).band ?? null }
function breakdownText(r: PerformanceReview): string {
  const b = parseAnswers(r).breakdown
  if (!b) return '—'
  const cell = (c: EvalBreakdown[keyof EvalBreakdown]) => (c.hasData ? String(c.score) : '·')
  return `${cell(b.productivity)} / ${cell(b.quality)} / ${cell(b.punctuality)} / ${cell(b.attendance)}`
}

async function loadResults() {
  try { results.value = await EmpleadosService.listEvalResults() } catch { /* opcional */ }
}

async function loadProfiles() {
  try {
    const res = await EmpleadosService.listProfiles({ includeInactive: 'true' })
    for (const p of res.data ?? []) profilesById.value.set(p.id, p.userName || p.position || p.userId.slice(0, 8))
  } catch { /* opcional: cae al id */ }
}

function applyConfig(cfg: NonNullable<typeof config.value>) {
  config.value = cfg
  form.period = cfg.period
  form.weights = { ...cfg.weights }
  form.thresholds = { ...cfg.thresholds }
  form.standardTaskMinutes = cfg.standardTaskMinutes
  form.enabled = cfg.enabled === 1
}

async function saveConfig() {
  if (weightsSum.value !== 100) { toast.error('Los pesos deben sumar 100'); return }
  saving.value = true
  try {
    const updated = await EmpleadosService.updateEvalConfig({
      period: form.period,
      weights: { ...form.weights },
      thresholds: { ...form.thresholds },
      standardTaskMinutes: form.standardTaskMinutes,
      enabled: form.enabled,
    })
    applyConfig(updated)
    toast.success('Configuración guardada')
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Error al guardar')
  } finally {
    saving.value = false
  }
}

async function runEvaluation() {
  running.value = true
  try {
    summary.value = await EmpleadosService.runEvaluation(form.period)
    toast.success(`Evaluación completada: ${summary.value.evaluated} evaluados, ${summary.value.skipped} sin datos`)
    await loadResults()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Error al ejecutar la evaluación')
  } finally {
    running.value = false
  }
}

onMounted(async () => {
  try {
    const cfg = await EmpleadosService.getEvalConfig()
    applyConfig(cfg)
  } catch {
    toast.error('No se pudo cargar la configuración')
  } finally {
    loading.value = false
  }
  await Promise.all([loadProfiles(), loadResults()])
})
</script>

<style scoped>
.input {
  width: 100%;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 0.75rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  background: #fff;
  color: var(--color-navy, #0f172a);
}
.input:focus { outline: none; border-color: var(--color-cyan, #06b6d4); }
</style>
