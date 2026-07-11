<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div></div>
      <button @click="openNewPlan" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">+ Nuevo Plan</button>
    </div>

    <div class="grid grid-cols-3 gap-6 mb-6">
      <div v-for="plan in plans" :key="plan.name" class="bg-white rounded-2xl border border-border card-shadow p-6 relative">
        <button @click="openEditPlan(plan)" class="absolute top-4 right-4 px-2 py-1 bg-surface rounded-lg text-[10px] font-bold hover:bg-surface-dark transition-colors cursor-pointer">Editar</button>
        <h3 class="text-lg font-black text-navy mb-2">{{ plan.name }}</h3>
        <div class="text-3xl font-black text-teal mb-2">${{ plan.price }}<span class="text-sm text-text-muted">/mes</span></div>
        <div class="text-sm text-text-secondary mb-4">{{ plan.description }}</div>
        <div class="space-y-2 mb-6">
          <div v-for="(feature, i) in plan.features" :key="i" class="flex items-center gap-2 text-sm">
            <span class="text-teal">✓</span><span>{{ feature }}</span>
          </div>
        </div>
        <div class="flex items-center justify-between pt-4 border-t border-border">
          <div><div class="text-2xl font-black text-navy">{{ plan.subscribers }}</div><div class="text-[10px] text-text-muted">suscriptores</div></div>
          <div class="text-right"><div class="text-sm font-bold text-teal">${{ (plan.price * plan.subscribers).toLocaleString() }}/mes</div><div class="text-[10px] text-text-muted">ingreso total</div></div>
        </div>
        <div class="mt-4 pt-4 border-t border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Límites</div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-surface rounded-lg p-2"><div class="text-sm font-black text-navy">{{ plan.maxRooms }}</div><div class="text-[9px] text-text-muted">Hab.</div></div>
            <div class="bg-surface rounded-lg p-2"><div class="text-sm font-black text-navy">{{ plan.maxUsers }}</div><div class="text-[9px] text-text-muted">Usuarios</div></div>
            <div class="bg-surface rounded-lg p-2"><div class="text-sm font-black text-navy">{{ plan.maxProperties }}</div><div class="text-[9px] text-text-muted">Propiedades</div></div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
      <div class="p-5 border-b border-border flex items-center justify-between">
        <h3 class="text-sm font-black text-navy">Historial de Pagos Recientes</h3>
        <div class="relative">
          <input v-model="searchQuery" type="text" placeholder="Buscar hotel..." class="w-64 h-9 pl-9 pr-4 rounded-lg border border-border text-sm bg-surface focus:outline-none focus:border-cyan">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>
      <table class="w-full">
        <thead><tr class="border-b border-border">
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Hotel</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Plan</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Monto</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Fecha</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
          <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
        </tr></thead>
        <tbody>
          <tr v-for="payment in filteredPayments" :key="payment.id" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
            <td class="p-4 text-sm font-bold text-navy">{{ payment.hotel }}</td>
            <td class="p-4"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="planClass(payment.plan)">{{ payment.plan }}</span></td>
            <td class="p-4 text-sm font-bold">${{ payment.amount }}</td>
            <td class="p-4 text-sm text-text-muted">{{ payment.date }}</td>
            <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="payment.status === 'Pagado' ? 'bg-teal/10 text-teal' : 'bg-orange/10 text-orange'">{{ payment.status }}</span></td>
            <td class="p-4 text-right">
              <div class="flex gap-1 justify-end">
                <button class="px-2 py-1 bg-cyan/10 text-cyan rounded-lg text-[10px] font-bold hover:bg-cyan/20 transition-colors cursor-pointer">Ver</button>
                <button class="px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 transition-colors cursor-pointer">Enviar Recordatorio</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal: Editar Plan -->
    <div v-if="showEditPlanModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl w-full max-w-lg card-shadow">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">{{ editingPlan.id ? 'Editar Plan' : 'Nuevo Plan' }}</h3>
          <button @click="showEditPlanModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2"><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Nombre del Plan *</label><input v-model="editingPlan.name" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
            <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Precio Mensual ($) *</label><input v-model.number="editingPlan.price" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
            <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Máx. Habitaciones *</label><input v-model.number="editingPlan.maxRooms" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
            <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Máx. Usuarios *</label><input v-model.number="editingPlan.maxUsers" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
            <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Máx. Propiedades *</label><input v-model.number="editingPlan.maxProperties" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
            <div class="col-span-2"><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Descripción</label><textarea v-model="editingPlan.description" rows="2" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy resize-none"></textarea></div>
            <div class="col-span-2"><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Features (una por línea)</label><textarea v-model="editingPlan.featuresText" rows="4" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy resize-none" placeholder="Hasta 30 habitaciones&#10;2 usuarios&#10;Reportes básicos"></textarea></div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showEditPlanModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cancelar</button>
          <button @click="savePlan" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer">Guardar Plan</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { PlatformService } from '@/services/Platform.service'

