<template>
  <div class="min-h-screen bg-surface">
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-text-muted text-sm">Cargando carta…</div>
    </div>

    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-6">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
        <div class="text-3xl mb-2">🍽️</div>
        <p class="text-sm font-bold text-navy">Carta no disponible</p>
        <p class="text-xs text-text-muted mt-1">Este enlace no corresponde a ninguna carta activa.</p>
      </div>
    </div>

    <div v-else class="max-w-lg mx-auto pb-16">
      <!-- Encabezado -->
      <header class="bg-navy text-white px-5 pt-8 pb-6 rounded-b-3xl shadow-lg">
        <h1 class="text-2xl font-black">{{ menu?.hotel.name }}</h1>
        <p class="text-xs text-white/70 mt-1">Carta del restaurante</p>

        <div class="flex flex-wrap gap-2 mt-4">
          <button
            v-for="l in supportedLangs" :key="l.code"
            @click="setLang(l.code)"
            class="px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition"
            :class="(lang || 'es') === l.code ? 'bg-teal text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'"
          >{{ l.flag }} {{ l.name }}</button>
        </div>
      </header>

      <!-- Recomendados -->
      <section v-if="featuredItems.length" class="px-5 mt-6">
        <h2 class="text-sm font-black text-navy uppercase tracking-wide mb-3">⭐ Recomendados</h2>
        <div class="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
          <div v-for="i in featuredItems" :key="'feat-' + i.id" class="min-w-[180px] bg-white rounded-2xl shadow-sm border border-border p-3 flex-shrink-0">
            <div v-if="i.imageUrl" class="w-full h-24 rounded-xl bg-surface-dark bg-cover bg-center mb-2" :style="{ backgroundImage: `url(${i.imageUrl})` }" />
            <p class="text-sm font-bold text-navy leading-tight">{{ i.name }}</p>
            <p class="text-xs font-black text-teal mt-1">{{ formatPrice(i.price) }}</p>
          </div>
        </div>
      </section>

      <!-- Categorías -->
      <section v-for="cat in categoriesWithItems" :key="cat.id" class="px-5 mt-8">
        <h2 class="text-lg font-black text-navy border-b-2 border-teal/30 pb-2 mb-3">{{ cat.name }}</h2>
        <div class="space-y-3">
          <div
            v-for="i in cat.items" :key="i.id"
            class="bg-white rounded-2xl shadow-sm border border-border p-4 flex gap-3"
            :class="{ 'opacity-60': i.availableNow === false }"
          >
            <div v-if="i.imageUrl" class="w-20 h-20 rounded-xl bg-surface-dark bg-cover bg-center flex-shrink-0" :style="{ backgroundImage: `url(${i.imageUrl})` }" />
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <p class="text-sm font-bold text-navy leading-tight">{{ i.name }}</p>
                <p class="text-sm font-black text-teal whitespace-nowrap">{{ formatPrice(i.price) }}</p>
              </div>
              <p v-if="i.description" class="text-xs text-text-secondary mt-1">{{ i.description }}</p>

              <div v-if="(i.allergens ?? []).length" class="flex flex-wrap gap-1 mt-2">
                <span v-for="tag in i.allergens" :key="tag" class="text-[10px] px-1.5 py-0.5 rounded bg-navy/5 text-navy font-bold">{{ allergenLabel(tag) }}</span>
              </div>

              <p v-if="i.availableFrom && i.availableTo" class="text-[11px] font-bold mt-2" :class="i.availableNow === false ? 'text-warning' : 'text-text-muted'">
                {{ i.availableNow === false ? '⏰ Disponible' : '🕐' }} {{ i.availableFrom }} - {{ i.availableTo }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Combos -->
      <section v-if="menu?.combos.length" class="px-5 mt-8">
        <h2 class="text-lg font-black text-navy border-b-2 border-teal/30 pb-2 mb-3">🎁 Combos</h2>
        <div class="space-y-3">
          <div v-for="c in menu.combos" :key="c.id" class="bg-white rounded-2xl shadow-sm border border-border p-4 flex gap-3">
            <div v-if="c.imageUrl" class="w-20 h-20 rounded-xl bg-surface-dark bg-cover bg-center flex-shrink-0" :style="{ backgroundImage: `url(${c.imageUrl})` }" />
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <p class="text-sm font-bold text-navy leading-tight">{{ c.name }}</p>
                <p class="text-sm font-black text-teal whitespace-nowrap">{{ formatPrice(c.price) }}</p>
              </div>
              <p v-if="c.description" class="text-xs text-text-secondary mt-1">{{ c.description }}</p>
              <p class="text-xs text-text-muted mt-2">
                {{ c.components.map((comp) => `${comp.quantity}× ${comp.name}`).join(' + ') }}
              </p>
              <div v-if="(c.allergens ?? []).length" class="flex flex-wrap gap-1 mt-2">
                <span v-for="tag in c.allergens" :key="tag" class="text-[10px] px-1.5 py-0.5 rounded bg-navy/5 text-navy font-bold">{{ allergenLabel(tag) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- QR de esta carta (para compartir la mesa) -->
      <section class="px-5 mt-10 flex flex-col items-center">
        <div class="bg-white rounded-2xl shadow-sm border border-border p-4">
          <QrcodeVue :value="publicUrl" :size="140" level="M" render-as="svg" />
        </div>
        <p class="text-[11px] text-text-muted mt-2 text-center">Escaneá para volver a esta carta</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// pages/public/menu.vue — Carta pública de solo lectura (F7). SIN sesión, SIN layout de panel
// (sidebar/header del hotel): un huésped la abre desde el celular escaneando el QR de su mesa.
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import QrcodeVue from 'qrcode.vue'
import { RestaurantService, ALLERGEN_LABELS, type PublicMenu, type AllergenTag } from '@/services/Restaurant.service'
import { supportedLangs } from '@/composables/useSupportedLangs'

const route = useRoute()
const hotelId = String(route.params.hotelId ?? '')

const menu = ref<PublicMenu | null>(null)
const loading = ref(true)
const error = ref(false)
// El DTO público (allow-list) NUNCA trae el mapa `translations` crudo (specs/menu-public/spec.md) —
// a diferencia de la carta admin, acá no hay forma de saber de antemano qué idiomas tienen contenido
// cargado sin una request extra por idioma. Se ofrece el catálogo completo de `supportedLangs` (mismo
// origen que carta.vue); un idioma sin traducción para un campo cae a español (fallback ya resuelto
// por el backend, no es un error) — comportamiento correcto, documentado en specs/menu-i18n.
const lang = ref<string>('')

const allergenLabel = (tag: string): string => ALLERGEN_LABELS[tag as AllergenTag] ?? tag
function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)
}

const categoriesWithItems = computed(() => menu.value?.categories.filter((c) => c.items.length > 0) ?? [])
const featuredItems = computed(() =>
  (menu.value?.categories.flatMap((c) => c.items) ?? []).filter((i) => (i.featured ?? 0) === 1),
)
const publicUrl = computed(() => `${location.origin}/menu/${hotelId}`)

async function load(): Promise<void> {
  loading.value = true
  error.value = false
  try {
    menu.value = await RestaurantService.getPublicMenu(hotelId, lang.value || undefined)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

function setLang(l: string): void {
  lang.value = l === 'es' ? '' : l
}

watch(lang, () => { void load() })
onMounted(() => { void load() })
</script>
