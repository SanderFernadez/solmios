<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-black text-navy">Programa Aliados</h1>
      <p class="text-sm text-text-muted">Comisión en dinero por referidos validados — evolución del Programa de Referidos</p>
    </div>

    <SectionCard title="Tramos de comisión" subtitle="% que cobra un Aliado normal según cuántos referidos validados acumula" class="mb-6">
      <template #actions>
        <button type="button" @click="openNewTier" class="bg-cyan text-navy font-extrabold text-xs px-4 py-2 rounded-lg hover:shadow-lg transition-all cursor-pointer">+ Tramo</button>
      </template>
      <SkeletonLoader v-if="loadingTiers" variant="table" :rows="3" />
      <EmptyState v-else-if="!tiers.length" title="Sin tramos configurados" message="Sin tramos, un Aliado normal no acumula comisión aunque valide referidos." />
      <div v-else class="overflow-x-auto">
        <table class="w-full tbl-head">
          <thead><tr class="border-b border-border">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Desde el referido validado nº</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">% de comisión</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr></thead>
          <tbody>
            <tr v-for="t in tiers" :key="t.id" class="border-b border-border last:border-0">
              <td class="p-4 text-sm font-bold text-navy">{{ t.fromCount }}</td>
              <td class="p-4 text-sm">{{ t.percent }}%</td>
              <td class="p-4 text-right space-x-2">
                <button type="button" @click="openEditTier(t)" class="px-3 py-1.5 bg-surface border border-border rounded-lg text-[11px] font-bold text-navy hover:bg-surface-dark transition-colors cursor-pointer">Editar</button>
                <button type="button" @click="removeTier(t)" class="px-3 py-1.5 bg-danger/10 text-danger rounded-lg text-[11px] font-bold hover:bg-danger/20 transition-colors cursor-pointer">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-4 p-3 bg-surface rounded-xl text-xs text-text-secondary">
        El Aliado Certificado no usa estos tramos: cobra siempre 20% fijo por diseño de negocio.
      </div>
    </SectionCard>

    <SectionCard title="Partners" :subtitle="`${partners.length} hoteles convertidos a Aliado`" class="mb-6">
      <SkeletonLoader v-if="loadingPartners" variant="table" :rows="4" />
      <EmptyState v-else-if="!partners.length" title="Todavía no hay Aliados" message="Ningún hotel se convirtió en Aliado todavía." />
      <div v-else class="overflow-x-auto">
        <table class="w-full tbl-head">
          <thead><tr class="border-b border-border">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Hotel</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Tipo</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Modalidad</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Aliado desde</th>
          </tr></thead>
          <tbody>
            <tr v-for="p in partners" :key="p.id" class="border-b border-border last:border-0">
              <td class="p-4 text-sm font-bold text-navy">{{ hotelName(p.hotelId) }}</td>
              <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="p.type === 'aliado_certificado' ? 'bg-gold/10 text-gold' : 'bg-cyan/10 text-cyan'">{{ TYPE_LABELS[p.type] }}</span></td>
              <td class="p-4 text-sm text-text-secondary">{{ PAYOUT_MODE_LABELS[p.payoutMode] }}</td>
              <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="p.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-danger/10 text-danger'">{{ STATUS_LABELS[p.status] }}</span></td>
              <td class="p-4 text-sm text-text-muted">{{ p.becamePartnerAt ? new Date(p.becamePartnerAt).toLocaleDateString('es-DO') : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>

    <SectionCard title="Solicitudes de certificación" subtitle="Un Aliado pide subir a 20% fijo demostrando experiencia técnica" class="mb-6">
      <SkeletonLoader v-if="loadingRequests" variant="table" :rows="3" />
      <EmptyState v-else-if="!requests.length" title="Sin solicitudes" message="Todavía nadie pidió certificarse." />
      <div v-else class="overflow-x-auto">
        <table class="w-full tbl-head">
          <thead><tr class="border-b border-border">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Hotel</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Enviada</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr></thead>
          <tbody>
            <tr v-for="r in requests" :key="r.id" class="border-b border-border last:border-0 align-top">
              <td class="p-4">
                <div class="text-sm font-bold text-navy">{{ hotelName(r.hotelId) }}</div>
                <div class="mt-1 space-y-0.5">
                  <p v-for="(v, k) in r.answers" :key="k" class="text-[11px] text-text-muted"><span class="font-bold">{{ k }}:</span> {{ v }}</p>
                </div>
              </td>
              <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="certStatusClass(r.status)">{{ CERT_STATUS_LABELS[r.status] }}</span></td>
              <td class="p-4 text-sm text-text-muted">{{ r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-DO') : '—' }}</td>
              <td class="p-4 text-right space-x-2">
                <template v-if="r.status === 'pending'">
                  <button type="button" @click="handleApprove(r)" :disabled="reviewingId === r.id"
                    class="px-3 py-1.5 bg-teal/10 text-teal rounded-lg text-[11px] font-bold hover:bg-teal/20 transition-colors cursor-pointer disabled:opacity-50">Aprobar</button>
                  <button type="button" @click="handleReject(r)" :disabled="reviewingId === r.id"
                    class="px-3 py-1.5 bg-danger/10 text-danger rounded-lg text-[11px] font-bold hover:bg-danger/20 transition-colors cursor-pointer disabled:opacity-50">Rechazar</button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>

    <!-- El backend (12 endpoints del módulo aliados) no expone un listado de comisiones para el
         admin — solo hotel-side (/aliados/me) sabe el detalle de las suyas. Marcar como pagada se
         hace por ID (el super_admin lo consigue en la tabla de comisiones que ve el hotel, o en la
         base). Documentado también en el reporte final de la tarea. -->
    <SectionCard title="Marcar comisión como pagada" subtitle="Registro manual — el pago en sí se hace por fuera del sistema">
      <form @submit.prevent="handleMarkPaid" class="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div class="flex-1 w-full">
          <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">ID de la comisión</label>
          <input v-model.trim="markPaidId" type="text" placeholder="ID de partner_commissions"
            class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
        </div>
        <button type="submit" :disabled="markingPaid || !markPaidId"
          class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50 shrink-0">
          {{ markingPaid ? 'Marcando...' : 'Marcar como pagada' }}
        </button>
      </form>
    </SectionCard>

    <AppModal v-if="showTierModal" size="sm" :title="`${editingTier ? 'Editar' : 'Nuevo'} tramo`" @close="showTierModal = false">
      <div class="space-y-4">
        <div>
          <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Desde el referido validado nº</label>
          <input v-model.number="tierForm.fromCount" type="number" min="0" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">% de comisión</label>
          <input v-model.number="tierForm.percent" type="number" min="0" max="100" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm" />
        </div>
      </div>
      <template #footer>
        <button @click="showTierModal = false" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
        <button @click="saveTier" :disabled="savingTier" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">{{ savingTier ? 'Guardando...' : 'Guardar' }}</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { SuperAdminService } from '@/services/SuperAdmin.service'
import { AliadosAdminService, type PartnerCommissionTierDTO } from '@/services/AliadosAdmin.service'
import type { PartnerDTO, PartnerCertificationRequestDTO, PartnerType, PartnerStatus, PayoutMode, CertificationStatus } from '@/services/Aliados.service'

const toast = useToast()

const loadingTiers = ref(true)
const loadingPartners = ref(true)
const loadingRequests = ref(true)
const savingTier = ref(false)
const reviewingId = ref<string | null>(null)
const markingPaid = ref(false)

const tiers = ref<PartnerCommissionTierDTO[]>([])
const partners = ref<PartnerDTO[]>([])
const requests = ref<PartnerCertificationRequestDTO[]>([])
const hotelsById = ref<Record<string, string>>({})
const markPaidId = ref('')

const showTierModal = ref(false)
const editingTier = ref<PartnerCommissionTierDTO | null>(null)
const tierForm = ref({ fromCount: 0, percent: 10 })

const TYPE_LABELS: Record<PartnerType, string> = { aliado: 'Aliado', aliado_certificado: 'Aliado Certificado' }
const STATUS_LABELS: Record<PartnerStatus, string> = { active: 'Activo', inactive: 'Inactivo' }
const PAYOUT_MODE_LABELS: Record<PayoutMode, string> = { monthly: 'Mensual', one_time: 'Pago único' }
const CERT_STATUS_LABELS: Record<CertificationStatus, string> = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' }

function certStatusClass(s: CertificationStatus): string {
  return { pending: 'bg-warning/10 text-warning', approved: 'bg-teal/10 text-teal', rejected: 'bg-danger/10 text-danger' }[s]
}
function hotelName(hotelId: string): string {
  return hotelsById.value[hotelId] ?? hotelId
}

async function loadHotels() {
  try {
    const { hotels } = await SuperAdminService.hotels()
    hotelsById.value = Object.fromEntries(hotels.map((h: any) => [h.id, h.name]))
  } catch {
    // No bloquea el resto de la página — solo degrada a mostrar el hotelId crudo.
  }
}

async function loadTiers() {
  loadingTiers.value = true
  try {
    const { data } = await AliadosAdminService.listTiers()
    tiers.value = [...data].sort((a, b) => a.fromCount - b.fromCount)
  } catch (e: any) {
    toast.error(e.message || 'No se pudieron cargar los tramos de comisión')
  } finally {
    loadingTiers.value = false
  }
}

async function loadPartners() {
  loadingPartners.value = true
  try {
    const { data } = await AliadosAdminService.listPartners()
    partners.value = data
  } catch (e: any) {
    toast.error(e.message || 'No se pudieron cargar los Aliados')
  } finally {
    loadingPartners.value = false
  }
}

async function loadRequests() {
  loadingRequests.value = true
  try {
    const { data } = await AliadosAdminService.listCertificationRequests()
    requests.value = data
  } catch (e: any) {
    toast.error(e.message || 'No se pudieron cargar las solicitudes de certificación')
  } finally {
    loadingRequests.value = false
  }
}

function openNewTier() {
  editingTier.value = null
  tierForm.value = { fromCount: (tiers.value[tiers.value.length - 1]?.fromCount ?? 0) + 5, percent: 10 }
  showTierModal.value = true
}
function openEditTier(t: PartnerCommissionTierDTO) {
  editingTier.value = t
  tierForm.value = { fromCount: t.fromCount, percent: t.percent }
  showTierModal.value = true
}

/** El backend reemplaza TODO el set de tramos en un solo PUT (replaceAll) — a diferencia de
 *  Referidos (create/update/delete individual), acá se arma el array completo en el cliente
 *  y se manda entero cada vez que cambia algo. */
async function persistTiers(items: Array<{ fromCount: number; percent: number; sortOrder: number }>) {
  const saved = await AliadosAdminService.replaceTiers(items)
  tiers.value = [...saved].sort((a, b) => a.fromCount - b.fromCount)
}

async function saveTier() {
  savingTier.value = true
  try {
    const rest = tiers.value
      .filter((t) => !editingTier.value || t.id !== editingTier.value.id)
      .map((t) => ({ fromCount: t.fromCount, percent: t.percent, sortOrder: t.fromCount }))
    rest.push({ fromCount: tierForm.value.fromCount, percent: tierForm.value.percent, sortOrder: tierForm.value.fromCount })
    await persistTiers(rest)
    toast.success('Tramo guardado')
    showTierModal.value = false
  } catch (e: any) {
    toast.error(e.message || 'No se pudo guardar el tramo')
  } finally {
    savingTier.value = false
  }
}

async function removeTier(t: PartnerCommissionTierDTO) {
  try {
    const rest = tiers.value.filter((x) => x.id !== t.id).map((x) => ({ fromCount: x.fromCount, percent: x.percent, sortOrder: x.fromCount }))
    await persistTiers(rest)
    toast.success('Tramo eliminado')
  } catch (e: any) {
    toast.error(e.message || 'No se pudo eliminar el tramo')
  }
}

async function handleApprove(r: PartnerCertificationRequestDTO) {
  reviewingId.value = r.id
  try {
    await AliadosAdminService.approveCertification(r.id)
    toast.success('Certificación aprobada')
    await Promise.all([loadRequests(), loadPartners()])
  } catch (e: any) {
    toast.error(e.message || 'No se pudo aprobar la solicitud')
  } finally {
    reviewingId.value = null
  }
}

async function handleReject(r: PartnerCertificationRequestDTO) {
  reviewingId.value = r.id
  try {
    await AliadosAdminService.rejectCertification(r.id)
    toast.success('Certificación rechazada')
    await loadRequests()
  } catch (e: any) {
    toast.error(e.message || 'No se pudo rechazar la solicitud')
  } finally {
    reviewingId.value = null
  }
}

async function handleMarkPaid() {
  if (!markPaidId.value) return
  markingPaid.value = true
  try {
    await AliadosAdminService.markCommissionPaid(markPaidId.value)
    toast.success('Comisión marcada como pagada')
    markPaidId.value = ''
  } catch (e: any) {
    toast.error(e.message || 'No se pudo marcar la comisión como pagada')
  } finally {
    markingPaid.value = false
  }
}

onMounted(() => {
  loadHotels()
  loadTiers()
  loadPartners()
  loadRequests()
})
</script>
