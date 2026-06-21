<template>
  <div class="min-h-screen bg-surface">
    <!-- Header -->
    <div class="bg-white border-b border-border px-6 py-4">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 class="text-xl font-black text-navy">Paquetes & Upsells</h1>
          <p class="text-xs text-text-muted">Servicios adicionales · Ofertas especiales · Revenue extra</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs font-bold px-3 py-1 rounded-full bg-gold/10 text-gold">{{ packages.length }} paquetes disponibles</span>
          <button @click="showCreateModal = true" class="px-4 py-2 bg-navy text-white text-sm font-bold rounded-xl hover:bg-navy-light transition-colors cursor-pointer">
            + Nuevo Paquete
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto p-6">
      <!-- KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl p-4 border border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase">Paquetes Activos</div>
          <div class="text-2xl font-black text-navy mt-1">{{ packages.length }}</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase">Tipos de Paquete</div>
          <div class="text-2xl font-black text-navy mt-1">{{ new Set(packages.map((p: any) => p.type)).size }}</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase">Precio Promedio</div>
          <div class="text-2xl font-black text-teal mt-1">\${{ packages.length ? Math.round(packages.reduce((s: number, p: any) => s + (p.precio || 0), 0) / packages.length) : 0 }}</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase">Valor Total Catálogo</div>
          <div class="text-2xl font-black text-navy mt-1">\${{ packages.reduce((s: number, p: any) => s + (p.precio || 0), 0).toLocaleString() }}</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 bg-white rounded-xl p-1 border border-border mb-6 w-fit">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer"
          :class="activeTab === tab.id ? 'bg-navy text-white' : 'text-text-muted hover:bg-surface'"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Packages Grid -->
      <div v-if="activeTab === 'packages'" class="grid md:grid-cols-3 gap-4">
        <div v-for="pkg in packages" :key="pkg.id" class="bg-white rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow">
          <div class="h-32 bg-gradient-to-br" :class="pkg.gradient"></div>
          <div class="p-5">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-black text-navy">{{ pkg.name }}</h3>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="pkg.active ? 'bg-teal/10 text-teal' : 'bg-surface text-text-muted'">
                {{ pkg.active ? 'Activo' : 'Inactivo' }}
              </span>
            </div>
            <p class="text-[10px] text-text-muted mb-3">{{ pkg.description }}</p>
            <div class="flex items-end justify-between mb-3">
              <div>
                <span class="text-xl font-black text-navy">${{ pkg.price }}</span>
                <span class="text-[10px] text-text-muted"> /{{ pkg.unit }}</span>
              </div>
              <span class="text-[10px] text-teal font-bold">{{ pkg.sold }} vendidos</span>
            </div>
            <div class="flex gap-2">
              <button class="flex-1 py-2 bg-surface text-navy text-[10px] font-bold rounded-lg hover:bg-navy hover:text-white transition-all cursor-pointer">
                Editar
              </button>
              <button class="flex-1 py-2 bg-surface text-coral text-[10px] font-bold rounded-lg hover:bg-coral hover:text-white transition-all cursor-pointer">
                {{ pkg.active ? 'Desactivar' : 'Activar' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Add New Package Card -->
        <button @click="showCreateModal = true" class="bg-white rounded-2xl border-2 border-dashed border-border p-6 flex flex-col items-center justify-center min-h-[280px] hover:border-cyan transition-colors cursor-pointer">
          <div class="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-2xl text-text-muted mb-3">+</div>
          <div class="text-sm font-bold text-text-muted">Crear Nuevo Paquete</div>
        </button>
      </div>

      <!-- Upsells List -->
      <div v-if="activeTab === 'upsells'" class="bg-white rounded-2xl border border-border p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-black text-navy">Servicios Adicionales</h2>
          <button class="px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl hover:bg-navy-light transition-colors cursor-pointer">
            + Nuevo Upsell
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-border">
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Servicio</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Categoría</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Precio</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Vendidos (Mes)</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Ingresos</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Estado</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="upsell in upsells" :key="upsell.id" class="border-b border-border/50 hover:bg-surface/50 transition-colors">
                <td class="py-3">
                  <div class="text-sm font-bold text-navy">{{ upsell.name }}</div>
                  <div class="text-[10px] text-text-muted">{{ upsell.description }}</div>
                </td>
                <td class="py-3">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="categoryClass(upsell.category)">
                    {{ upsell.category }}
                  </span>
                </td>
                <td class="py-3 text-sm font-bold text-navy">${{ upsell.price }}</td>
                <td class="py-3 text-sm text-navy">{{ upsell.sold }}</td>
                <td class="py-3 text-sm font-bold text-teal">${{ upsell.revenue }}</td>
                <td class="py-3">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="upsell.active ? 'bg-teal/10 text-teal' : 'bg-surface text-text-muted'">
                    {{ upsell.active ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td class="py-3">
                  <button class="text-[10px] font-bold text-cyan hover:underline cursor-pointer">Editar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top Sellers -->
      <div v-if="activeTab === 'analytics'" class="grid md:grid-cols-2 gap-6">
        <div class="bg-white rounded-2xl border border-border p-6">
          <h3 class="text-sm font-black text-navy mb-4">Top Upsells por Ingresos</h3>
          <div class="space-y-3">
            <div v-for="(item, idx) in topSellers" :key="idx" class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" :class="idx === 0 ? 'bg-gold/20 text-gold' : idx === 1 ? 'bg-gray-200 text-gray-600' : 'bg-orange-100 text-orange'">
                {{ idx + 1 }}
              </div>
              <div class="flex-1">
                <div class="text-sm font-bold text-navy">{{ item.name }}</div>
                <div class="text-[10px] text-text-muted">{{ item.sold }} vendidos</div>
              </div>
              <div class="text-sm font-bold text-navy">${{ item.revenue }}</div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-border p-6">
          <h3 class="text-sm font-black text-navy mb-4">Ingresos por Categoría</h3>
          <div class="space-y-4">
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-navy">🍽️ Gastronomía</span>
                <span class="text-xs font-bold text-navy">$1,840 (43%)</span>
              </div>
              <div class="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div class="h-full bg-cyan rounded-full" style="width: 43%"></div>
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-navy">🚗 Transporte</span>
                <span class="text-xs font-bold text-navy">$1,120 (26%)</span>
              </div>
              <div class="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div class="h-full bg-teal rounded-full" style="width: 26%"></div>
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-navy">💆 Bienestar</span>
                <span class="text-xs font-bold text-navy">$780 (18%)</span>
              </div>
              <div class="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div class="h-full bg-purple rounded-full" style="width: 18%"></div>
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-navy">🎁 Experiencias</span>
                <span class="text-xs font-bold text-navy">$500 (13%)</span>
              </div>
              <div class="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div class="h-full bg-gold rounded-full" style="width: 13%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Package Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showCreateModal = false">
      <div class="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 class="text-lg font-black text-navy mb-4">Crear Nuevo Paquete</h2>
        <div class="space-y-4">
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Nombre</label>
            <input v-model="newPackage.name" type="text" placeholder="Ej: Romantique Weekend" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan" />
          </div>
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Descripción</label>
            <textarea v-model="newPackage.description" rows="2" class="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan resize-none"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Precio</label>
              <input v-model="newPackage.price" type="number" placeholder="0.00" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan" />
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Unidad</label>
              <select v-model="newPackage.unit" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan cursor-pointer">
                <option value="estancia">Por estancia</option>
                <option value="noche">Por noche</option>
                <option value="persona">Por persona</option>
              </select>
            </div>
          </div>
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Incluye</label>
            <div class="space-y-2">
              <label v-for="(item, idx) in newPackage.includes" :key="idx" class="flex items-center gap-2 text-sm text-navy">
                <input type="checkbox" v-model="newPackage.includes[idx].checked" class="w-4 h-4 text-cyan rounded" />
                {{ item.label }}
              </label>
            </div>
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button @click="showCreateModal = false" class="flex-1 py-2.5 bg-surface text-navy text-sm font-bold rounded-xl hover:bg-navy hover:text-white transition-all cursor-pointer">
            Cancelar
          </button>
          <button @click="createPackage" class="flex-1 py-2.5 bg-navy text-white text-sm font-bold rounded-xl hover:bg-navy-light transition-colors cursor-pointer">
            Crear Paquete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { OperationsService } from '@/services/Operations.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const activeTab = ref('packages')
const showCreateModal = ref(false)

const tabs = [
  { id: 'packages', label: 'Paquetes' },
  { id: 'upsells', label: 'Servicios Adicionales' },
  { id: 'analytics', label: 'Analytics' },
]

const packages = reactive<any[]>([])

const upsells = ref<any[]>([])

const topSellers = computed(() =>
  [...upsells.value].sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0)).slice(0, 5).map((u: any) => ({ name: u.name, sold: u.sold ?? 0, revenue: String((u.sold ?? 0) * (u.price ?? 0)) })),
)

onMounted(async () => {
  try {
    const { data } = await OperationsService.paquetes(hotelId.value)
    const all = data.map((p: any, i: number) => ({
      id: p.id, name: p.nombre, description: p.description ?? '',
      price: p.precio, unit: 'noche', sold: 0, active: p.activo === 1,
      gradient: ['from-pink-400 to-rose-500','from-cyan to-teal','from-navy to-navy-light','from-blue to-cyan','from-purple to-indigo'][i % 5],
      type: p.type,
    }))
    packages.push(...all.filter((p: any) => p.type === 'combo' || p.type === 'upsell' || !p.type))
    upsells.value = all.filter((p: any) => p.type === 'servicio' || p.type === 'upsell')
  } catch { toast.error("Error al cargar datos") }
})

const newPackage = reactive({
  name: '',
  description: '',
  price: 0,
  unit: 'noche',
  includes: [
    { label: 'Habitación', checked: true },
    { label: 'Desayuno', checked: false },
    { label: 'Cena', checked: false },
    { label: 'Transfer', checked: false },
    { label: 'Spa', checked: false },
    { label: 'Actividades', checked: false },
  ],
})

function categoryClass(category: string) {
  const map: Record<string, string> = {
    'Gastronomía': 'bg-cyan/10 text-cyan',
    'Transporte': 'bg-teal/10 text-teal',
    'Bienestar': 'bg-purple/10 text-purple',
    'Experiencias': 'bg-gold/10 text-gold',
    'Servicios': 'bg-navy/10 text-navy',
  }
  return map[category] || 'bg-surface text-text-muted'
}

function createPackage() {
  packages.push({
    id: packages.length + 1,
    name: newPackage.name,
    description: newPackage.description,
    price: newPackage.price,
    unit: newPackage.unit,
    sold: 0,
    active: true,
    gradient: 'from-cyan to-teal',
  })
  showCreateModal.value = false
  newPackage.name = ''
  newPackage.description = ''
  newPackage.price = 0
}
</script>
