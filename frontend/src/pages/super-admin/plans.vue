<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-black text-navy">Planes de Suscripción</h1>
        <p class="text-sm text-text-muted">Gestiona los planes SaaS de la plataforma</p>
      </div>
      <button @click="openNew" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">+ Nuevo Plan</button>
    </div>

    <SkeletonLoader v-if="loading" variant="card" :rows="3" class="mb-8" />
    <div v-else class="grid grid-cols-3 gap-6 mb-8">
      <div v-for="plan in plans" :key="plan.id" class="bg-white rounded-2xl border border-border card-shadow p-6 relative">
        <button @click="openEdit(plan)" class="absolute top-4 right-4 px-2 py-1 bg-surface rounded-lg text-[10px] font-bold hover:bg-surface-dark transition-colors cursor-pointer">Editar</button>
        <button @click="deletePlan(plan)" class="absolute top-4 right-20 px-2 py-1 bg-red-50 text-red-500 rounded-lg text-[10px] font-bold hover:bg-red-100 transition-colors cursor-pointer">Eliminar</button>
        <h3 class="text-lg font-black text-navy mb-2">{{ plan.name }}</h3>
        <div class="text-3xl font-black text-teal mb-2">${{ plan.price }}<span class="text-sm text-text-muted">/mes</span></div>
        <div class="text-sm text-text-secondary mb-4">{{ plan.description }}</div>
        <div class="space-y-2 mb-6">
          <div v-for="(feature, i) in (plan.features || [])" :key="i" class="flex items-center gap-2 text-sm">
            <span class="text-teal">✓</span><span>{{ feature }}</span>
          </div>
        </div>
        <div class="flex items-center justify-between pt-4 border-t border-border">
          <div class="text-center">
            <div class="text-lg font-black text-navy">{{ plan.limits?.rooms || 0 }}</div>
            <div class="text-[9px] text-text-muted">Hab.</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-black text-navy">{{ plan.limits?.users || 0 }}</div>
            <div class="text-[9px] text-text-muted">Usuarios</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-black text-navy">{{ plan.limits?.properties || 0 }}</div>
            <div class="text-[9px] text-text-muted">Propiedades</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <AppModal v-if="showModal" size="lg" :title="`${editing ? 'Editar' : 'Nuevo'} Plan`" @close="showModal=false">
      <div class="space-y-4">
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Nombre *</label>
              <input v-model="form.name" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Precio $ *</label>
                <input v-model.number="form.price" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Moneda</label>
                <input v-model="form.currency" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Descripción</label>
              <textarea v-model="form.description" rows="2" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm resize-none"></textarea>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Features (una por línea)</label>
              <textarea v-model="featuresText" rows="4" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm resize-none" placeholder="Hasta 30 habitaciones&#10;2 usuarios&#10;Reportes básicos"></textarea>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Máx. Hab.</label>
                <input v-model.number="form.limits.rooms" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Máx. Usuarios</label>
                <input v-model.number="form.limits.users" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Máx. Propiedades</label>
                <input v-model.number="form.limits.properties" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Módulos incluidos</label>
              <p class="text-[11px] text-text-muted mb-2">Los hoteles con este plan solo ven estos módulos y submódulos. Sin ninguno marcado = todos (compatibilidad).</p>
              <div class="space-y-2">
                <div v-for="m in moduleCatalog" :key="m.key" class="rounded-xl border" :class="hasModule(m.key) ? 'border-teal bg-teal/5' : 'border-border bg-surface'">
                  <!-- Módulo -->
                  <button type="button" @click="toggleModule(m)"
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold text-left cursor-pointer"
                    :class="hasModule(m.key) ? 'text-teal' : 'text-text-muted'">
                    <span class="w-4 h-4 rounded flex items-center justify-center shrink-0 border" :class="hasModule(m.key) ? 'bg-teal border-teal text-white' : 'border-border'">
                      <span v-if="hasModule(m.key)" class="text-[10px] leading-none">✓</span>
                    </span>
                    {{ m.label }}
                    <span v-if="m.submodules?.length && hasModule(m.key)" class="ml-auto text-[10px] font-semibold text-text-muted">{{ subCount(m) }}</span>
                  </button>
                  <!-- Submódulos (solo si el módulo está incluido) -->
                  <div v-if="m.submodules?.length && hasModule(m.key)" class="px-3 pb-2 pl-9 grid grid-cols-2 gap-1.5">
                    <button v-for="s in m.submodules" :key="s.key" type="button" @click="toggleSubmodule(m, s)"
                      class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] font-semibold text-left cursor-pointer transition-colors"
                      :class="hasModule(s.key) ? 'text-navy' : 'text-text-muted'">
                      <span class="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border" :class="hasModule(s.key) ? 'bg-teal border-teal text-white' : 'border-border'">
                        <span v-if="hasModule(s.key)" class="text-[9px] leading-none">✓</span>
                      </span>
                      {{ s.label }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
      </div>
      <template #footer>
        <button @click="showModal=false" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
        <button @click="save" :disabled="saving" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
      </template>
    </AppModal>

    <ConfirmModal v-if="confirmModal" :title="confirmModal.title" :message="confirmModal.message"
      :confirm-label="confirmModal.confirmLabel" :danger="confirmModal.danger" :loading="confirmBusy"
      @confirm="runConfirm" @close="confirmModal = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import { PlansService } from '@/services/Plans.service'
import { ModulesService, type ModuleMeta, type SubModuleMeta } from '@/services/Platform.service'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import ConfirmModal from '@/components/features/ConfirmModal.vue'
import { CurrencyCode } from '@/types/currency'
const toast = useToast()
const { confirmModal, confirmBusy, askConfirm, runConfirm } = useConfirm({
  onDone: () => toast.success('Plan eliminado'),
  onError: (e) => toast.error((e as any)?.message || 'Error al eliminar'),
})

const plans = ref<any[]>([])
const loading = ref(true)
const showModal = ref(false)
const editing = ref<any>(null)
const saving = ref(false)
const moduleCatalog = ref<ModuleMeta[]>([])

const emptyForm = () => ({ name: '', price: 0, currency: CurrencyCode.USD, description: '', features: [] as string[], modules: [] as string[], limits: { rooms: 30, users: 2, properties: 1 } })
const form = ref(emptyForm())
const featuresText = ref('')

const features = computed(() => featuresText.value.split('\n').filter(f => f.trim()))

function hasModule(key: string): boolean {
  return form.value.modules.includes(key)
}
function subCount(m: ModuleMeta): string {
  const subs = m.submodules ?? []
  const on = subs.filter(s => form.value.modules.includes(s.key)).length
  return `${on}/${subs.length}`
}
// Marcar módulo → agrega el módulo + TODOS sus submódulos (por defecto, todo incluido). Desmarcar → saca ambos.
function toggleModule(m: ModuleMeta) {
  const set = new Set(form.value.modules)
  const subs = m.submodules ?? []
  if (set.has(m.key)) {
    set.delete(m.key)
    subs.forEach(s => set.delete(s.key))
  } else {
    set.add(m.key)
    subs.forEach(s => set.add(s.key))
  }
  form.value.modules = [...set]
}
function toggleSubmodule(m: ModuleMeta, s: SubModuleMeta) {
  if (!form.value.modules.includes(m.key)) return   // módulo no incluido: no-op
  const set = new Set(form.value.modules)
  set.has(s.key) ? set.delete(s.key) : set.add(s.key)
  form.value.modules = [...set]
}
// Retrocompat: un plan viejo guardaba solo claves top-level. Al abrirlo, si un módulo está incluido pero
// no lista ninguno de sus submódulos, se consideran TODOS incluidos → los marcamos para reflejar el estado real.
function normalizeModules(mods: string[]): string[] {
  const set = new Set(mods)
  for (const m of moduleCatalog.value) {
    const subs = m.submodules ?? []
    if (set.has(m.key) && subs.length && !subs.some(s => set.has(s.key))) {
      subs.forEach(s => set.add(s.key))
    }
  }
  return [...set]
}

function openNew() {
  editing.value = null
  form.value = emptyForm()
  featuresText.value = ''
  showModal.value = true
}

function openEdit(plan: any) {
  editing.value = plan
  form.value = { name: plan.name, price: plan.price, currency: plan.currency || 'USD', description: plan.description || '', features: plan.features || [], modules: normalizeModules(plan.modules || []), limits: plan.limits || { rooms: 30, users: 2, properties: 1 } }
  featuresText.value = (plan.features || []).join('\n')
  showModal.value = true
}

async function loadPlans() {
  loading.value = true
  try {
    const { data } = await PlansService.list()
    plans.value = data || []
  } finally { loading.value = false }
}
async function loadModuleCatalog() {
  try { moduleCatalog.value = (await ModulesService.adminGet()).catalog || [] } catch { /* opcional */ }
}

async function save() {
  saving.value = true
  try {
    const payload = { ...form.value, features: features.value }
    if (editing.value) {
      await PlansService.update(editing.value.id, payload)
      toast.success('Plan actualizado')
    } else {
      await PlansService.create(payload)
      toast.success('Plan creado')
    }
    showModal.value = false
    await loadPlans()
  } catch (e: any) {
    toast.error(e.message || 'Error al guardar')
  } finally { saving.value = false }
}

function deletePlan(plan: any) {
  askConfirm({
    title: 'Eliminar plan',
    message: `¿Eliminar plan "${plan.name}"? No se puede deshacer.`,
    confirmLabel: 'Eliminar', danger: true,
    run: async () => {
      await PlansService.remove(plan.id)
      await loadPlans()
    },
  })
}

onMounted(() => { loadPlans(); loadModuleCatalog() })
</script>
