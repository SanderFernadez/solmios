<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Capacitación</h2>
        <p class="text-sm text-text-muted mt-0.5">Cursos, certificaciones e inducciones del personal</p>
      </div>
      <button @click="tab === 'courses' ? openNewCourse() : openEnroll()" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer">
        <span class="text-lg leading-none">+</span>{{ tab === 'courses' ? 'Nuevo Curso' : 'Inscribir' }}
      </button>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <KpiHeroCard label="Cursos" :value="courses.length" icon="building" accent="blue"
        :unit="coursesWithMaterial ? `${coursesWithMaterial} con material cargado` : 'Catálogo de capacitación'" />
      <KpiHeroCard label="Inscripciones" :value="totalEnrollments" icon="users" accent="purple"
        :unit="`${inProgressCount} en curso`" />
      <KpiHeroCard label="Completados" :value="completedCount" icon="checkin" accent="teal"
        unit="Capacitaciones finalizadas" />
      <KpiHeroCard label="Avance" :value="completionPct" icon="bookings" accent="amber" suffix="%"
        :progress="completionPct" unit="Del total de inscripciones" />
    </div>

    <div class="flex gap-2 mb-6">
      <button v-for="t in tabs" :key="t.value" @click="tab = t.value"
        class="px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer"
        :class="tab === t.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        {{ t.label }}
      </button>
    </div>

    <div class="mb-5 p-4 rounded-2xl bg-navy/5 border border-navy/10 text-xs text-text-secondary leading-relaxed">
      <b class="text-navy">💡 Cómo funciona:</b> creá el curso (podés cargar un <b>link al material</b>: video, PDF o plataforma).
      Cuando <b>inscribís</b> a un empleado, le llega un <b>correo</b> con el curso y el link. Cuando lo termina, confirma
      desde el correo y acá lo vas a ver como <b>Completado</b> — así sabés quién lo tomó y quién no. También podés marcarlo
      vos a mano con el botón "Completar".
    </div>

    <!-- Skeleton de carga -->
    <SectionCard v-if="loading" title="Cargando…" body-class="p-4 sm:p-5">
      <div class="space-y-3">
        <div v-for="n in 5" :key="n" class="flex items-center gap-4 animate-pulse">
          <div class="h-4 flex-1 rounded bg-surface"></div>
          <div class="h-4 w-24 rounded bg-surface"></div>
          <div class="h-4 w-16 rounded bg-surface"></div>
          <div class="h-8 w-8 rounded-lg bg-surface"></div>
        </div>
      </div>
    </SectionCard>

    <!-- Cursos -->
    <SectionCard v-else-if="tab === 'courses'" title="Catálogo de cursos"
      :subtitle="`${courses.length} curso(s) · ${totalEnrollments} inscripción(es)`" body-class="p-0">
      <template #actions>
        <button @click="openNewCourse" class="px-4 py-2 rounded-lg border border-white/15 bg-white/10 text-sm font-bold text-white hover:bg-white/20 transition-colors cursor-pointer">
          Nuevo Curso
        </button>
      </template>

      <EmptyState v-if="!courses.length" :icon="ICON_BOOK_EMPTY" title="Todavía no hay cursos"
        message="Creá el primer curso y cargale el link al material para poder inscribir empleados.">
        <template #action>
          <button @click="openNewCourse" class="px-5 py-2.5 bg-navy text-white rounded-full text-sm font-bold hover:bg-navy-light transition-colors cursor-pointer">
            Nuevo Curso
          </button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[820px] tbl-head text-sm">
          <thead>
            <tr>
              <th class="text-left px-4 py-3 text-[10px]">Curso</th>
              <th class="text-left px-4 py-3 text-[10px]">Tipo</th>
              <th class="text-left px-4 py-3 text-[10px] hidden lg:table-cell">Avance</th>
              <th class="text-right px-4 py-3 text-[10px]">Duración</th>
              <th class="text-right px-4 py-3 text-[10px] hidden lg:table-cell">Vigencia</th>
              <th class="text-right px-4 py-3 text-[10px]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in courses" :key="c.id" class="border-b border-border last:border-0 hover:bg-surface/60 transition-colors">
              <td class="px-4 py-3">
                <div class="font-bold text-navy">{{ c.name }}</div>
                <a v-if="c.materialUrl" :href="c.materialUrl" target="_blank" rel="noopener" class="text-[11px] font-bold text-cyan hover:underline">🔗 Ver material</a>
                <span v-else class="text-[11px] text-text-muted">Sin material cargado</span>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full bg-navy/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-navy">
                  {{ typeLabel(c.type) }}
                </span>
              </td>
              <td class="px-4 py-3 hidden lg:table-cell">
                <div v-if="courseStats(c.id).total" class="min-w-[120px]">
                  <div class="h-2 w-full overflow-hidden rounded-full bg-surface">
                    <div class="h-full rounded-full bg-teal transition-[width] duration-500"
                      :style="{ width: `${courseStats(c.id).pct}%` }"></div>
                  </div>
                  <div class="mt-1 text-[10px] font-bold tabular-nums text-text-muted">
                    {{ courseStats(c.id).completed }}/{{ courseStats(c.id).total }} completados
                  </div>
                </div>
                <span v-else class="text-[11px] text-text-muted">Sin inscriptos</span>
              </td>
              <td class="px-4 py-3 text-right tabular-nums text-text-secondary">
                <span v-if="c.durationHours" class="font-bold text-navy">{{ c.durationHours }}h</span>
                <span v-else class="text-[11px] text-text-muted">Sin definir</span>
              </td>
              <td class="px-4 py-3 text-right tabular-nums text-text-secondary hidden lg:table-cell">
                <span v-if="c.validityMonths">{{ c.validityMonths }} meses</span>
                <span v-else class="text-[11px] text-text-muted">No vence</span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <button @click="delCourse(c)" title="Eliminar curso"
                    class="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-coral/10 hover:text-coral transition-colors cursor-pointer">
                    <span class="block h-4 w-4" v-html="ICON_TRASH"></span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>

    <!-- Inscripciones -->
    <SectionCard v-else title="Inscripciones"
      :subtitle="`${completedCount} completado(s) · ${inProgressCount} en curso`" body-class="p-0">
      <template #actions>
        <button @click="openEnroll" class="px-4 py-2 rounded-lg border border-white/15 bg-white/10 text-sm font-bold text-white hover:bg-white/20 transition-colors cursor-pointer">
          Inscribir
        </button>
      </template>

      <EmptyState v-if="!enrollments.length" :icon="ICON_USERS_EMPTY" title="Todavía no hay inscripciones"
        message="Inscribí un empleado en un curso y le llega el material por correo.">
        <template #action>
          <button @click="openEnroll" class="px-5 py-2.5 bg-navy text-white rounded-full text-sm font-bold hover:bg-navy-light transition-colors cursor-pointer">
            Inscribir empleado
          </button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[880px] tbl-head text-sm">
          <thead>
            <tr>
              <th class="text-left px-4 py-3 text-[10px]">Empleado</th>
              <th class="text-left px-4 py-3 text-[10px]">Curso</th>
              <th class="text-left px-4 py-3 text-[10px]">Estado</th>
              <th class="text-left px-4 py-3 text-[10px] hidden lg:table-cell">Vence</th>
              <th class="text-right px-4 py-3 text-[10px]">Nota</th>
              <th class="text-right px-4 py-3 text-[10px]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in enrollments" :key="e.id" class="border-b border-border last:border-0 hover:bg-surface/60 transition-colors">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy/10 text-[11px] font-black text-navy">
                    {{ initialsOf(employeeName(e.employeeId)) }}
                  </div>
                  <div class="min-w-0">
                    <div class="font-bold text-navy truncate">{{ employeeName(e.employeeId) }}</div>
                    <div v-if="e.expiresAt" class="text-[11px] text-text-muted lg:hidden">Vence {{ e.expiresAt.slice(0, 10) }}</div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-text-secondary">{{ courseName(e.courseId) }}</td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
                  :class="e.status === 'completed' ? 'bg-teal/10 text-teal' : 'bg-cyan/10 text-cyan'">
                  <span class="h-1.5 w-1.5 rounded-full" :class="e.status === 'completed' ? 'bg-teal' : 'bg-cyan'"></span>
                  {{ e.status === 'completed' ? 'Completado' : 'En curso' }}
                </span>
              </td>
              <td class="px-4 py-3 text-text-secondary tabular-nums hidden lg:table-cell">
                <span v-if="e.expiresAt">{{ e.expiresAt.slice(0, 10) }}</span>
                <span v-else class="text-[11px] text-text-muted">No vence</span>
              </td>
              <td class="px-4 py-3 text-right">
                <span v-if="e.score != null" class="inline-flex items-center rounded-full bg-gold/10 px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-gold">
                  {{ e.score }}
                </span>
                <span v-else class="text-[11px] text-text-muted">Sin nota</span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <button v-if="e.status !== 'completed'" @click="openComplete(e)" title="Marcar como completado"
                    class="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-teal/10 hover:text-teal transition-colors cursor-pointer">
                    <span class="block h-4 w-4" v-html="ICON_CHECK"></span>
                  </button>
                  <button @click="delEnrollment(e)" title="Quitar inscripción"
                    class="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-coral/10 hover:text-coral transition-colors cursor-pointer">
                    <span class="block h-4 w-4" v-html="ICON_TRASH"></span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>

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
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import KpiHeroCard from '@/components/features/dashboard/KpiHeroCard.vue'
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

