<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Capacitación</h2>
        <p class="text-sm text-text-muted mt-0.5">Cursos, certificaciones e inducciones del personal</p>
      </div>
      <button @click="tab === 'courses' ? openNewCourse() : openEnroll()" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
        <span class="text-lg leading-none">+</span>{{ tab === 'courses' ? 'Nuevo Curso' : 'Inscribir' }}
      </button>
    </div>

    <div class="flex gap-2 mb-6">
      <button v-for="t in tabs" :key="t.value" @click="tab = t.value"
        class="px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
        :class="tab === t.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        {{ t.label }}
      </button>
    </div>

    <div class="mb-5 p-4 rounded-xl bg-navy/5 border border-navy/10 text-xs text-text-secondary leading-relaxed">
      <b class="text-navy">💡 Cómo funciona:</b> creá el curso (podés cargar un <b>link al material</b>: video, PDF o plataforma).
      Cuando <b>inscribís</b> a un empleado, le llega un <b>correo</b> con el curso y el link. Cuando lo termina, confirma
      desde el correo y acá lo vas a ver como <b>Completado</b> — así sabés quién lo tomó y quién no. También podés marcarlo
      vos a mano con el botón "Completar".
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
    </div>

    <!-- Cursos -->
    <div v-else-if="tab === 'courses'" class="card overflow-x-auto">
      <div v-if="!courses.length" class="p-12 text-center text-sm text-text-muted">No hay cursos. Creá el primero.</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-border bg-surface/50 text-left">
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase">Curso</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase">Tipo</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase text-right">Duración</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase text-right">Vigencia</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in courses" :key="c.id" class="border-b border-border/50 last:border-0 hover:bg-surface/30">
            <td class="px-4 py-2.5">
              <div class="font-bold text-navy">{{ c.name }}</div>
              <a v-if="c.materialUrl" :href="c.materialUrl" target="_blank" rel="noopener" class="text-[10px] font-bold text-cyan hover:underline">🔗 Ver material</a>
              <span v-else class="text-[10px] text-text-muted">Sin material cargado</span>
            </td>
            <td class="px-4 py-2.5"><span class="text-[10px] font-bold px-2 py-1 rounded-full bg-navy/5 text-navy">{{ typeLabel(c.type) }}</span></td>
            <td class="px-4 py-2.5 text-right text-text-secondary">{{ c.durationHours ? c.durationHours + 'h' : '—' }}</td>
            <td class="px-4 py-2.5 text-right text-text-secondary">{{ c.validityMonths ? c.validityMonths + ' meses' : 'No vence' }}</td>
            <td class="px-4 py-2.5 text-right">
              <button @click="delCourse(c)" class="px-2.5 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Inscripciones -->
    <div v-else class="card overflow-x-auto">
      <div v-if="!enrollments.length" class="p-12 text-center text-sm text-text-muted">No hay inscripciones. Inscribí un empleado en un curso.</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-border bg-surface/50 text-left">
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase">Empleado</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase">Curso</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase">Vence</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase text-right">Nota</th>
            <th class="px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in enrollments" :key="e.id" class="border-b border-border/50 last:border-0 hover:bg-surface/30">
            <td class="px-4 py-2.5 font-bold text-navy">{{ employeeName(e.employeeId) }}</td>
            <td class="px-4 py-2.5 text-text-secondary">{{ courseName(e.courseId) }}</td>
            <td class="px-4 py-2.5"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="e.status === 'completed' ? 'bg-teal/10 text-teal' : 'bg-gold/10 text-gold'">{{ e.status === 'completed' ? 'Completado' : 'Inscripto' }}</span></td>
            <td class="px-4 py-2.5 text-text-muted">{{ e.expiresAt ? e.expiresAt.slice(0, 10) : '—' }}</td>
            <td class="px-4 py-2.5 text-right text-text-secondary">{{ e.score ?? '—' }}</td>
            <td class="px-4 py-2.5 text-right whitespace-nowrap">
              <button v-if="e.status !== 'completed'" @click="openComplete(e)" class="px-2.5 py-1 bg-teal/15 text-teal rounded-lg text-[10px] font-bold hover:bg-teal/25 cursor-pointer mr-1">Completar</button>
              <button @click="delEnrollment(e)" class="px-2.5 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">Quitar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <FormModal v-if="modal" :title="modal.title" :fields="modal.fields" :loading="saving" :submit-label="modal.submitLabel"
      @close="modal = null" @submit="modal.onSubmit" />
    <ConfirmModal v-if="confirmModal" :title="confirmModal.title" :message="confirmModal.message"
      :confirm-label="confirmModal.confirmLabel" :danger="confirmModal.danger" :loading="confirmBusy"
      @confirm="runConfirm" @close="confirmModal = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { TrainingService, type Course, type Enrollment, COURSE_TYPE_LABELS } from '@/services/Training.service'
import { EmpleadosService, type EmployeeProfile } from '@/services/Empleados.service'
import FormModal, { type FormField } from '@/components/features/FormModal.vue'
import ConfirmModal from '@/components/features/ConfirmModal.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth.store'

