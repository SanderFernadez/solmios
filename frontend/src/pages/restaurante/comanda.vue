<script setup lang="ts">
// pages/restaurante/comanda.vue — Toma de comanda (RES-7). Carta a la izquierda (tocar ítem = agregar
// línea), ticket a la derecha con líneas + totales en vivo (recalculados por el backend). Enviar a cocina
// (sendOrder), cobrar (→ cobrar/:id) o cancelar. Las líneas solo se editan si la comanda no cerró.
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  RestaurantService,
  type OrderWithLines, type MenuCategory, type MenuItem, type OrderLine,
  ORDER_STATUS_LABELS, ORDER_TYPE_LABELS,
} from '@/services/Restaurant.service'
import { SettingsService } from '@/services/Settings.service'
import { currencySymbol } from '@/composables/useCurrency'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmModal from '@/components/features/ConfirmModal.vue'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { usePermissions } from '@/composables/usePermissions'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { can } = usePermissions()
const orderId = computed(() => String(route.params.id))

const { confirmModal, confirmBusy, askConfirm, runConfirm } = useConfirm({
  onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo'),
})

const loading = ref(true)
const busy = ref(false)
const order = ref<OrderWithLines | null>(null)
const categories = ref<MenuCategory[]>([])
const items = ref<MenuItem[]>([])
const currency = ref('USD')
const activeCategoryId = ref<string>('all')

const editPerm = computed(() => can('restaurant', 'edit'))
const createPerm = computed(() => can('restaurant', 'create'))

// La comanda es editable solo antes de facturar/cobrar/cancelar.
const LOCKED = ['billed', 'charged', 'paid', 'cancelled']
const editable = computed(() => !!order.value && !LOCKED.includes(order.value.status))
const money = (n: number): string => `${currencySymbol(currency.value)}${Number(n || 0).toFixed(2)}`

const availableItems = computed(() => {
  const list = items.value.filter((i) => i.available !== 0)
  return activeCategoryId.value === 'all' ? list : list.filter((i) => i.categoryId === activeCategoryId.value)
})

async function reloadOrder() {
  order.value = await RestaurantService.getOrder(orderId.value)
}

async function load() {
  loading.value = true
  try {
    const [cat, it, settings] = await Promise.all([
      RestaurantService.listCategories(),
      RestaurantService.listItems(),
      SettingsService.get().catch(() => null),
    ])
    categories.value = cat.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    items.value = it.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    currency.value = (settings as any)?.hotel?.currency || 'USD'
    await reloadOrder()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'No se pudo cargar la comanda')
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function addItem(i: MenuItem) {
  if (!editable.value || !createPerm.value || busy.value) return
  busy.value = true
  try {
    await RestaurantService.addLine(orderId.value, { menuItemId: i.id, quantity: 1 })
    await reloadOrder()
  } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'No se pudo agregar') }
  finally { busy.value = false }
}

async function setQty(line: OrderLine, qty: number) {
  if (!editable.value || !editPerm.value || busy.value) return
  if (qty < 1) { await remove(line); return }
  busy.value = true
  try {
    await RestaurantService.updateLine(orderId.value, line.id, { quantity: qty })
    await reloadOrder()
  } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'No se pudo actualizar') }
  finally { busy.value = false }
}

async function remove(line: OrderLine) {
  if (!editable.value || busy.value) return
  busy.value = true
  try {
    await RestaurantService.removeLine(orderId.value, line.id)
    await reloadOrder()
  } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'No se pudo quitar') }
  finally { busy.value = false }
}

async function send() {
  if (busy.value) return
  busy.value = true
  try {
    await RestaurantService.sendOrder(orderId.value)
    await reloadOrder()
    toast.success('Enviada a cocina')
  } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'No se pudo enviar') }
  finally { busy.value = false }
}

function goPay() {
  if (!order.value?.lines.length) { toast.warning('La comanda no tiene ítems'); return }
  router.push(`/panel/restaurante/cobrar/${orderId.value}`)
}

