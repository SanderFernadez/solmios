<template>
  <div>
    <div class="flex items-center justify-between mb-6 gap-3 flex-wrap">
      <div>
        <h2 class="text-xl font-black text-navy">Reclutamiento</h2>
        <p class="text-sm text-text-muted mt-0.5">Pipeline de selección — postulantes por etapa</p>
      </div>
      <button @click="openNewApplicant" class="flex items-center gap-1.5 px-4 py-2 bg-cyan text-navy rounded-xl text-xs font-bold hover:shadow-lg cursor-pointer">
        + Nuevo postulante
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
    </div>

    <div v-else class="overflow-x-auto pb-4">
      <div class="flex gap-4 min-w-max">
        <div v-for="col in columns" :key="col.stage" class="w-64 shrink-0">
          <div class="flex items-center justify-between mb-2 px-1">
            <span class="text-xs font-black uppercase tracking-wide" :class="col.text">{{ col.label }}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-text-muted">{{ byStage(col.stage).length }}</span>
          </div>
          <div class="space-y-2 min-h-[60px] p-2 rounded-xl" :class="col.bg">
            <div v-for="a in byStage(col.stage)" :key="a.id" class="card p-3 bg-white">
              <div class="font-bold text-navy text-sm truncate">{{ a.name }}</div>
              <div class="text-[11px] text-text-muted truncate">{{ a.email || a.phone || 'Sin contacto' }}</div>
              <div v-if="a.source" class="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-navy/5 text-navy uppercase">{{ a.source }}</div>
              <div v-if="a.stage === 'rejected' && a.rejectReason" class="text-[10px] text-coral mt-1 line-clamp-2">✕ {{ a.rejectReason }}</div>
              <div v-if="a.stage !== 'hired' && a.stage !== 'rejected'" class="flex items-center gap-1 mt-2 flex-wrap">
                <button v-if="nextStage(a.stage)" @click="advance(a)" class="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-teal/10 text-teal hover:bg-teal/20 cursor-pointer">→ {{ stageLabel(nextStage(a.stage)!) }}</button>
                <button @click="hire(a)" class="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-cyan/20 text-navy hover:bg-cyan/30 cursor-pointer">Contratar</button>
                <button @click="reject(a)" class="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-coral/10 text-coral hover:bg-coral/20 cursor-pointer">Rechazar</button>
              </div>
            </div>
            <div v-if="byStage(col.stage).length === 0" class="text-center text-[10px] text-text-muted py-3">—</div>
          </div>
        </div>
      </div>
    </div>

    <FormModal
      v-if="formModal"
      :title="formModal.title"
      :fields="formModal.fields"
      :submit-label="formModal.submitLabel"
      :loading="saving"
      @close="formModal = null"
      @submit="submitForm"
    />
    <ConfirmModal v-if="confirmModal" :title="confirmModal.title" :message="confirmModal.message"
      :confirm-label="confirmModal.confirmLabel" :danger="confirmModal.danger" :loading="confirmBusy"
      @confirm="runConfirm" @close="confirmModal = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ReclutamientoService, type Applicant } from '@/services/Reclutamiento.service'
import { useToast } from '@/composables/useToast'
import FormModal, { type FormField } from '@/components/features/FormModal.vue'
import ConfirmModal from '@/components/features/ConfirmModal.vue'
import { useConfirm } from '@/composables/useConfirm'

type FormValues = Record<string, string | number>

const toast = useToast()
const router = useRouter()
const { confirmModal, confirmBusy, askConfirm, runConfirm } = useConfirm({ onDone: () => load(), onError: (e) => toast.error(e instanceof Error ? e.message : 'La acción falló') })
const loading = ref(true)
const applicants = ref<Applicant[]>([])
const saving = ref(false)
const formModal = ref<{ title: string; submitLabel: string; fields: FormField[]; onSubmit: (v: FormValues) => Promise<unknown> } | null>(null)

const STAGES = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'] as const
const STAGE_LABELS: Record<string, string> = {
  new: 'Nuevos', screening: 'Preselección', interview: 'Entrevista', offer: 'Oferta', hired: 'Contratados', rejected: 'Rechazados',
}
const columns = [
  { stage: 'new', label: 'Nuevos', bg: 'bg-navy/5', text: 'text-navy' },
  { stage: 'screening', label: 'Preselección', bg: 'bg-gold/5', text: 'text-gold' },
  { stage: 'interview', label: 'Entrevista', bg: 'bg-cyan/5', text: 'text-cyan' },
  { stage: 'offer', label: 'Oferta', bg: 'bg-teal/5', text: 'text-teal' },
  { stage: 'hired', label: 'Contratados', bg: 'bg-teal/10', text: 'text-teal' },
  { stage: 'rejected', label: 'Rechazados', bg: 'bg-coral/5', text: 'text-coral' },
]

function stageLabel(s: string) { return STAGE_LABELS[s] ?? s }
function byStage(stage: string) { return applicants.value.filter((a) => a.stage === stage) }
function nextStage(stage: string): string | null {
  const flow = ['new', 'screening', 'interview', 'offer']
  const i = flow.indexOf(stage)
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null
}

async function load() {
  loading.value = true
  try { applicants.value = await ReclutamientoService.list() }
  catch { toast.error('No se pudo cargar el pipeline') }
  finally { loading.value = false }
}
onMounted(load)

function openNewApplicant() {
  formModal.value = {
    title: 'Nuevo postulante', submitLabel: 'Agregar',
    fields: [
      { key: 'name', label: 'Nombre', required: true, maxLength: 120 },
      { key: 'email', label: 'Email', type: 'email', maxLength: 120 },
      { key: 'phone', label: 'Teléfono', type: 'tel', maxLength: 30 },
      { key: 'source', label: 'Origen', placeholder: 'web, referido, agencia…', maxLength: 40 },
      { key: 'notes', label: 'Notas', type: 'textarea', maxLength: 1000 },
    ],
    onSubmit: (v) => ReclutamientoService.create(v),
  }
}

async function advance(a: Applicant) {
  const next = nextStage(a.stage)
  if (!next) return
  try { await ReclutamientoService.moveStage(a.id, next); toast.success(`Movido a ${stageLabel(next)}`); load() }
  catch { toast.error('No se pudo mover de etapa') }
}

function reject(a: Applicant) {
  formModal.value = {
    title: `Rechazar a ${a.name}`, submitLabel: 'Rechazar',
    fields: [{ key: 'reason', label: 'Motivo del rechazo', type: 'textarea', required: true, maxLength: 500 }],
    onSubmit: (v) => ReclutamientoService.reject(a.id, String(v.reason ?? '')),
  }
}

function hire(a: Applicant) {
  askConfirm({
    title: 'Contratar postulante',
    message: `${a.name} pasará a "Contratado" y te llevamos a crear su expediente de empleado con sus datos ya cargados.`,
    confirmLabel: 'Contratar',
    run: async () => {
      await ReclutamientoService.hire(a.id)
      toast.success('Postulante contratado')
      // Conexión candidato→empleado: handoff a Empleados con el nombre y email precargados.
      router.push({ path: '/panel/rrhh/empleados', query: { newName: a.name, newEmail: a.email || '' } })
    },
  })
}

async function submitForm(values: FormValues) {
  if (!formModal.value) return
  saving.value = true
  try { await formModal.value.onSubmit(values); toast.success('Guardado'); formModal.value = null; load() }
  catch (e) { toast.error(e instanceof Error ? e.message : 'Error al guardar') }
  finally { saving.value = false }
}
</script>
