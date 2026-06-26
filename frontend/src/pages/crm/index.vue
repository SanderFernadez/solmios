<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">CRM y Fidelización</h2>
        <p class="text-sm text-text-muted mt-0.5">Segmentación, puntos, cupones y valor de vida del cliente</p>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-4 gap-4 mb-6" v-if="dashboard">
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-navy">{{ dashboard.totalGuests }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Total Huéspedes</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-teal">{{ dashboard.activeThisMonth }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Activos Este Mes</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-gold">{{ dashboard.totalPointsIssued.toLocaleString() }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Puntos Emitidos</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-cyan">${{ dashboard.avgLTV.toLocaleString() }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">LTV Promedio</div>
      </div>
    </div>

    <!-- Tiers -->
    <div class="grid grid-cols-5 gap-3 mb-6" v-if="dashboard">
      <div v-for="(count, tier) in dashboard.topTierCounts" :key="tier" class="card p-3 text-center" :class="tierBg(tier)">
        <div class="text-xl mb-1">{{ tierIcon(tier) }}</div>
        <div class="text-lg font-black">{{ count }}</div>
        <div class="text-[9px] font-bold uppercase">{{ tier }}</div>
      </div>
    </div>

    <div class="flex gap-2 mb-6">
      <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
        class="px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
        :class="activeTab === tab.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        {{ tab.label }}
      </button>
    </div>

    <!-- LTV -->
    <div v-if="activeTab === 'ltv' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border"><h3 class="font-extrabold text-navy text-sm">📈 Valor de Vida del Cliente (LTV)</h3></div>
      <table class="w-full">
        <thead><tr class="border-b bg-surface/50"><th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Huésped</th><th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Tier</th><th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estancias</th><th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Total Gastado</th><th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Promedio</th><th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Puntos</th><th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Última Visita</th><th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">LTV Score</th></tr></thead>
        <tbody><tr v-for="g in ltv" :key="g.guestId" class="border-b last:border-0 hover:bg-surface/50"><td class="p-4 text-sm font-bold text-navy">{{ g.name }}</td><td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="tierBadge(g.tier)">{{ g.tier }}</span></td><td class="p-4 text-sm">{{ g.totalStays }}</td><td class="p-4 text-sm font-bold">${{ g.totalSpent.toLocaleString() }}</td><td class="p-4 text-sm">${{ g.avgPerStay.toLocaleString() }}</td><td class="p-4 text-sm text-gold font-bold">{{ g.loyaltyPoints }}</td><td class="p-4 text-sm text-text-secondary">{{ g.daysSinceLastVisit <= 30 ? '🔥 ' + g.daysSinceLastVisit + 'd' : g.daysSinceLastVisit + 'd' }}</td><td class="p-4 text-right text-sm font-extrabold" :class="g.ltvScore >= 50 ? 'text-teal' : g.ltvScore >= 30 ? 'text-gold' : 'text-text-secondary'">{{ g.ltvScore }}</td></tr></tbody>
      </table>
      <div v-if="!ltv.length" class="p-8 text-center text-text-muted text-sm">Cargando LTV...</div>
    </div>

    <!-- Cupones -->
    <div v-if="activeTab === 'coupons' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between">
        <h3 class="font-extrabold text-navy text-sm">🎫 Cupones y Descuentos</h3>
        <button @click="showCouponForm = true" class="px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">+ Nuevo Cupón</button>
      </div>

      <div v-if="showCouponForm" class="p-4 border-b border-border bg-surface/50">
        <div class="grid grid-cols-5 gap-3">
          <input v-model="couponForm.code" placeholder="Código" class="col-span-1 px-3 py-2 rounded-lg border text-sm">
          <select v-model="couponForm.type" class="px-3 py-2 rounded-lg border text-sm"><option value="percentage">% Descuento</option><option value="fixed">$ Fijo</option></select>
          <input v-model.number="couponForm.value" type="number" placeholder="Valor" class="px-3 py-2 rounded-lg border text-sm">
          <input v-model.number="couponForm.minPurchase" type="number" placeholder="Compra mín" class="px-3 py-2 rounded-lg border text-sm">
          <input v-model="couponForm.expiresAt" type="date" class="px-3 py-2 rounded-lg border text-sm">
        </div>
        <div class="flex gap-2 mt-3">
          <button @click="createCoupon" class="px-4 py-2 bg-teal text-white rounded-lg text-xs font-bold cursor-pointer">Crear</button>
          <button @click="showCouponForm = false" class="px-4 py-2 border rounded-lg text-xs font-bold text-text-secondary cursor-pointer">Cancelar</button>
        </div>
      </div>

      <table class="w-full">
        <thead><tr class="border-b bg-surface/50"><th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Código</th><th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Tipo</th><th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Valor</th><th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Usos</th><th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Vence</th><th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acción</th></tr></thead>
        <tbody><tr v-for="c in coupons" :key="c.id" class="border-b last:border-0 hover:bg-surface/50"><td class="p-4 text-sm font-bold text-navy">{{ c.code }}</td><td class="p-4 text-sm">{{ c.type === 'percentage' ? '%' : '$' }}</td><td class="p-4 text-sm font-bold text-teal">{{ c.type === 'percentage' ? c.value + '%' : '$' + c.value }}</td><td class="p-4 text-sm">{{ c.useCount }}{{ c.maxUses ? '/' + c.maxUses : '' }}</td><td class="p-4 text-sm text-text-secondary">{{ c.expiresAt || 'Sin vencimiento' }}</td><td class="p-4 text-right"><button @click="deleteCoupon(c)" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">Eliminar</button></td></tr></tbody>
      </table>
      <div v-if="!coupons.length" class="p-8 text-center text-text-muted text-sm">No hay cupones. Creá el primero.</div>
    </div>

    <!-- Validar cupón -->
    <div v-if="activeTab === 'validate' && !loading" class="max-w-md mx-auto card p-6">
      <h3 class="font-extrabold text-navy text-sm mb-4">💳 Validar Cupón</h3>
      <div class="space-y-3">
        <input v-model="validateCode" placeholder="Código del cupón" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm">
        <input v-model.number="validateAmount" type="number" placeholder="Monto de la compra" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm">
        <button @click="doValidateCoupon" class="w-full py-3 bg-teal text-white rounded-xl text-sm font-bold hover:bg-teal-light cursor-pointer">Validar</button>
      </div>
      <div v-if="validatedCoupon" class="mt-4 p-4 bg-teal/5 border border-teal/20 rounded-xl">
        <div class="font-extrabold text-teal text-lg">{{ validatedCoupon.code }}</div>
        <div class="text-sm">Descuento: <b>{{ validatedCoupon.type === 'percentage' ? validatedCoupon.value + '%' : '$' + validatedCoupon.value }}</b></div>
      </div>
    </div>

    <!-- Segmentos -->
    <div v-if="activeTab === 'segments' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between">
        <h3 class="font-extrabold text-navy text-sm">🎯 Segmentos de Huéspedes</h3>
        <button @click="showSegmentForm = true" class="px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">+ Nuevo</button>
      </div>

      <div v-if="showSegmentForm" class="p-4 border-b bg-surface/50">
        <div class="grid grid-cols-3 gap-3">
          <input v-model="segmentForm.name" placeholder="Nombre" class="px-3 py-2 rounded-lg border text-sm">
          <select v-model="segmentForm.tier" class="px-3 py-2 rounded-lg border text-sm"><option value="">Cualquier tier</option><option value="bronze">Bronze</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="platinum">Platinum</option><option value="diamond">Diamond</option></select>
          <input v-model.number="segmentForm.minStays" type="number" placeholder="Mín estancias" class="px-3 py-2 rounded-lg border text-sm">
        </div>
        <div class="flex gap-2 mt-3">
          <button @click="createSegment" class="px-4 py-2 bg-teal text-white rounded-lg text-xs font-bold cursor-pointer">Crear</button>
          <button @click="showSegmentForm = false" class="px-4 py-2 border rounded-lg text-xs font-bold text-text-secondary cursor-pointer">Cancelar</button>
        </div>
      </div>

      <div class="p-4 grid grid-cols-3 gap-4">
        <div v-for="s in segments" :key="s.id" class="p-4 bg-surface rounded-xl">
          <div class="font-extrabold text-navy text-sm mb-1">{{ s.name }}</div>
          <div class="text-[10px] text-text-muted mb-2">{{ s.description || 'Segmento dinámico' }} · {{ s.count }} huéspedes</div>
          <button @click="viewSegmentGuests(s)" class="text-[10px] text-cyan font-bold hover:underline cursor-pointer">Ver huéspedes →</button>
        </div>
        <div v-if="!segments.length" class="col-span-3 p-8 text-center text-text-muted text-sm">No hay segmentos definidos</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { CrmService, type Coupon, type GuestSegment, type GuestLTV, type CrmDashboard } from '@/services/Crm.service'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const activeTab = ref('ltv')
const loading = ref(true)

const tabs = [
  { value: 'ltv', label: '📈 LTV' },
  { value: 'coupons', label: '🎫 Cupones' },
  { value: 'validate', label: '💳 Validar' },
  { value: 'segments', label: '🎯 Segmentos' },
]

const dashboard = ref<CrmDashboard | null>(null)
const ltv = ref<GuestLTV[]>([])
const coupons = ref<Coupon[]>([])
const segments = ref<GuestSegment[]>([])

const showCouponForm = ref(false)
const showSegmentForm = ref(false)
const couponForm = ref({ code: '', type: 'percentage', value: 10, minPurchase: 0, expiresAt: '' })
const segmentForm = ref({ name: '', tier: '', minStays: 0 })
const validateCode = ref('')
const validateAmount = ref(0)
const validatedCoupon = ref<Coupon | null>(null)

function tierIcon(t: string) { return { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎', diamond: '👑' }[t] || '👤' }
function tierBg(t: string) { return { bronze: 'bg-amber-50', silver: 'bg-gray-50', gold: 'bg-yellow-50', platinum: 'bg-cyan-50', diamond: 'bg-purple-50' }[t] || '' }
function tierBadge(t: string) { return { bronze: 'bg-amber-100 text-amber-700', silver: 'bg-gray-200 text-gray-700', gold: 'bg-yellow-100 text-yellow-700', platinum: 'bg-cyan-100 text-cyan-700', diamond: 'bg-purple-100 text-purple-700' }[t] || '' }

async function loadData() {
  loading.value = true
  try {
    const [d, l, c, s] = await Promise.all([CrmService.getDashboard(), CrmService.getLTV(), CrmService.listCoupons(), CrmService.listSegments()])
    dashboard.value = d; ltv.value = l; coupons.value = c; segments.value = s
  } catch { toast.error('Error al cargar') }
  finally { loading.value = false }
}
onMounted(loadData)

async function createCoupon() {
  if (!couponForm.value.code) { toast.warning('Código requerido'); return }
  try { await CrmService.createCoupon(couponForm.value); toast.success('Cupón creado'); showCouponForm.value = false; couponForm.value = { code: '', type: 'percentage', value: 10, minPurchase: 0, expiresAt: '' }; loadData() }
  catch { toast.error('Error') }
}
async function deleteCoupon(c: Coupon) { try { await CrmService.deleteCoupon(c.id); toast.success('Eliminado'); loadData() } catch { toast.error('Error') } }
async function doValidateCoupon() {
  try { validatedCoupon.value = await CrmService.validateCoupon(validateCode.value, validateAmount.value); toast.success('¡Cupón válido!') }
  catch { validatedCoupon.value = null; toast.error('Cupón inválido o expirado') }
}
async function createSegment() {
  const rules: any = {}
  if (segmentForm.value.tier) rules.tier = segmentForm.value.tier
  if (segmentForm.value.minStays > 0) rules.minStays = segmentForm.value.minStays
  try { await CrmService.createSegment({ name: segmentForm.value.name, rules: JSON.stringify(rules) }); toast.success('Segmento creado'); showSegmentForm.value = false; segmentForm.value = { name: '', tier: '', minStays: 0 }; loadData() }
  catch { toast.error('Error') }
}
function viewSegmentGuests(s: GuestSegment) { toast.info(`${s.name}: ${s.count} huéspedes`) }
</script>
