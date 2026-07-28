<template>
  <!--
    UpsellsStep.vue — Step 2 del widget (F2 2.9, solmi-direct-booking).
    Lista upsells activos del hotel (desayuno, transfer, late checkout…). Cada uno con checkbox
    + Stepper de cantidad (qty). El `kind` determina cómo se cobra:
      - per_room: 1 cargo por habitación (qty fijo = rooms)
      - per_person: qty = guests (default)
      - per_stay: 1 cargo por la estadía entera (qty fijo = 1)
    La selección viaja al store via setSelectedUpsells → POST /public/booking.upsells.

    Vacío-friendly: si el hotel no configuró upsells, mostramos empty state y el botón
    "Continuar" pasa directo al siguiente step (no forzar extras).
  -->
  <section class="space-y-4">
    <header class="space-y-1">
      <h2 class="text-xl font-black text-navy">Sumá extras a tu estadía</h2>
      <p class="text-sm text-text-muted">Opcional. Mejorá tu experiencia.</p>
    </header>

    <div v-if="store.upsellsLoading" class="text-center py-8">
      <div class="h-8 w-8 mx-auto rounded-full border-4 border-cyan/30 border-t-cyan animate-spin" />
      <p class="text-sm text-text-muted mt-2">Cargando extras…</p>
    </div>

    <div v-else-if="store.upsells.length === 0" class="text-center py-8 px-4">
      <div class="text-4xl mb-2">✨</div>
      <p class="font-bold text-navy">Sin extras disponibles</p>
      <p class="text-sm text-text-muted mt-1">Podés continuar directamente al pago.</p>
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="up in store.upsells"
        :key="up.id"
        :class="[
          'rounded-2xl border-2 bg-white p-4 transition',
          isSelected(up.id) ? 'border-cyan ring-2 ring-cyan/20' : 'border-slate-200',
        ]"
      >
        <div class="flex items-start justify-between gap-3">
          <label class="flex items-start gap-3 min-w-0 flex-1 cursor-pointer">
            <input
              type="checkbox"
              class="mt-1 h-5 w-5 rounded border-slate-300 text-cyan focus:ring-cyan/30"
              :checked="isSelected(up.id)"
              @change="toggle(up.id, $event)"
            />
            <div class="min-w-0">
              <p class="font-bold text-navy">{{ up.name }}</p>
              <p v-if="up.description" class="text-xs text-text-muted mt-0.5">{{ up.description }}</p>
              <p class="text-[11px] text-text-muted mt-1 uppercase tracking-wide">{{ kindLabel(up.kind) }}</p>
            </div>
          </label>
          <div class="text-right shrink-0">
            <p class="font-black text-navy">{{ formatPrice(up.price, store.chargeCurrency) }}</p>
          </div>
        </div>

        <div v-if="isSelected(up.id) && up.kind !== 'per_stay'" class="mt-3 flex items-center gap-3">
          <span class="text-xs font-bold text-text-muted uppercase tracking-wide">Cantidad</span>
          <div class="w-32">
            <Stepper
              :model-value="qtyFor(up.id)"
              :min="1"
              :max="up.kind === 'per_room' ? store.rooms : 20"
              @update:model-value="(v) => setQty(up.id, v)"
            />
          </div>
        </div>
      </li>
    </ul>

    <div v-if="store.upsellsTotal > 0" class="rounded-xl bg-slate-50 px-4 py-3 text-sm">
      <div class="flex justify-between">
        <span class="text-text-muted">Subtotal extras</span>
        <span class="font-bold text-navy">{{ formatPrice(store.upsellsTotal, store.chargeCurrency) }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useBookingStore } from '@/composables/useBooking'
import Stepper from './Stepper.vue'
import type { UpsellKind } from '@/types/booking'

const store = useBookingStore()

function isSelected(id: string): boolean {
  return store.selectedUpsells.some((u) => u.id === id)
}

function qtyFor(id: string): number {
  return store.selectedUpsells.find((u) => u.id === id)?.quantity ?? 1
}

/** Toggle por checkbox. Default qty por kind: per_room=rooms, per_person=guests, per_stay=1. */
function toggle(id: string, e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  const current = store.selectedUpsells.filter((u) => u.id !== id)
  if (checked) {
    const up = store.upsells.find((u) => u.id === id)
    const defaultQty = up?.kind === 'per_room' ? store.rooms : up?.kind === 'per_person' ? store.guests : 1
    store.setSelectedUpsells([...current, { id, quantity: Math.max(1, defaultQty) }])
  } else {
    store.setSelectedUpsells(current)
  }
}

function setQty(id: string, v: number) {
  const current = store.selectedUpsells.filter((u) => u.id !== id)
  store.setSelectedUpsells([...current, { id, quantity: Math.max(1, v) }])
}

function kindLabel(kind: UpsellKind): string {
  switch (kind) {
    case 'per_room': return 'Por habitación'
    case 'per_person': return 'Por persona'
    case 'per_stay': return 'Por estadía'
  }
}

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(typeof navigator !== 'undefined' ? navigator.language : 'es', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}
</script>
