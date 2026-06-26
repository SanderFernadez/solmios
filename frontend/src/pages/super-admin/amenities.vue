<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-black text-navy">Catálogo de Amenities</h1>
        <p class="text-sm text-text-muted">Gestiona el catálogo global de amenities para todos los hoteles</p>
      </div>
      <button @click="openNew" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">+ Nueva Amenity</button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-2xl border border-border p-4 text-center">
        <div class="text-2xl font-black text-navy">{{ amenities.length }}</div>
        <div class="text-[10px] text-text-muted">TOTAL</div>
      </div>
      <div class="bg-white rounded-2xl border border-border p-4 text-center">
        <div class="text-2xl font-black text-teal">{{ amenities.filter(a => a.category === 'interior').length }}</div>
        <div class="text-[10px] text-text-muted">INTERIOR</div>
      </div>
      <div class="bg-white rounded-2xl border border-border p-4 text-center">
        <div class="text-2xl font-black text-cyan">{{ amenities.filter(a => a.category === 'exterior').length }}</div>
        <div class="text-[10px] text-text-muted">EXTERIOR</div>
      </div>
      <div class="bg-white rounded-2xl border border-border p-4 text-center">
        <div class="text-2xl font-black text-gold">{{ amenities.filter(a => a.category === 'services').length }}</div>
        <div class="text-[10px] text-text-muted">SERVICIOS</div>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
      <table class="w-full">
        <thead><tr class="border-b border-border">
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Icono</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Key</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Label</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Categoría</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
          <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
        </tr></thead>
        <tbody>
          <tr v-for="a in amenities" :key="a.id" class="border-b border-border last:border-0 hover:bg-surface/50">
            <td class="p-4 text-lg">{{ a.icon }}</td>
            <td class="p-4 text-sm font-mono text-text-secondary">{{ a.key }}</td>
            <td class="p-4 text-sm font-bold text-navy">{{ a.label }}</td>
            <td class="p-4"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="catClass(a.category)">{{ a.category }}</span></td>
            <td class="p-4"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="a.isActive ? 'bg-teal/10 text-teal' : 'bg-red/10 text-red'">{{ a.isActive ? 'Activa' : 'Inactiva' }}</span></td>
            <td class="p-4 text-right">
              <button @click="openEdit(a)" class="px-2 py-1 bg-cyan/10 text-cyan rounded-lg text-[10px] font-bold mr-1 cursor-pointer">Editar</button>
              <button @click="deleteAmenity(a)" class="px-2 py-1 bg-red/10 text-red rounded-lg text-[10px] font-bold cursor-pointer">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm" @click="showModal=false"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          <div class="p-6 border-b border-border flex items-center justify-between">
            <h3 class="text-lg font-black text-navy">{{ editing ? 'Editar' : 'Nueva' }} Amenity</h3>
            <button @click="showModal=false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center cursor-pointer">✕</button>
          </div>
          <div class="p-6 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Key *</label>
                <input v-model="form.key" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm font-mono" placeholder="pool_heated" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Icono</label>
                <input v-model="form.icon" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" placeholder="🏊" />
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Label *</label>
              <input v-model="form.label" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" placeholder="Piscina Climatizada" />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Categoría</label>
              <select v-model="form.category" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm">
                <option value="interior">Interior</option>
                <option value="exterior">Exterior</option>
                <option value="services">Servicios</option>
              </select>
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
import { ref, onMounted } from 'vue'
import { http } from '@/services/http'
import { useToast } from '@/composables/useToast'
const toast = useToast()

const amenities = ref<any[]>([])
const showModal = ref(false)
const editing = ref<any>(null)
const saving = ref(false)
const form = ref({ key: '', label: '', category: 'interior', icon: '' })

function catClass(cat: string) {
  return cat === 'interior' ? 'bg-navy/10 text-navy' : cat === 'exterior' ? 'bg-cyan/10 text-cyan' : 'bg-gold/10 text-gold'
}

function openNew() {
  editing.value = null
  form.value = { key: '', label: '', category: 'interior', icon: '' }
  showModal.value = true
}

function openEdit(a: any) {
  editing.value = a
  form.value = { key: a.key, label: a.label, category: a.category, icon: a.icon || '' }
  showModal.value = true
}

async function load() {
  const data = await http.get<any>('/admin/amenities/catalog')
  amenities.value = data?.data || data || []
}

async function save() {
  if (!form.value.key || !form.value.label) { toast.error('Key y Label requeridos'); return }
  saving.value = true
  try {
    if (editing.value) {
      await http.put(`/admin/amenities/catalog/${editing.value.id}`, form.value)
      toast.success('Amenity actualizada')
    } else {
      await http.post('/admin/amenities/catalog', form.value)
      toast.success('Amenity creada')
    }
    showModal.value = false
    await load()
  } catch (e: any) {
    toast.error(e.message || 'Error al guardar')
  } finally { saving.value = false }
}

async function deleteAmenity(a: any) {
  if (!confirm(`¿Eliminar "${a.label}"?`)) return
  try {
    await http.delete(`/admin/amenities/catalog/${a.id}`)
    toast.success('Amenity eliminada')
    await load()
  } catch (e: any) {
    toast.error(e.message || 'Error al eliminar')
  }
}

onMounted(load)
</script>