// Iconos SVG inline (el <svg> hereda el tamaño del <span> contenedor)
const ICON_TRASH = '<svg viewBox="0 0 24 24" class="h-full w-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>'
const ICON_CHECK = '<svg viewBox="0 0 24 24" class="h-full w-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
const ICON_BOOK_EMPTY = '<svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>'
const ICON_USERS_EMPTY = '<svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>'

const typeLabel = (t: string) => COURSE_TYPE_LABELS[t] ?? t
const courseName = (id: string) => courses.value.find((c) => c.id === id)?.name ?? 'Curso eliminado'
const employeeName = (id: string) => { const p = profiles.value.find((x) => x.id === id); return p?.userName || p?.position || id.slice(0, 6) }
const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || '?'

// Métricas de cabecera (solo lectura sobre los datos ya cargados)
const totalEnrollments = computed(() => enrollments.value.length)
const completedCount = computed(() => enrollments.value.filter((e) => e.status === 'completed').length)
const inProgressCount = computed(() => totalEnrollments.value - completedCount.value)
const completionPct = computed(() => (totalEnrollments.value ? Math.round((completedCount.value / totalEnrollments.value) * 100) : 0))
const coursesWithMaterial = computed(() => courses.value.filter((c) => c.materialUrl).length)

function courseStats(courseId: string) {
  const list = enrollments.value.filter((e) => e.courseId === courseId)
  const completed = list.filter((e) => e.status === 'completed').length
  return { total: list.length, completed, pct: list.length ? Math.round((completed / list.length) * 100) : 0 }
}

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

<style scoped></style>