const toast = useToast()
const { confirmModal, confirmBusy, askConfirm, runConfirm } = useConfirm({ onDone: () => load(), onError: (e) => toast.error(e instanceof Error ? e.message : 'La acción falló') })
const auth = useAuthStore()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))
const loading = ref(true)
const saving = ref(false)
const tab = ref('courses')
const tabs = [{ value: 'courses', label: 'Cursos' }, { value: 'enrollments', label: 'Inscripciones' }]

const courses = ref<Course[]>([])
const enrollments = ref<Enrollment[]>([])
const profiles = ref<EmployeeProfile[]>([])

const typeLabel = (t: string) => COURSE_TYPE_LABELS[t] ?? t
const courseName = (id: string) => courses.value.find((c) => c.id === id)?.name ?? '—'
const employeeName = (id: string) => { const p = profiles.value.find((x) => x.id === id); return p?.userName || p?.position || id.slice(0, 6) }

async function load() {
  loading.value = true
  try {
    const [c, e, pr] = await Promise.all([
      TrainingService.listCourses(), TrainingService.listEnrollments(),
      EmpleadosService.listProfiles(hotelId.value ? { hotelId: hotelId.value } : undefined),
    ])
    courses.value = c; enrollments.value = e; profiles.value = pr.data ?? []
  } catch { toast.error('No se pudo cargar la capacitación') }
  finally { loading.value = false }
}
onMounted(load)

const modal = ref<{ title: string; submitLabel: string; fields: FormField[]; onSubmit: (v: Record<string, string | number>) => Promise<void> } | null>(null)

function openNewCourse() {
  modal.value = {
    title: 'Nuevo Curso', submitLabel: 'Crear',
    fields: [
      { key: 'name', label: 'Nombre', required: true, minLength: 2, maxLength: 150, placeholder: 'Manejo de alimentos' },
      { key: 'type', label: 'Tipo', type: 'select', default: 'course', options: Object.entries(COURSE_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
      { key: 'materialUrl', label: 'Link del material (opcional)', maxLength: 500, placeholder: 'https://…',
        hint: 'Link al video, PDF o plataforma del curso. Se lo mandamos por correo al empleado cuando lo inscribís.' },
      { key: 'durationHours', label: 'Duración (horas)', type: 'number', min: 0 },
      { key: 'validityMonths', label: 'Vigencia (meses, 0 = no vence)', type: 'number', min: 0 },
      { key: 'description', label: 'Descripción', type: 'textarea', maxLength: 1000 },
    ],
    onSubmit: async (v) => {
      saving.value = true
      try {
        await TrainingService.createCourse({ name: String(v.name).trim(), type: String(v.type), materialUrl: String(v.materialUrl || '') || undefined, durationHours: Number(v.durationHours) || undefined, validityMonths: Number(v.validityMonths) || undefined, description: String(v.description || '') || undefined } as Partial<Course>)
        toast.success('Curso creado'); modal.value = null; await load()
      } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Error al crear') }
      finally { saving.value = false }
    },
  }
}

function openEnroll() {
  if (!courses.value.length) { toast.warning('Creá un curso antes de inscribir'); return }
  if (!profiles.value.length) { toast.warning('No hay empleados con legajo'); return }
  modal.value = {
    title: 'Inscribir empleado', submitLabel: 'Inscribir',
    fields: [
      { key: 'employeeId', label: 'Empleado', type: 'select', required: true, options: profiles.value.map((p) => ({ value: p.id, label: p.userName || p.position || p.id.slice(0, 6) })) },
      { key: 'courseId', label: 'Curso', type: 'select', required: true, options: courses.value.map((c) => ({ value: c.id, label: c.name })) },
    ],
    onSubmit: async (v) => {
      saving.value = true
      try { await TrainingService.enroll({ employeeId: String(v.employeeId), courseId: String(v.courseId) }); toast.success('Empleado inscripto'); modal.value = null; await load() }
      catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Error al inscribir') }
      finally { saving.value = false }
    },
  }
}

function openComplete(e: Enrollment) {
  modal.value = {
    title: 'Completar capacitación', submitLabel: 'Completar',
    fields: [{ key: 'score', label: 'Nota (0-100, opcional)', type: 'number', min: 0, max: 100 }],
    onSubmit: async (v) => {
      saving.value = true
      try { await TrainingService.complete(e.id, v.score !== '' && v.score != null ? Number(v.score) : undefined); toast.success('Capacitación completada'); modal.value = null; await load() }
      catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Error') }
      finally { saving.value = false }
    },
  }
}

function delCourse(c: Course) {
  askConfirm({
    title: 'Eliminar curso', message: `¿Eliminar el curso "${c.name}"? Se quitan también sus inscripciones.`, confirmLabel: 'Eliminar', danger: true,
    run: async () => { await TrainingService.deleteCourse(c.id); toast.success('Curso eliminado') },
  })
}
function delEnrollment(e: Enrollment) {
  askConfirm({
    title: 'Quitar inscripción', message: '¿Quitar esta inscripción?', confirmLabel: 'Quitar', danger: true,
    run: async () => { await TrainingService.removeEnrollment(e.id); toast.success('Inscripción quitada') },
  })
}
</script>