const searchQuery = ref('')
const showEditPlanModal = ref(false)
const editingPlan = ref<any>({})

const PLAN_DEF: Record<string, { price: number; description: string; features: string[]; maxRooms: number; maxUsers: number; maxProperties: number }> = {
  starter: { price: 49, description: 'Para hoteles pequeños', features: ['Hasta 30 habitaciones','2 usuarios','Reportes básicos','Soporte email'], maxRooms: 30, maxUsers: 2, maxProperties: 1 },
  professional: { price: 99, description: 'Para hoteles en crecimiento', features: ['Hasta 100 habitaciones','5 usuarios','Reportes avanzados','Channel Manager','Soporte prioritario'], maxRooms: 100, maxUsers: 5, maxProperties: 3 },
  enterprise: { price: 199, description: 'Para hoteles grandes y cadenas', features: ['Sin límite de habitaciones','Usuarios ilimitados','API Access','Soporte 24/7','Account manager'], maxRooms: 9999, maxUsers: 9999, maxProperties: 99 },
}

const plans = computed(() => {
  const subs = payments.value
  const counts: Record<string, number> = {}
  for (const p of subs) counts[String(p.plan).toLowerCase()] = (counts[String(p.plan).toLowerCase()] ?? 0) + 1
  return Object.entries(PLAN_DEF).map(([key, def], i) => ({
    id: i + 1, name: key.charAt(0).toUpperCase() + key.slice(1), price: def.price,
    description: def.description, features: def.features, subscribers: counts[key] ?? 0,
    maxRooms: def.maxRooms, maxUsers: def.maxUsers, maxProperties: def.maxProperties,
  }))
})

const payments = ref<any[]>([])

onMounted(async () => {
  try {
    const d = await PlatformService.subscriptions()
    payments.value = (d.data ?? []).map((h: any) => ({
      id: h.id,
      hotel: h.name,
      plan: h.plan ? (h.plan.charAt(0).toUpperCase() + h.plan.slice(1)) : 'Starter',
      amount: PLAN_DEF[String(h.plan).toLowerCase()]?.price ?? 49,
      date: h.createdAt ? String(h.createdAt).slice(0, 10) : '',
      status: h.status === 'pendiente' ? 'Pendiente' : h.status === 'suspendido' ? 'Vencido' : 'Pagado',
    }))
  } catch { /* silent */ }
})

const filteredPayments = computed(() => {
  if (!searchQuery.value) return payments.value
  const q = searchQuery.value.toLowerCase()
  return payments.value.filter(p => p.hotel.toLowerCase().includes(q))
})

const planClass = (plan: string) => ({ 'Enterprise': 'bg-navy/10 text-navy', 'Professional': 'bg-cyan/10 text-cyan', 'Starter': 'bg-teal/10 text-teal' }[plan] || 'bg-surface text-text-muted')

const openEditPlan = (plan: any) => { editingPlan.value = { ...plan, featuresText: plan.features.join('\n') }; showEditPlanModal.value = true }
const openNewPlan = () => { editingPlan.value = { id: null, name: '', price: 0, description: '', features: [], subscribers: 0, maxRooms: 0, maxUsers: 0, maxProperties: 0, featuresText: '' }; showEditPlanModal.value = true }

const savePlan = () => {
  if (!editingPlan.value.name || !editingPlan.value.price) return
  editingPlan.value.features = editingPlan.value.featuresText.split('\n').filter((f: string) => f.trim())
  if (editingPlan.value.id) {
    const idx = plans.value.findIndex(p => p.id === editingPlan.value.id)
    if (idx !== -1) plans.value[idx] = { ...editingPlan.value }
  } else {
    editingPlan.value.id = Date.now()
    plans.value.push({ ...editingPlan.value })
  }
  showEditPlanModal.value = false
}
</script>
