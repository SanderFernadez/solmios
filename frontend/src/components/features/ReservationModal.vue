<script setup lang="ts">
// components/features/ReservationModal.vue — Detalle de reserva completo (F3 match-misterplan).
// Modal two-panel en modo LECTURA. Botón "Editar" emite @edit (el padre abre el form existente).
// Acciones: Confirmar / Anular / Imprimir (detalle + bono alojamiento + bono cliente).
// Spec: openspec/changes/match-misterplan/specs/reservation-modal/spec.md (REQ-1 a REQ-12).

import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ReservationService } from '@/services/Reservation.service'
import { PaymentsService } from '@/services/Payments.service'
import { FoliosService } from '@/services/Folios.service'
import { AutoMessagesService } from '@/services/AutoMessages.service'
import { AddonsService } from '@/services/Addons.service'
import { ConfigService } from '@/services/Platform.service'
import { useToast } from '@/composables/useToast'
import { nationalityToFlag, languageToFlag } from '@/composables/useCountryFlag'
import type { ReservationDetail, ReservationDetailAddon, CurrencyConfig, GuaranteeCardData, AuditLogEntry } from '@/types'

const props = defineProps<{ reservationId: string }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'edit', detail: ReservationDetail): void
  (e: 'changed'): void
}>()

const router = useRouter()
const toast = useToast()
const MS_PER_DAY = 86_400_000

const detail = ref<ReservationDetail | null>(null)
const loading = ref(true)
const saving = ref(false)
const showCancel = ref(false)
const autoSend = ref(true)
const conditions = ref({ gdpr: false, marketing: false, terms: false })
const otherCharges = ref(0)
const otherChargesDraft = ref('0')
const currency = ref<CurrencyConfig | null>(null)
const waTemplates = ref<{ id?: string; title?: string; channel?: string; whatsappBody?: string | null }[]>([])
const addons = ref<ReservationDetailAddon[]>([])
const auditLogs = ref<AuditLogEntry[]>([])
const newAddon = ref({ description: '', amount: 0, kind: 'service' as 'service' | 'discount' })
const folioCharges = ref<{ description?: string; amount?: number; kind?: string }[] | null>(null)
type PrintMode = 'detail' | 'voucherLodging' | 'voucherClient'
const printMode = ref<PrintMode>('detail')

// Tarjeta de garantía (MisterPlan): se revela solo tras ingresar el PIN del hotel.
const guaranteeUnlocked = ref(false)
const guaranteePin = ref('')
const guaranteeCard = ref<GuaranteeCardData | null>(null)
const guaranteeError = ref('')
const unlocking = ref(false)

async function unlockGuarantee() {
  if (!d.value) return
  guaranteeError.value = ''
  unlocking.value = true
  try {
    guaranteeCard.value = await ReservationService.unlockGuaranteeCard(d.value.id, guaranteePin.value)
    guaranteeUnlocked.value = true
  } catch (e) {
    guaranteeError.value = (e as Error).message || 'PIN incorrecto'
    guaranteeUnlocked.value = false
  } finally {
    unlocking.value = false
  }
}

const CARD_BRANDS: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover', other: 'Otra' }
function cardBrandLabel(b?: string): string {
  if (!b) return '—'
  return CARD_BRANDS[b] || b
}

// ── Carga ──
async function load() {
  loading.value = true
  guaranteeUnlocked.value = false
  guaranteeCard.value = null
  guaranteePin.value = ''
  guaranteeError.value = ''
  try {
    const d = await ReservationService.getById(props.reservationId)
    detail.value = d
    autoSend.value = d?.autoSendEnabled ?? true
    conditions.value = { gdpr: !!d?.gdprAccepted, marketing: !!d?.marketingAccepted, terms: !!d?.termsAccepted }
    otherCharges.value = d?.otherCharges ?? 0
    otherChargesDraft.value = String(d?.otherCharges ?? 0)
    addons.value = d?.addons ?? []
    // Config + plantillas WA en paralelo (no bloquean el detalle)
    Promise.all([
      ConfigService.get('currency_config').then((c: CurrencyConfig) => { currency.value = c }).catch(() => {}),
      AutoMessagesService.list().then((r) => {
        waTemplates.value = (r.data || []).filter((m) => m.channel === 'whatsapp' || m.channel === 'both')
      }).catch(() => {}),
      ReservationService.getAudit(props.reservationId).then((r) => { auditLogs.value = r.data || [] }).catch(() => {}),
    ]).catch(() => {})
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo cargar la reserva')
    emit('close')
  } finally {
    loading.value = false
  }
}