function cancel() {
  askConfirm({
    title: 'Cancelar comanda', message: '¿Cancelar esta comanda? No se podrá cobrar.', confirmLabel: 'Cancelar comanda', danger: true,
    run: async () => { await RestaurantService.cancelOrder(orderId.value); router.push('/panel/restaurante/salon') },
  })
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-6xl mx-auto">
    <div v-if="loading" class="py-20 text-center text-text-muted">Cargando…</div>

    <template v-else-if="order">
      <header class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <router-link to="/panel/restaurante/salon" class="text-xs font-bold text-navy hover:underline">← Salón</router-link>
          <h1 class="text-xl sm:text-2xl font-black text-navy mt-1">{{ order.number || 'Comanda' }}</h1>
          <p class="text-sm text-text-muted">
            {{ ORDER_TYPE_LABELS[order.type] }} ·
            <span class="font-bold">{{ ORDER_STATUS_LABELS[order.status] }}</span>
          </p>
        </div>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <!-- Carta -->
        <SectionCard title="Carta">
          <div v-if="!editable" class="text-sm text-text-muted py-6 text-center">La comanda está cerrada; no se pueden agregar ítems.</div>
          <template v-else>
            <div v-if="categories.length" class="flex flex-wrap gap-1.5 mb-3">
              <button @click="activeCategoryId = 'all'" :class="['px-2.5 py-1 rounded-full text-xs font-bold', activeCategoryId === 'all' ? 'bg-navy text-white' : 'bg-surface text-text-muted']">Todas</button>
              <button v-for="c in categories" :key="c.id" @click="activeCategoryId = c.id" :class="['px-2.5 py-1 rounded-full text-xs font-bold', activeCategoryId === c.id ? 'bg-navy text-white' : 'bg-surface text-text-muted']">{{ c.name }}</button>
            </div>
            <EmptyState v-if="!availableItems.length" title="Sin ítems disponibles" message="Configurá la carta primero." />
            <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button v-for="i in availableItems" :key="i.id" @click="addItem(i)" :disabled="busy"
                class="p-2.5 rounded-xl border-2 border-border text-left hover:border-navy hover:bg-surface disabled:opacity-50">
                <div class="font-bold text-navy text-sm leading-tight">{{ i.name }}</div>
                <div class="text-xs text-text-muted tabular-nums mt-0.5">{{ money(i.price) }}</div>
              </button>
            </div>
          </template>
        </SectionCard>

        <!-- Ticket -->
        <SectionCard title="Comanda">
          <EmptyState v-if="!order.lines.length" title="Comanda vacía" message="Tocá un ítem de la carta para agregarlo." />
          <div v-else class="divide-y divide-border">
            <div v-for="l in order.lines" :key="l.id" class="py-2.5 flex items-center gap-3">
              <div class="min-w-0 flex-1">
                <div class="font-bold text-navy text-sm truncate">{{ l.name }}</div>
                <div class="text-[11px] text-text-muted tabular-nums">{{ money(l.unitPrice) }} c/u · {{ money(l.lineTotal) }}</div>
              </div>
              <div v-if="editable" class="flex items-center gap-1.5 shrink-0">
                <button @click="setQty(l, l.quantity - 1)" :disabled="busy" class="w-7 h-7 rounded-lg border-2 border-border font-black text-navy hover:bg-surface disabled:opacity-40">−</button>
                <span class="w-6 text-center font-black text-navy tabular-nums">{{ l.quantity }}</span>
                <button @click="setQty(l, l.quantity + 1)" :disabled="busy" class="w-7 h-7 rounded-lg border-2 border-border font-black text-navy hover:bg-surface disabled:opacity-40">+</button>
                <button @click="remove(l)" :disabled="busy" class="ml-1 w-7 h-7 rounded-lg text-coral font-black hover:bg-coral/10 disabled:opacity-40">✕</button>
              </div>
              <div v-else class="font-black text-navy tabular-nums shrink-0">×{{ l.quantity }}</div>
            </div>
          </div>

          <!-- Totales -->
          <div class="mt-4 pt-3 border-t-2 border-navy/10 space-y-1.5 text-sm">
            <div class="flex justify-between text-text-muted"><span>Subtotal</span><span class="tabular-nums">{{ money(order.subtotal) }}</span></div>
            <div class="flex justify-between text-text-muted"><span>Impuesto</span><span class="tabular-nums">{{ money(order.tax) }}</span></div>
            <div v-if="order.tip" class="flex justify-between text-text-muted"><span>Propina</span><span class="tabular-nums">{{ money(order.tip) }}</span></div>
            <div class="flex justify-between text-navy font-black text-lg pt-1"><span>Total</span><span class="tabular-nums">{{ money(order.total) }}</span></div>
          </div>

          <!-- Acciones -->
          <div class="mt-4 flex flex-wrap gap-2">
            <button v-if="editable && editPerm && order.status === 'open'" @click="send" :disabled="busy || !order.lines.length"
              class="flex-1 min-w-[140px] py-2.5 rounded-xl bg-navy text-white font-bold hover:bg-navy-light disabled:opacity-50">Enviar a cocina</button>
            <button v-if="editable && editPerm" @click="goPay" :disabled="busy || !order.lines.length"
              class="flex-1 min-w-[140px] py-2.5 rounded-xl bg-teal text-white font-bold hover:bg-teal/80 disabled:opacity-50">Cobrar</button>
            <button v-if="editable" @click="cancel" :disabled="busy"
              class="px-4 py-2.5 rounded-xl border-2 border-coral/40 text-coral font-bold hover:bg-coral/10 disabled:opacity-50">Cancelar</button>
          </div>
        </SectionCard>
      </div>
    </template>

    <EmptyState v-else title="Comanda no encontrada" message="La comanda no existe o no tenés acceso." />

    <ConfirmModal v-if="confirmModal" v-bind="confirmModal" :loading="confirmBusy" @confirm="runConfirm" @close="confirmModal = null" />
  </div>
</template>
