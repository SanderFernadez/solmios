<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { http } from '@/services/http'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const gastos = ref<any[]>([])
const showNew = ref(false)
const submitting = ref(false)
const form = ref({
  concept: '',
  amount: 0,
  category: 'general',
  provider: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
})
const loading = ref(false)
const error = ref('')

onMounted(loadData)

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const r = await http.get<any>('/gastos?hotelId=' + (hotelId.value ?? ''))
    gastos.value = r.data || []
  } catch (e: any) {
    error.value = e?.message || 'No se pudieron cargar los gastos'
  } finally {
    loading.value = false
  }
}

const total = computed(() => gastos.value.reduce((s: number, g: any) => s + (g.amount || 0), 0))

async function saveGasto() {
  if (!form.value.concept || !form.value.amount) {
    error.value = 'Completa concepto e importe'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    await http.post('/gastos', { ...form.value, hotelId: hotelId.value })
    showNew.value = false
    form.value = { concept: '', amount: 0, category: 'general', provider: '', date: new Date().toISOString().split('T')[0], notes: '' }
    await loadData()
  } catch (e: any) {
    error.value = e?.message || 'No se pudo guardar el gasto'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-2xl border p-6">
    <div class="flex justify-between mb-6">
      <div>
        <h2 class="text-lg font-black">Gastos</h2>
        <p class="text-xs text-text-muted">Total: ${{ total.toLocaleString() }}</p>
      </div>
      <button @click="showNew = !showNew" class="px-4 py-2 bg-navy text-white text-sm font-bold rounded-xl cursor-pointer">+ Nuevo</button>
    </div>

    <div v-if="error" class="mb-4 px-4 py-2 rounded-lg bg-coral/10 text-coral text-xs font-bold">{{ error }}</div>

    <div v-if="showNew" class="bg-surface rounded-xl p-4 mb-4 space-y-3">
      <input v-model="form.concept" placeholder="Concepto" class="w-full px-3 py-2 rounded-lg border text-sm" />
      <div class="flex gap-3">
        <input v-model.number="form.amount" type="number" placeholder="Importe" class="w-32 px-3 py-2 rounded-lg border text-sm" />
        <select v-model="form.category" class="px-3 py-2 rounded-lg border text-sm">
          <option value="general">General</option><option value="supplies">Suministros</option>
          <option value="maintenance">Mantenimiento</option><option value="cleaning">Limpieza</option>
          <option value="staff">Personal</option><option value="marketing">Marketing</option>
        </select>
        <input v-model="form.provider" placeholder="Proveedor" class="flex-1 px-3 py-2 rounded-lg border text-sm" />
      </div>
      <input v-model="form.date" type="date" class="px-3 py-2 rounded-lg border text-sm" />
      <button @click="saveGasto" :disabled="submitting" class="px-4 py-2 bg-teal text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50">{{ submitting ? 'Guardando...' : 'Guardar' }}</button>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full" v-if="gastos.length">
        <thead><tr class="border-b"><th class="text-left py-2 text-xs font-bold uppercase">Concepto</th><th class="text-left py-2 text-xs font-bold uppercase">Categoría</th><th class="text-right py-2 text-xs font-bold uppercase">Importe</th><th class="text-left py-2 text-xs font-bold uppercase">Fecha</th><th class="text-left py-2 text-xs font-bold uppercase">Proveedor</th></tr></thead>
        <tbody><tr v-for="g in gastos" :key="g.id" class="border-b border-border/50"><td class="py-2 text-sm font-bold">{{ g.concept }}</td><td class="py-2 text-xs">{{ g.category }}</td><td class="py-2 text-sm text-right font-bold">${{ (g.amount || 0).toLocaleString() }}</td><td class="py-2 text-xs text-text-muted">{{ (g.date || '').slice(0, 10) }}</td><td class="py-2 text-xs">{{ g.provider || '—' }}</td></tr></tbody>
      </table>
      <div v-else-if="!loading" class="text-center text-text-muted text-sm py-8">No hay gastos registrados</div>
      <div v-else class="text-center text-text-muted text-sm py-8">Cargando...</div>
    </div>
  </div>
</template>