// D7 — Historial (audit trail): etiquetas legibles + formato de fecha.
function auditLabel(action: string): string {
  const m: Record<string, string> = {
    create: '📝 Reserva creada', update: '✏️ Actualizada', delete: '🗑️ Eliminada',
    checkin: '🛎️ Check-in', checkout: '🚪 Check-out', no_show: '⏰ No-show',
  }
  return m[action] || action
}
function fmtAuditDate(iso?: string | null): string {
  if (!iso) return '—'
  const dt = new Date(iso)
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

watch(() => props.reservationId, (id) => { if (id) load() }, { immediate: true })

// ── Computed ──
const d = computed(() => detail.value)
const nights = computed(() => {
  if (!d.value?.checkIn || !d.value?.checkOut) return 0
  return Math.max(1, Math.round((new Date(d.value.checkOut).getTime() - new Date(d.value.checkIn).getTime()) / MS_PER_DAY))
})
const pending = computed(() => d.value?.pendingAmount ?? Math.max(0, (d.value?.totalAmount ?? 0) - (d.value?.deposit ?? 0)))
const pricePerNight = computed(() => {
  const n = nights.value
  return n > 0 ? Math.round(((d.value?.totalAmount ?? 0) / n) * 100) / 100 : d.value?.room?.basePrice ?? 0
})
const locator = computed(() => d.value?.externalLocator || `#${(d.value?.id || '').slice(-6)}`)
const addonsTotal = computed(() => addons.value.reduce((s, a) => s + (a.kind === 'discount' ? -1 : 1) * (a.amount ?? 0) * (a.quantity ?? 1), 0))
const grandTotal = computed(() => (d.value?.totalAmount ?? 0) + (otherCharges.value || 0) + addonsTotal.value)
const secondaryTotal = computed(() => {
  const rate = currency.value?.exchangeRate
  return rate && rate > 0 ? Math.round(grandTotal.value * rate * 100) / 100 : null
})
const secondaryCurrency = computed(() => currency.value?.secondaryCurrency || 'DOP')
const checkinUrl = computed(() => d.value?.checkinCode ? `${window.location.origin}/checkin/${d.value.checkinCode}` : null)

// ── Helpers de formato ──
function fmtDate(s?: string | null): string {
  if (!s) return '—'
  const dt = new Date(s.length <= 10 ? `${s}T12:00:00` : s)
  return isNaN(dt.getTime()) ? String(s) : dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDateTime(s?: string | null): string {
  if (!s) return '—'
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? String(s) : dt.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function money(n?: number): string {
  const cur = d.value?.currency || 'USD'
  const sym = cur === 'USD' ? 'US$' : cur === 'DOP' ? 'RD$' : cur + ' '
  return `${sym}${(n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function moneySecondary(n: number): string {
  return `${secondaryCurrency.value === 'DOP' ? 'RD$' : secondaryCurrency.value + ' '}${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function stLabel(s?: string): string {
  const m: Record<string, string> = { pending: 'Pendiente', confirmed: 'Confirmada', checked_in: 'Check-in', checked_out: 'Check-out', cancelled: 'Cancelada', no_show: 'No-show' }
  return m[s || ''] || s || '—'
}
function stClass(s?: string): string {
  const m: Record<string, string> = { pending: 'bg-gold/10 text-gold', confirmed: 'bg-teal/10 text-teal', checked_in: 'bg-cyan/10 text-cyan', checked_out: 'bg-gray-100 text-gray-500', cancelled: 'bg-coral/10 text-coral', no_show: 'bg-coral/10 text-coral' }
  return m[s || ''] || 'bg-gray-100 text-gray-500'
}
function srcLabel(s?: string): string {
  const m: Record<string, string> = { direct: 'Directa', booking: 'Booking', expedia: 'Expedia', airbnb: 'Airbnb', agoda: 'Agoda', trip: 'Trip', google: 'Google', whatsapp: 'WhatsApp', phone: 'Teléfono', email: 'Email', walk_in: 'Walk-in' }
  return m[s || ''] || (s || '—')
}
function srcClass(s?: string): string {
  const m: Record<string, string> = { direct: 'bg-teal/10 text-teal', booking: 'bg-cyan/10 text-cyan', expedia: 'bg-gold/10 text-gold', airbnb: 'bg-coral/10 text-coral', google: 'bg-blue-100 text-blue-700', whatsapp: 'bg-emerald-100 text-emerald-700', agoda: 'bg-purple-100 text-purple-700', trip: 'bg-pink-100 text-pink-700' }
  return m[s || ''] || 'bg-gray-100 text-gray-500'
}
function regimeLabel(r?: string): string {
  const m: Record<string, string> = { room_only: 'Solo alojamiento', breakfast: 'Desayuno incluido', half_board: 'Media pensión', full_board: 'Pensión completa', all_inclusive: 'Todo incluido' }
  return m[r || ''] || (r || '—')
}
function payMethodLabel(p?: string | null): string {
  const m: Record<string, string> = { transfer: 'Transferencia', card: 'Tarjeta', cash: 'Efectivo', link: 'Link de pago', deposit: 'Depósito' }
  return m[p || ''] || (p || 'No especificado')
}
function payStatusBadge(dep?: number, total?: number): { label: string; cls: string } {
  const t = total ?? 0
  const dd = dep ?? 0
  if (dd <= 0) return { label: 'Sin anticipo', cls: 'bg-coral/10 text-coral' }
  if (dd >= t) return { label: 'Pagado', cls: 'bg-teal/10 text-teal' }
  return { label: 'Parcial', cls: 'bg-gold/10 text-gold' }
}
function waLink(phone?: string | null, body?: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}${body ? `?text=${encodeURIComponent(body)}` : ''}` : null
}
/** Iconos de servicios según tipo de habitación (visual, como MisterPlan). */
function serviceIcons(type?: string): string[] {
  const base = ['🛏️', '🚿', '📺', '📶']
  const m: Record<string, string[]> = { suite: ['🥂', '🛁'], villa: ['🏊', '🌳'], family: ['👨‍👩‍👧', '🧸'], double: ['👥'], single: ['☕'] }
  return [...base, ...(m[type || ''] || [])]
}

// ── Acciones ──
async function setStatus(status: 'confirmed' | 'cancelled') {
  if (!d.value) return
  saving.value = true
  try {
    await ReservationService.update(d.value.id, { status })
    toast.success(status === 'confirmed' ? 'Reserva confirmada' : 'Reserva anulada')
    await load()
    emit('changed')
  } catch (e) {
    toast.error((e as Error).message || 'Error al actualizar')
  } finally {
    saving.value = false
    showCancel.value = false
  }
}

async function toggleAutoSend() {
  if (!d.value) return
  const next = !autoSend.value
  autoSend.value = next
  try {
    await ReservationService.update(d.value.id, { autoSendEnabled: next })
    toast.success(next ? 'Envíos automáticos activados' : 'Envíos automáticos desactivados')
  } catch (e) {
    autoSend.value = !next
    toast.error((e as Error).message || 'No se pudo guardar')
  }
}

async function toggleCondition(key: 'gdpr' | 'marketing' | 'terms') {
  if (!d.value) return
  const next = !conditions.value[key]
  conditions.value[key] = next
  try {
    if (key === 'gdpr') await ReservationService.update(d.value.id, { gdprAccepted: next })
    else if (key === 'marketing') await ReservationService.update(d.value.id, { marketingAccepted: next })
    else await ReservationService.update(d.value.id, { termsAccepted: next })
  } catch (e) {
    conditions.value[key] = !next
    toast.error((e as Error).message || 'No se pudo guardar')
  }
}

async function saveOtherCharges() {
  if (!d.value) return
  const val = Number(otherChargesDraft.value) || 0
  if (val === otherCharges.value) return
  saving.value = true
  try {
    await ReservationService.update(d.value.id, { otherCharges: val })
    otherCharges.value = val
    toast.success('Otros cobros actualizados')
  } catch (e) {
    otherChargesDraft.value = String(otherCharges.value)
    toast.error((e as Error).message || 'No se pudo guardar')
  } finally {
    saving.value = false
  }
}

async function requirePayment() {
  if (!d.value) return
  if (pending.value <= 0) { toast.info('Sin monto pendiente'); return }
  saving.value = true
  try {
    const created = await PaymentsService.create({ reservationId: d.value.id, amount: pending.value, sentTo: d.value.guest?.email || undefined, sentVia: 'email' })
    if (!created.id) { toast.error('No se pudo crear el requerimiento de pago'); return }
    const checkout = await PaymentsService.createStripeCheckout(created.id)
    if (checkout?.url) window.open(checkout.url, '_blank')
    toast.success('Requerimiento de pago enviado')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo generar el link de pago')
  } finally {
    saving.value = false
  }
}

async function viewMovements() {
  if (!d.value) return
  try {
    const list = await FoliosService.list(d.value.hotelId)
    const folio = (list || []).find((f) => f.reservationId === d.value!.id)
    if (!folio) { toast.info('Sin folio abierto (la reserva no está checked-in)'); return }
    const full = await FoliosService.get(folio.id)
    folioCharges.value = (full.charges || []).map((c) => ({ description: c.description ?? undefined, amount: c.amount ?? undefined, kind: c.kind ?? undefined }))
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo cargar el folio')
  }
}

async function addAddon() {
  if (!d.value || !newAddon.value.description.trim()) return
  try {
    const created = await AddonsService.create(d.value.id, { description: newAddon.value.description.trim(), kind: newAddon.value.kind, amount: newAddon.value.amount, quantity: 1 })
    addons.value.push(created)
    newAddon.value = { description: '', amount: 0, kind: 'service' }
    toast.success('Servicio agregado')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo agregar')
  }
}

async function removeAddon(id: string) {
  try {
    await AddonsService.remove(id)
    addons.value = addons.value.filter((a) => a.id !== id)
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo eliminar')
  }
}

function waSend(body?: string | null) {
  const link = waLink(d.value?.guest?.phone, body)
  if (link) window.open(link, '_blank')
  else toast.error('Sin teléfono del huésped')
}

function printAs(mode: PrintMode) {
  printMode.value = mode
  setTimeout(() => {
    window.print()
    setTimeout(() => { printMode.value = 'detail' }, 500)
  }, 60)
}

function editar() { if (d.value) emit('edit', d.value) }
</script>

<template>
  <Teleport to="body">
    <div v-if="!loading && d" class="fixed inset-0 z-50 flex items-center justify-center p-4" :class="'print-' + printMode">
      <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm rm-no-print" @click="emit('close')"></div>

      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">

        <!-- ═══ HEADER ═══ -->
        <div class="p-5 border-b border-border flex items-center justify-between shrink-0 bg-gradient-to-r from-navy to-navy/90 rm-no-print">
          <div class="flex items-center gap-3 flex-wrap">
            <div>
              <div class="text-[10px] uppercase font-bold text-white/50">Reserva</div>
              <h3 class="text-lg font-black text-white leading-tight">{{ locator }}</h3>
            </div>
            <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="stClass(d.status)">{{ stLabel(d.status) }}</span>
            <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="srcClass(d.source || d.channel)">{{ srcLabel(d.source || d.channel) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="d.status === 'pending'" @click="setStatus('confirmed')" :disabled="saving" class="px-3 py-1.5 bg-teal text-white rounded-lg text-xs font-bold cursor-pointer hover:opacity-90 disabled:opacity-50">✓ Confirmar</button>
            <button v-if="d.status !== 'cancelled' && d.status !== 'checked_out'" @click="showCancel = true" :disabled="saving" class="px-3 py-1.5 bg-coral/90 text-white rounded-lg text-xs font-bold cursor-pointer hover:opacity-90 disabled:opacity-50">✕ Anular</button>
            <button @click="printAs('detail')" class="px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-white/20">🖨 Imprimir</button>
            <button @click="editar" class="px-3 py-1.5 bg-cyan text-navy rounded-lg text-xs font-black cursor-pointer hover:opacity-90">✎ Editar</button>
            <button @click="emit('close')" class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white cursor-pointer hover:bg-white/20">✕</button>
          </div>
        </div>

        <!-- ═══ BODY two-panel (área de impresión) ═══ -->
        <div class="flex-1 overflow-y-auto rm-print-area">
          <div class="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

            <!-- ═══ PANEL IZQUIERDO ═══ -->
            <div class="p-5 space-y-4">

              <!-- Datos de la Reserva -->
              <details open class="bg-navy/5 border border-navy/10 rounded-xl overflow-hidden">
                <summary class="flex items-center gap-2 p-4 cursor-pointer list-none font-black text-sm text-navy select-none">
                  <span class="w-6 h-6 rounded-lg bg-navy/10 flex items-center justify-center text-xs">📋</span> Datos de la Reserva
                  <span class="ml-auto text-text-muted text-xs">▾</span>
                </summary>
                <div class="px-4 pb-4 pt-1 space-y-2 text-sm">
                  <div class="flex justify-between gap-3"><span class="text-text-muted">Origen</span><span class="font-bold text-right">{{ srcLabel(d.source || d.channel) }}</span></div>
                  <div class="flex justify-between gap-3"><span class="text-text-muted">Comisión</span><span class="font-bold text-right">{{ d.commission ? `${d.commission}%` : '—' }}{{ d.commissionAmount ? ` (${money(d.commissionAmount)})` : '' }}</span></div>
                  <div class="flex justify-between gap-3"><span class="text-text-muted">Localizador interno</span><span class="font-mono text-right text-xs">{{ d.id.slice(-8) }}</span></div>
                  <div v-if="d.externalLocator" class="flex justify-between gap-3"><span class="text-text-muted">Localizador OTA</span><span class="font-mono text-right text-xs">{{ d.externalLocator }}</span></div>
                  <div class="flex justify-between gap-3"><span class="text-text-muted">Creada</span><span class="text-right">{{ fmtDateTime(d.createdAt) }}</span></div>
                  <div class="flex justify-between gap-3"><span class="text-text-muted">Entrada – Salida</span><span class="font-bold text-right">{{ fmtDate(d.checkIn) }} – {{ fmtDate(d.checkOut) }} <span class="text-text-muted">({{ nights }}n)</span></span></div>
                  <div v-if="d.promoCode" class="flex justify-between gap-3"><span class="text-text-muted">Código promo</span><span class="font-bold text-right">{{ d.promoCode }}</span></div>
                  <div v-if="d.otaNotes" class="pt-2 border-t border-border/50">
                    <div class="text-text-muted text-xs mb-1">Comentario del canal (OTA)</div>
                    <div class="text-xs bg-white rounded-lg p-2 border border-border whitespace-pre-wrap">{{ d.otaNotes }}</div>
                  </div>
                  <div v-if="d.notes" class="pt-2 border-t border-border/50">
                    <div class="text-text-muted text-xs mb-1">Notas</div>
                    <div class="text-xs bg-white rounded-lg p-2 border border-border whitespace-pre-wrap">{{ d.notes }}</div>
                  </div>
                  <div v-if="d.ownerNotes" class="pt-2 border-t border-border/50">
                    <div class="text-text-muted text-xs mb-1">Notas del propietario</div>
                    <div class="text-xs bg-white rounded-lg p-2 border border-border whitespace-pre-wrap">{{ d.ownerNotes }}</div>
                  </div>
                </div>
              </details>

              <!-- Condiciones de la Reserva -->
              <details class="bg-surface border border-border rounded-xl overflow-hidden">
                <summary class="flex items-center gap-2 p-4 cursor-pointer list-none font-black text-sm text-navy select-none">
                  <span class="w-6 h-6 rounded-lg bg-gold/10 flex items-center justify-center text-xs">✅</span> Condiciones de la Reserva
                  <span class="ml-auto text-text-muted text-xs">▾</span>
                </summary>
                <div class="px-4 pb-4 pt-1 space-y-2 text-sm">
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" :checked="conditions.gdpr" @change="toggleCondition('gdpr')" class="w-4 h-4 accent-navy" /> Protección de datos (LOPD)</label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" :checked="conditions.marketing" @change="toggleCondition('marketing')" class="w-4 h-4 accent-navy" /> Deseo recibir información adicional</label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" :checked="conditions.terms" @change="toggleCondition('terms')" class="w-4 h-4 accent-navy" /> Normas de Uso y Seguridad</label>
                </div>
              </details>

              <!-- Comunicaciones -->
              <details class="bg-surface border border-border rounded-xl overflow-hidden">
                <summary class="flex items-center gap-2 p-4 cursor-pointer list-none font-black text-sm text-navy select-none">
                  <span class="w-6 h-6 rounded-lg bg-teal/10 flex items-center justify-center text-xs">📨</span> Comunicaciones
                  <span class="ml-auto text-text-muted text-xs">▾</span>
                </summary>
                <div class="px-4 pb-4 pt-1 space-y-2 text-sm">
                  <button @click="printAs('voucherLodging')" class="w-full text-left px-3 py-2 bg-white rounded-lg border border-border hover:border-teal hover:text-teal cursor-pointer">📄 Bono del alojamiento</button>
                  <button @click="printAs('voucherClient')" class="w-full text-left px-3 py-2 bg-white rounded-lg border border-border hover:border-teal hover:text-teal cursor-pointer">📄 Bono para el Cliente</button>
                  <a v-if="checkinUrl" :href="checkinUrl" target="_blank" class="block w-full text-left px-3 py-2 bg-white rounded-lg border border-border hover:border-teal hover:text-teal">🔗 Autocheckin (check-in digital)</a>
                </div>
              </details>

              <!-- Comunicación con el Cliente -->
              <details class="bg-surface border border-border rounded-xl overflow-hidden">
                <summary class="flex items-center gap-2 p-4 cursor-pointer list-none font-black text-sm text-navy select-none">
                  <span class="w-6 h-6 rounded-lg bg-purple/10 flex items-center justify-center text-xs">⚙️</span> Comunicación con el Cliente
                  <span class="ml-auto text-text-muted text-xs">▾</span>
                </summary>
                <div class="px-4 pb-4 pt-1">
                  <label class="flex items-center justify-between gap-3 text-sm py-2 cursor-pointer">
                    <span class="text-text-secondary">Los envíos de esta reserva se enviarán automáticamente</span>
                    <button type="button" @click="toggleAutoSend" :disabled="saving" class="relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-50" :class="autoSend ? 'bg-teal' : 'bg-gray-300'">
                      <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow" :class="autoSend ? 'translate-x-5' : ''"></span>
                    </button>
                  </label>
                  <div v-if="d.messageLogs && d.messageLogs.length" class="mt-2 pt-2 border-t border-border/50">
                    <div class="text-text-muted text-xs mb-1">Envíos registrados</div>
                    <div v-for="(log, i) in d.messageLogs.slice(0, 5)" :key="i" class="text-xs flex justify-between gap-2 py-0.5">
                      <span class="truncate">{{ log.messageType || 'Mensaje' }}</span>
                      <span class="font-bold shrink-0" :class="log.status === 'sent' ? 'text-teal' : 'text-gold'">{{ log.status }}</span>
                    </div>
                  </div>
                </div>
              </details>

              <!-- Plantillas WhatsApp -->
              <details v-if="waTemplates.length" class="bg-emerald-50 border border-emerald-200 rounded-xl overflow-hidden">
                <summary class="flex items-center gap-2 p-4 cursor-pointer list-none font-black text-sm text-emerald-700 select-none">
                  <span class="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-xs">💬</span> Plantillas de WhatsApp Web
                  <span class="ml-auto text-text-muted text-xs">▾</span>
                </summary>
                <div class="px-4 pb-4 pt-1 space-y-2 text-sm">
                  <button v-for="t in waTemplates" :key="t.id" @click="waSend(t.whatsappBody)" class="w-full flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-emerald-200 hover:border-emerald-400 cursor-pointer">
                    <span>{{ t.title }}</span><span class="text-emerald-600 text-xs">Enviar →</span>
                  </button>
                </div>
              </details>

              <!-- Elementos de la Reserva (MOVIDA al panel izquierdo, como MisterPlan) -->
              <details open class="bg-navy/5 border border-navy/10 rounded-xl overflow-hidden">
                <summary class="flex items-center gap-2 p-4 cursor-pointer list-none font-black text-sm text-navy select-none">
                  <span class="w-6 h-6 rounded-lg bg-navy/10 flex items-center justify-center text-xs">🏨</span> Elementos de la Reserva
                  <span class="ml-auto text-text-muted text-xs">▾</span>
                </summary>
                <div class="px-4 pb-4 pt-1 space-y-3 text-sm">
                  <div v-if="d.room">
                    <div class="font-bold text-navy">Habitación {{ d.room.number }} <span class="text-text-muted font-normal">{{ d.room.name || d.room.type }}</span></div>
                    <div class="text-xs text-text-muted">Asignada: ({{ fmtDate(d.checkIn) }})</div>
                  </div>
                  <div class="flex flex-wrap gap-1 text-lg">{{ serviceIcons(d.room?.type).map((i) => i).join(' ') }}</div>
                  <div class="grid grid-cols-2 gap-2 text-xs bg-white rounded-lg p-3 border border-border">
                    <div><span class="text-text-muted">Régimen:</span> <span class="font-bold">{{ regimeLabel(d.regime) }}</span></div>
                    <div><span class="text-text-muted">Huéspedes:</span> <span class="font-bold">{{ d.adults ?? 0 }} pax{{ d.children ? ` +${d.children}n` : '' }}</span></div>
                    <div><span class="text-text-muted">Noches:</span> <span class="font-bold">{{ nights }}</span></div>
                    <div><span class="text-text-muted">Precio/noche:</span> <span class="font-bold">{{ money(pricePerNight) }}</span></div>
                  </div>
                  <div class="flex justify-between items-center pt-2 border-t border-border/50">
                    <span class="text-text-muted text-xs">{{ nights }} noches × {{ money(pricePerNight) }}</span>
                    <span class="font-black text-teal text-lg flex items-center gap-1">✓ {{ money(d.totalAmount) }}</span>
                  </div>
                </div>
              </details>
            </div>

            <!-- ═══ PANEL DERECHO ═══ -->
            <div class="p-5 space-y-4">

              <!-- Datos del Cliente (bandera + idioma) -->
              <div class="bg-navy/5 border border-navy/10 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                  <span class="w-6 h-6 rounded-lg bg-navy/10 flex items-center justify-center text-xs">👤</span>
                  <h4 class="text-sm font-black text-navy">Datos del Cliente</h4>
                </div>
                <div v-if="d.guest" class="space-y-2 text-sm">
                  <div class="flex justify-between gap-3 items-center"><span class="text-text-muted">Nombre</span><span class="font-bold text-navy text-lg">{{ nationalityToFlag(d.guest.nationality) }} {{ d.guest.name }}</span></div>
                  <div v-if="d.guest.email" class="flex justify-between gap-3"><span class="text-text-muted">✉️ Email</span><a :href="`mailto:${d.guest.email}`" class="text-teal hover:underline truncate text-right">{{ d.guest.email }}</a></div>
                  <div v-if="d.guest.phone" class="flex justify-between gap-3"><span class="text-text-muted">📞 Teléfono</span><a :href="`tel:${d.guest.phone}`" class="text-teal hover:underline">{{ d.guest.phone }}</a></div>
                  <div class="flex justify-between gap-3"><span class="text-text-muted">💬 WhatsApp</span><a v-if="waLink(d.guest.phone)" :href="waLink(d.guest.phone)!" target="_blank" class="text-emerald-600 hover:underline">Escribir →</a><span v-else class="text-text-muted">—</span></div>
                  <div v-if="d.guest.nationality" class="flex justify-between gap-3"><span class="text-text-muted">Nacionalidad</span><span class="text-right">{{ nationalityToFlag(d.guest.nationality) }} {{ d.guest.nationality }}</span></div>
                  <div v-if="d.guest.language" class="flex justify-between gap-3"><span class="text-text-muted">🗣️ Idioma</span><span class="font-bold text-right">{{ languageToFlag(d.guest.language) }} {{ d.guest.language }}</span></div>
                  <div v-if="d.guest.document" class="flex justify-between gap-3"><span class="text-text-muted">Documento</span><span class="font-mono text-right text-xs">{{ d.guest.document }}</span></div>
                </div>
                <div v-else class="text-sm text-text-muted italic py-2">Sin huésped asociado</div>
              </div>

              <!-- Importe y Pago -->
              <div class="bg-teal/5 border border-teal/15 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-3 pb-2 border-b border-teal/20">
                  <span class="w-6 h-6 rounded-lg bg-teal/10 flex items-center justify-center text-xs">💰</span>
                  <h4 class="text-sm font-black text-navy">Importe y Pago</h4>
                </div>
                <div class="space-y-1.5 text-sm">
                  <button @click="viewMovements" class="flex justify-between w-full hover:text-teal cursor-pointer"><span class="text-text-muted">📦 Caja</span><span class="text-teal font-bold">Ver movimientos →</span></button>
                  <div class="flex justify-between"><span class="text-text-muted">Forma de pago</span><span class="text-right">{{ payMethodLabel(d.paymentMethod) }}</span></div>
                  <div class="flex justify-between bg-teal/5 rounded px-2 py-1"><span class="text-text-muted">Importe de la reserva</span><span class="font-bold text-navy">{{ money(d.totalAmount) }}</span></div>
                  <div class="flex justify-between"><span class="text-text-muted">Anticipo</span><span class="font-bold" :class="payStatusBadge(d.deposit, d.totalAmount).cls">{{ d.deposit && d.deposit > 0 ? money(d.deposit) : 'Sin anticipo' }}</span></div>
                  <!-- Otros cobros editable -->
                  <div class="flex justify-between items-center gap-2">
                    <span class="text-text-muted">Otros cobros</span>
                    <span class="flex items-center gap-1">
                      <input v-model="otherChargesDraft" type="number" min="0" step="0.01" class="w-20 px-2 py-0.5 text-right rounded border border-border text-xs" @keyup.enter="saveOtherCharges" />
                      <button @click="saveOtherCharges" :disabled="saving" class="text-xs text-teal font-bold hover:underline cursor-pointer disabled:opacity-50">✓</button>
                    </span>
                  </div>
                  <div class="flex justify-between border-t border-border/50 pt-1.5"><span class="font-bold text-text-secondary">Pendiente de cobro</span><span class="font-black" :class="pending > 0 ? 'text-coral' : 'text-teal'">{{ money(pending) }}</span></div>
                  <div v-if="secondaryTotal !== null" class="flex justify-between"><span class="text-text-muted">Total ({{ secondaryCurrency }})</span><span class="font-bold text-purple">{{ moneySecondary(secondaryTotal) }}</span></div>
                  <button @click="requirePayment" :disabled="saving || pending <= 0" class="w-full mt-2 py-2 bg-cyan text-navy rounded-lg text-xs font-black cursor-pointer hover:opacity-90 disabled:opacity-50">💳 Crear link de pago Stripe</button>
                </div>
                <!-- Movimientos del folio (inline) -->
                <div v-if="folioCharges" class="mt-3 pt-3 border-t border-teal/20">
                  <div class="text-xs font-black text-navy mb-1">Movimientos de caja</div>
                  <div v-if="folioCharges.length" class="space-y-1 text-xs">
                    <div v-for="(c, i) in folioCharges" :key="i" class="flex justify-between"><span class="truncate">{{ c.description || '—' }}</span><span class="font-bold" :class="c.kind === 'payment' ? 'text-teal' : 'text-navy'">{{ money(c.amount) }}</span></div>
                  </div>
                  <div v-else class="text-xs text-text-muted italic">Sin movimientos</div>
                </div>
              </div>

              <!-- Tarjeta de garantía (MisterPlan): protegida con PIN -->
              <div v-if="d.hasGuaranteeCard" class="bg-coral/5 border border-coral/20 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-3 pb-2 border-b border-coral/20">
                  <span class="w-6 h-6 rounded-lg bg-coral/10 flex items-center justify-center text-sm">🔒</span>
                  <h4 class="text-sm font-black text-navy">Tarjeta de garantía</h4>
                </div>
                <!-- Bloqueada: pedir PIN -->
                <div v-if="!guaranteeUnlocked">
                  <p class="text-xs text-text-secondary mb-2">Tarjeta cargada y protegida. Ingresá el PIN del hotel para ver los datos.</p>
                  <div class="flex gap-2">
                    <input v-model="guaranteePin" type="password" inputmode="numeric" maxlength="8" placeholder="PIN" @keyup.enter="unlockGuarantee" class="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition" />
                    <button @click="unlockGuarantee" :disabled="unlocking || !guaranteePin" class="px-4 py-2 rounded-lg bg-navy text-white text-sm font-bold disabled:opacity-50 hover:bg-navy/90 transition">{{ unlocking ? '...' : 'Ver' }}</button>
                  </div>
                  <p v-if="guaranteeError" class="text-xs text-coral mt-2 font-semibold">{{ guaranteeError }}</p>
                </div>
                <!-- Desbloqueada: mostrar datos parciales -->
                <div v-else class="space-y-1.5 text-sm">
                  <div class="flex justify-between"><span class="text-text-muted">Titular</span><span class="font-semibold text-right">{{ guaranteeCard?.cardHolder || '—' }}</span></div>
                  <div class="flex justify-between"><span class="text-text-muted">Tarjeta</span><span class="font-mono font-semibold">•••• {{ guaranteeCard?.cardLast4 }}</span></div>
                  <div class="flex justify-between"><span class="text-text-muted">Marca</span><span class="font-semibold">{{ cardBrandLabel(guaranteeCard?.cardBrand) }}</span></div>
                  <div class="flex justify-between"><span class="text-text-muted">Vencimiento</span><span class="font-mono font-semibold">{{ guaranteeCard?.cardExpMonth }}/{{ guaranteeCard?.cardExpYear }}</span></div>
                  <button @click="guaranteeUnlocked = false; guaranteePin = ''" class="mt-2 text-[11px] text-text-muted underline">Volver a bloquear</button>
                </div>
              </div>

              <!-- Otros servicios y descuentos -->
              <div class="bg-purple/5 border border-purple/15 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                  <span class="w-6 h-6 rounded-lg bg-purple/10 flex items-center justify-center text-xs">➕</span>
                  <h4 class="text-sm font-black text-navy">Otros servicios y descuentos</h4>
                </div>
                <div class="space-y-1.5 text-sm mb-3">
                  <div v-for="a in addons" :key="a.id" class="flex justify-between items-center gap-2">
                    <span class="truncate">
                      <span v-if="a.kind === 'discount'" class="text-coral font-bold">−</span>
                      <span v-else class="text-teal font-bold">+</span>
                      {{ a.description }}
                    </span>
                    <span class="flex items-center gap-2 shrink-0">
                      <span class="font-bold" :class="a.kind === 'discount' ? 'text-coral' : 'text-navy'">{{ money((a.kind === 'discount' ? -1 : 1) * (a.amount ?? 0) * (a.quantity ?? 1)) }}</span>
                      <button @click="removeAddon(a.id)" class="text-coral hover:underline text-xs cursor-pointer">✕</button>
                    </span>
                  </div>
                  <div v-if="!addons.length" class="text-xs text-text-muted italic">Sin servicios adicionales</div>
                </div>
                <div class="flex gap-2">
                  <input v-model="newAddon.description" type="text" placeholder="Descripción" class="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs" @keyup.enter="addAddon" />
                  <input v-model.number="newAddon.amount" type="number" min="0" step="0.01" placeholder="Monto" class="w-20 px-2 py-1.5 rounded-lg border border-border text-xs" />
                  <select v-model="newAddon.kind" class="px-2 py-1.5 rounded-lg border border-border text-xs cursor-pointer">
                    <option value="service">Servicio</option>
                    <option value="discount">Descuento</option>
                  </select>
                  <button @click="addAddon" class="px-3 bg-purple text-white rounded-lg text-xs font-bold cursor-pointer hover:opacity-90">+</button>
                </div>
              </div>

              <!-- Acompañantes -->
              <div class="bg-surface border border-border rounded-xl p-4">
                <div class="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                  <span class="w-6 h-6 rounded-lg bg-navy/10 flex items-center justify-center text-xs">👥</span>
                  <h4 class="text-sm font-black text-navy">Acompañantes <span class="text-text-muted font-normal">({{ d.companions?.length || 0 }})</span></h4>
                </div>
                <div v-if="d.companions && d.companions.length" class="space-y-1.5 text-sm">
                  <div v-for="c in d.companions" :key="c.id" class="flex justify-between gap-3 items-center">
                    <span class="font-bold flex items-center gap-1">{{ c.name }} <span v-if="c.isMainGuest" class="text-coral" title="Huésped principal">*</span></span>
                    <span class="text-text-muted text-xs text-right">{{ [c.documentNumber, c.nationality].filter(Boolean).join(' · ') || '—' }}</span>
                  </div>
                </div>
                <div v-else class="text-xs text-text-muted italic">Sin acompañantes</div>
              </div>

              <!-- Check-in digital (mapeo de QScanPro de MisterPlan) -->
              <div v-if="d.checkinCode" class="bg-cyan/5 border border-cyan/20 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-2">
                  <span class="w-6 h-6 rounded-lg bg-cyan/10 flex items-center justify-center text-xs">🔑</span>
                  <h4 class="text-sm font-black text-navy">Check-in digital</h4>
                </div>
                <div class="text-center py-2 bg-white rounded-lg border-2 border-dashed border-cyan">
                  <div class="text-[10px] font-bold text-text-muted uppercase">Código de conexión</div>
                  <div class="text-2xl font-black text-cyan tracking-wider mt-1 font-mono">{{ d.checkinCode }}</div>
                </div>
                <p class="text-xs text-text-muted mt-2">Usa este código para el check-in digital del huésped. <a v-if="checkinUrl" :href="checkinUrl" target="_blank" class="text-cyan font-bold hover:underline">Abrir formulario →</a></p>
              </div>

              <!-- Cerradura (si hay código) -->
              <details v-if="d.lockCodes && d.lockCodes.length" class="bg-teal/5 border border-teal/15 rounded-xl overflow-hidden">
                <summary class="flex items-center gap-2 p-4 cursor-pointer list-none font-black text-sm text-navy select-none">
                  <span class="w-6 h-6 rounded-lg bg-teal/10 flex items-center justify-center text-xs">🔐</span> Cerradura
                  <span class="ml-auto text-text-muted text-xs">▾</span>
                </summary>
                <div class="px-4 pb-4 pt-1 space-y-2">
                  <div v-for="(lc, i) in d.lockCodes" :key="i" class="flex items-center justify-between bg-white rounded-lg p-3 border border-border">
                    <div>
                      <div class="text-[10px] uppercase font-bold text-text-muted">Código de acceso</div>
                      <div class="text-xl font-black text-teal tracking-wider">{{ lc.code || '—' }}</div>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="lc.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">{{ lc.status }}</span>
                  </div>
                </div>
              </details>

              <!-- Historial de cambios (D7 audit trail) -->
              <details class="bg-surface border border-border rounded-xl overflow-hidden">
                <summary class="flex items-center gap-2 p-4 cursor-pointer list-none font-black text-sm text-navy select-none">
                  <span class="w-6 h-6 rounded-lg bg-navy/10 flex items-center justify-center text-xs">🕘</span> Historial
                  <span class="ml-auto text-text-muted text-xs">▾</span>
                </summary>
                <div class="px-4 pb-4 pt-1 space-y-1">
                  <p v-if="!auditLogs.length" class="text-xs text-text-muted italic">Sin eventos registrados</p>
                  <div v-for="l in auditLogs" :key="l.id" class="text-xs flex justify-between gap-2 py-1 border-b border-border/40 last:border-0">
                    <span class="font-bold text-navy">{{ auditLabel(l.action) }}</span>
                    <span class="text-text-muted whitespace-nowrap">{{ fmtAuditDate(l.createdAt) }}</span>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- ═══ FOOTER ═══ -->
        <div class="p-4 border-t border-border bg-surface/80 shrink-0 flex items-center justify-between rm-no-print">
          <div class="text-sm">
            <span class="text-text-muted">Total: </span>
            <span class="font-black text-navy text-lg">{{ money(grandTotal) }}</span>
            <span v-if="secondaryTotal !== null" class="text-purple font-bold ml-2">≈ {{ moneySecondary(secondaryTotal) }}</span>
          </div>
          <div class="flex gap-3">
            <button @click="emit('close')" class="px-5 py-2.5 border border-border rounded-lg text-sm font-bold text-text-secondary cursor-pointer hover:bg-white transition">Cerrar</button>
            <button @click="editar" class="px-6 py-2.5 bg-teal text-white rounded-lg text-sm font-black cursor-pointer hover:opacity-90 transition">✎ Editar Reserva</button>
          </div>
        </div>

        <!-- Confirm Anular (inline) -->
        <div v-if="showCancel" class="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-10 rm-no-print" @click.self="showCancel = false">
          <div class="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <div class="text-3xl mb-3">⚠️</div>
            <h3 class="text-lg font-black text-navy mb-2">¿Anular reserva?</h3>
            <p class="text-sm text-text-secondary">La reserva <strong>{{ locator }}</strong> pasará a estado cancelada. Se puede revertir editando.</p>
            <div class="flex gap-3 mt-6">
              <button @click="showCancel = false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
              <button @click="setStatus('cancelled')" :disabled="saving" class="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-coral cursor-pointer disabled:opacity-50">Anular</button>
            </div>
          </div>
        </div>

        <!-- ═══ BONOS (ocultos en pantalla, visibles solo al imprimir) ═══ -->
        <div v-if="d" class="rm-voucher rm-voucher-lodging">
          <h2 style="text-align:center;font-size:20px;font-weight:900;margin-bottom:4px">BONO DEL ALOJAMIENTO</h2>
          <p style="text-align:center;font-size:12px;color:#666;margin-bottom:16px">Comprobante interno</p>
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr><td style="padding:4px 0;color:#666">Reserva</td><td style="font-weight:bold">{{ locator }}</td></tr>
            <tr><td style="padding:4px 0;color:#666">Huésped</td><td style="font-weight:bold">{{ d.guest?.name }}</td></tr>
            <tr><td style="padding:4px 0;color:#666">Habitación</td><td style="font-weight:bold">{{ d.room?.number }} {{ d.room?.name || d.room?.type }}</td></tr>
            <tr><td style="padding:4px 0;color:#666">Entrada – Salida</td><td style="font-weight:bold">{{ fmtDate(d.checkIn) }} – {{ fmtDate(d.checkOut) }} ({{ nights }} noches)</td></tr>
            <tr><td style="padding:4px 0;color:#666">Huéspedes</td><td>{{ d.adults }} adultos{{ d.children ? `, ${d.children} niños` : '' }}</td></tr>
            <tr><td style="padding:8px 0 4px;color:#666;border-top:1px solid #ddd">Total</td><td style="font-weight:900;font-size:16px;border-top:1px solid #ddd">{{ money(grandTotal) }}</td></tr>
          </table>
        </div>
        <div v-if="d" class="rm-voucher rm-voucher-client">
          <h2 style="text-align:center;font-size:20px;font-weight:900;margin-bottom:4px">BONO PARA EL CLIENTE</h2>
          <p style="text-align:center;font-size:12px;color:#666;margin-bottom:16px">Gracias por su reserva</p>
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr><td style="padding:4px 0;color:#666">Estimado/a</td><td style="font-weight:bold">{{ d.guest?.name }}</td></tr>
            <tr><td style="padding:4px 0;color:#666">Habitación</td><td style="font-weight:bold">{{ d.room?.number }}</td></tr>
            <tr><td style="padding:4px 0;color:#666">Check-in / Check-out</td><td>{{ fmtDate(d.checkIn) }} / {{ fmtDate(d.checkOut) }}</td></tr>
            <tr v-if="d.checkinCode"><td style="padding:4px 0;color:#666">Código de check-in</td><td style="font-weight:bold;font-family:monospace">{{ d.checkinCode }}</td></tr>
            <tr><td style="padding:8px 0 4px;color:#666;border-top:1px solid #ddd">Total abonado</td><td style="font-weight:900;font-size:16px;border-top:1px solid #ddd">{{ money(d.deposit) }}</td></tr>
            <tr><td style="padding:4px 0;color:#666">Pendiente</td><td>{{ money(pending) }}</td></tr>
          </table>
          <p style="text-align:center;font-size:11px;color:#999;margin-top:24px">{{ d.ownerNotes }}</p>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm">
      <div class="bg-white rounded-2xl px-8 py-6 flex items-center gap-3">
        <div class="w-5 h-5 border-2 border-navy border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm font-bold text-navy">Cargando reserva…</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
details > summary::-webkit-details-marker { display: none; }
details[open] > summary .ml-auto { transform: rotate(180deg); }
/* Los bonos no se ven en pantalla */
.rm-voucher { display: none; }
</style>

<style>
/* Print: por defecto imprime el detalle (.rm-print-area). Modos bono cambian el área visible. */
@media print {
  body * { visibility: hidden; }
  .rm-print-area, .rm-print-area * { visibility: visible; }
  .rm-print-area { position: absolute; left: 0; top: 0; width: 100%; max-height: none; overflow: visible; }
  .rm-no-print { display: none !important; }

  /* Modo bono alojamiento */
  .print-voucherLodging .rm-print-area { display: none !important; }
  .print-voucherLodging .rm-voucher-lodging { display: block !important; position: absolute; left: 0; top: 0; width: 100%; padding: 24px; visibility: visible; }
  .print-voucherLodging .rm-voucher-lodging, .print-voucherLodging .rm-voucher-lodging * { visibility: visible; }
  /* Modo bono cliente */
  .print-voucherClient .rm-print-area { display: none !important; }
  .print-voucherClient .rm-voucher-client { display: block !important; position: absolute; left: 0; top: 0; width: 100%; padding: 24px; visibility: visible; }
  .print-voucherClient .rm-voucher-client, .print-voucherClient .rm-voucher-client * { visibility: visible; }
}
</style>
