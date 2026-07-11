<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-black text-navy">Planes de Suscripción</h1>
        <p class="text-sm text-text-muted">Gestiona los planes SaaS de la plataforma</p>
      </div>
      <button @click="openNew" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">+ Nuevo Plan</button>
    </div>

    <div class="grid grid-cols-3 gap-6 mb-8">
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
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
          <div class="p-6 border-b border-border flex items-center justify-between">
            <h3 class="text-lg font-black text-navy">{{ editing ? 'Editar' : 'Nuevo' }} Plan</h3>
            <button @click="showModal=false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center cursor-pointer">✕</button>
          </div>
          <div class="p-6 space-y-4">
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
          </div>
          <div class="p-6 border-t border-border flex gap-3 justify-end">
            <button @click="showModal=false" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="save" :disabled="saving" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { PlansService } from '@/services/Plans.service'
import { useToast } from '@/composables/useToast'
const toast = useToast()

const plans = ref<any[]>([])
const showModal = ref(false)
const editing = ref<any>(null)
const saving = ref(false)

const form = ref({ name: '', price: 0, currency: 'USD', description: '', features: [] as string[], limits: { rooms: 30, users: 2, properties: 1 } })
const featuresText = ref('')

const features = computed(() => featuresText.value.split('\n').filter(f => f.trim()))

function openNew() {
  editing.value = null
  form.value = { name: '', price: 0, currency: 'USD', description: '', features: [], limits: { rooms: 30, users: 2, properties: 1 } }
  featuresText.value = ''
  showModal.value = true
}

function openEdit(plan: any) {
  editing.value = plan
  form.value = { name: plan.name, price: plan.price, currency: plan.currency || 'USD', description: plan.description || '', features: plan.features || [], limits: plan.limits || { rooms: 30, users: 2, properties: 1 } }
  featuresText.value = (plan.features || []).join('\n')
  showModal.value = true
}

async function loadPlans() {
  const { data } = await PlansService.list()
  plans.value = data || []
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

async function deletePlan(plan: any) {
  if (!confirm(`¿Eliminar plan "${plan.name}"?`)) return
  try {
    await PlansService.remove(plan.id)
    toast.success('Plan eliminado')
    await loadPlans()
  } catch (e: any) {
    toast.error(e.message || 'Error al eliminar')
  }
}

onMounted(loadPlans)
</script>
