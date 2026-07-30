<template>
  <!--
    Media general — gestor de imágenes del hotel (panel-pagina-publica-gaps, solmi-direct-booking).
    Resumen:
      • Tabs por `type`: hero | gallery | room (los 3 que soporta el backend).
      • Por tab: grid de thumbnails, upload (input file → base64 → HotelMediaService.upload),
        delete (remove), reorder por flechas ↑↓ (reorder), edit alt inline (update).
      • EmptyState cubre vacío Y error (regla empty-state-vs-load-error-blank-screen).
      • NO toca el backend directamente (regla "no fetch en componentes"): solo HotelMediaService.
    El orden de cada tab se persiste on-the-fly al mover (reorder es barato y atómico en el server).
  -->
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-xl font-black text-navy">Galería de imágenes</h2>
        <p class="text-sm text-text-muted mt-0.5">
          Subí y organizá las fotos que se ven en tu landing pública y en el motor de reservas.
        </p>
      </div>
      <label
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-cyan px-5 py-2.5 text-sm font-extrabold text-navy transition-all hover:shadow-lg"
        :class="uploading ? 'opacity-60 pointer-events-none' : ''"
      >
        <span aria-hidden="true">↑</span>
        {{ uploading ? 'Subiendo…' : 'Subir imagen' }}
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="hidden"
          :disabled="uploading"
          @change="onFileChange"
        />
      </label>
    </div>

    <!-- Tabs por tipo -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        @click="activeTab = tab.id"
        class="rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer"
        :class="activeTab === tab.id
          ? 'bg-navy text-white'
          : 'bg-surface text-text-secondary hover:bg-navy/5'"
      >
        {{ tab.label }}
        <span
          class="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums"
          :class="activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white text-text-muted'"
        >{{ countFor(tab.id) }}</span>
      </button>
    </div>

    <!-- Contenido -->
    <SectionCard
      :key="activeTab"
      :title="activeTabMeta.title"
      :subtitle="activeTabMeta.subtitle"
      body-class="p-4 sm:p-5"
    >
      <!-- Loading skeleton -->
      <div v-if="loading" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div
          v-for="i in 8"
          :key="i"
          class="aspect-4/3 animate-pulse rounded-xl border border-border bg-surface"
        />
      </div>

      <!-- Error -->
      <EmptyState
        v-else-if="loadError"
        icon="⚠️"
        title="No pudimos cargar las imágenes"
        :message="loadError"
      >
        <template #action>
          <button
            type="button"
            @click="load"
            class="rounded-full bg-navy px-5 py-2 text-sm font-bold text-white hover:shadow-lg cursor-pointer"
          >
            Reintentar
          </button>
        </template>
      </EmptyState>

      <!-- Vacío -->
      <EmptyState
        v-else-if="items.length === 0"
        :icon="activeTabMeta.icon"
        :title="`Subí tu primera foto de ${activeTabMeta.labelLower}`"
        :message="activeTabMeta.emptyMessage"
      />

      <!-- Grid de thumbnails -->
      <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div
          v-for="(item, idx) in items"
          :key="item.id"
          class="group relative overflow-hidden rounded-xl border border-border bg-surface"
        >
          <div class="aspect-4/3 w-full overflow-hidden">
            <img
              :src="item.url"
              :alt="item.alt ?? ''"
              class="h-full w-full object-cover"
              loading="lazy"
              draggable="false"
            />
          </div>

          <!-- Overlay de acciones (hover) -->
          <div
            class="absolute inset-0 flex flex-col justify-between bg-navy/0 opacity-0 transition-all group-hover:bg-navy/40 group-hover:opacity-100"
          >
            <!-- Top bar: contador + delete -->
            <div class="flex items-start justify-between p-1.5">
              <span class="rounded-full bg-navy/80 px-2 py-0.5 text-[10px] font-black text-white tabular-nums">
                #{{ idx + 1 }}
              </span>
              <button
                type="button"
                @click="confirmRemove(item)"
                :disabled="removingId === item.id"
                :aria-label="`Borrar ${activeTabMeta.labelLower}`"
                class="grid h-7 w-7 place-items-center rounded-full bg-danger text-white shadow hover:bg-rose cursor-pointer disabled:opacity-50"
              >✕</button>
            </div>
            <!-- Bottom bar: reorder -->
            <div class="flex items-center justify-center gap-1.5 p-1.5">
              <button
                type="button"
                @click="move(idx, -1)"
                :disabled="idx === 0 || reordering"
                aria-label="Mover antes"
                class="grid h-7 w-7 place-items-center rounded-md bg-white/90 text-navy hover:bg-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >▲</button>
              <button
                type="button"
                @click="move(idx, 1)"
                :disabled="idx === items.length - 1 || reordering"
                aria-label="Mover después"
                class="grid h-7 w-7 place-items-center rounded-md bg-white/90 text-navy hover:bg-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >▼</button>
            </div>
          </div>

          <!-- Edit alt inline (siempre visible abajo) -->
          <div class="border-t border-border bg-white p-1.5">
            <input
              v-model="altDrafts[item.id]"
              type="text"
              spellcheck="false"
              placeholder="Texto alternativo (alt)"
              class="w-full bg-transparent border-0 px-1 py-1 text-[11px] text-navy placeholder-text-muted focus:outline-none focus:bg-surface rounded"
              @blur="commitAlt(item)"
              @keydown.enter.prevent="($event.target as HTMLInputElement)?.blur()"
            />
          </div>
        </div>
      </div>
    </SectionCard>

    <!-- Banner de error de upload/alt/reorder (no bloquea la UI, abajo) -->
    <div
      v-if="actionError"
      class="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-white border border-danger px-4 py-3 shadow-lg"
    >
      <p class="text-xs font-bold text-danger">{{ actionError }}</p>
      <button
        type="button"
        @click="actionError = ''"
        class="mt-1 text-[10px] font-bold text-text-muted hover:text-navy cursor-pointer"
      >Cerrar</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { HotelMediaService, type HotelMediaItem, type HotelMediaType } from '@/services/HotelMedia.service'
import { useToast } from '@/composables/useToast'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const toast = useToast()

// ─── Tabs ──────────────────────────────────────────────────────────────────
type TabId = HotelMediaType
interface TabDef {
  id: TabId
  label: string
  title: string
  subtitle: string
  icon: string
  labelLower: string
  emptyMessage: string
}

const tabs: TabDef[] = [
  {
    id: 'hero',
    label: 'Portada (Hero)',
    title: 'Fotos de portada',
    subtitle: 'Aparecen en el slider principal de tu landing pública',
    icon: '🏞️',
    labelLower: 'portada',
    emptyMessage: 'Las fotos de portada van en el carrusel principal de tu landing. Subí al menos una para que la página no se vea vacía.',
  },
  {
    id: 'gallery',
    label: 'Galería',
    title: 'Galería general',
    subtitle: 'Imágenes que muestran los espacios comunes del hotel',
    icon: '📸',
    labelLower: 'galería',
    emptyMessage: 'Mostrá los espacios comunes: recepción, piscina, restaurante, jardines. Los huéspedes las ven en la galería de la landing.',
  },
  {
    id: 'room',
    label: 'Habitaciones',
    title: 'Fotos de habitaciones',
    subtitle: 'Asociadas a cada tipo de habitación (se agrupan en la landing)',
    icon: '🛏️',
    labelLower: 'habitación',
    emptyMessage: 'Subí fotos de cada tipo de habitación. Se mostrarán junto al detalle de cada habitación en la landing.',
  },
]

const activeTab = ref<TabId>('hero')
const activeTabMeta = computed<TabDef>(() => tabs.find((t) => t.id === activeTab.value) ?? tabs[0])

// ─── Estado del listado ────────────────────────────────────────────────────
const loading = ref(true)
const loadError = ref('')
const items = ref<HotelMediaItem[]>([])

function countFor(tabId: TabId): number {
  // Solo tenemos cargado el tab activo (un listado por type); mostramos "?" en los demás
  // para no multiplicar requests. Al cambiar de tab se carga su cuenta real.
  return activeTab.value === tabId ? items.value.length : 0
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const result = await HotelMediaService.list({ type: activeTab.value })
    items.value = (result?.data ?? [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    // Inicializar drafts de alt con el valor actual.
    syncAltDrafts()
  } catch (e) {
    loadError.value = (e as Error)?.message || 'No pudimos cargar las imágenes.'
  } finally {
    loading.value = false
  }
}

// Recarga al cambiar de tab.
watch(activeTab, () => { load() })
onMounted(load)

// ─── Alt inline ────────────────────────────────────────────────────────────
// Un draft por item para poder editar sin disparar un request por tecla.
// Solo persiste on blur / Enter si cambió respecto del valor del item.
const altDrafts = ref<Record<string, string>>({})

function syncAltDrafts() {
  const next: Record<string, string> = {}
  for (const it of items.value) next[it.id] = it.alt ?? ''
  altDrafts.value = next
}

async function commitAlt(item: HotelMediaItem) {
  const draft = (altDrafts.value[item.id] ?? '').trim()
  if (draft === (item.alt ?? '').trim()) return
  try {
    const updated = await HotelMediaService.update(item.id, { alt: draft || null })
    // Merge local sin refetch.
    const idx = items.value.findIndex((m) => m.id === item.id)
    if (idx >= 0) items.value[idx] = { ...items.value[idx], ...updated }
    toast.success('Texto actualizado')
  } catch (e) {
    actionError.value = (e as Error)?.message || 'No se pudo guardar el texto alternativo.'
    // Revertir draft al valor anterior.
    altDrafts.value[item.id] = item.alt ?? ''
  }
}

// ─── Reorder (flechas ↑↓) ─────────────────────────────────────────────────
const reordering = ref(false)

async function move(idx: number, delta: number) {
  const target = idx + delta
  if (target < 0 || target >= items.value.length) return
  // Swap local inmediato (UX responsive) y persistir el nuevo orden de ids.
  const next = items.value.slice()
  ;[next[idx], next[target]] = [next[target], next[idx]]
  items.value = next
  reordering.value = true
  try {
    await HotelMediaService.reorder(items.value.map((m) => m.id))
  } catch (e) {
    actionError.value = (e as Error)?.message || 'No se pudo guardar el orden. Recargá para ver el orden real.'
    // Volver al orden previo (revertir swap).
    const revert = items.value.slice()
    ;[revert[idx], revert[target]] = [revert[target], revert[idx]]
    items.value = revert
  } finally {
    reordering.value = false
  }
}

// ─── Delete ────────────────────────────────────────────────────────────────
const removingId = ref<string | null>(null)

async function confirmRemove(item: HotelMediaItem) {
  // Confirm ligero (sin AppModal para no acoplar más): el admin puede subir de nuevo.
  // El botón es destructivo pero la acción es reversible (re-upload).
  if (!window.confirm('¿Eliminar esta imagen? La podés volver a subir cuando quieras.')) return
  removingId.value = item.id
  try {
    await HotelMediaService.remove(item.id)
    items.value = items.value.filter((m) => m.id !== item.id)
    delete altDrafts.value[item.id]
    toast.success('Imagen eliminada')
  } catch (e) {
    actionError.value = (e as Error)?.message || 'No se pudo eliminar la imagen.'
  } finally {
    removingId.value = null
  }
}

// ─── Upload (input file → base64 → POST) ──────────────────────────────────
const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  actionError.value = ''
  try {
    const dataUrl = await readAsDataUrl(file)
    const created = await HotelMediaService.upload({
      type: activeTab.value,
      url: dataUrl,
      alt: file.name.replace(/\.[^.]+$/, '').slice(0, 80) || null,
      fileName: file.name,
    })
    items.value = [...items.value, created as HotelMediaItem]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    altDrafts.value[created.id] = created.alt ?? ''
    toast.success('Imagen subida')
  } catch (err) {
    actionError.value = (err as Error)?.message || 'No se pudo subir la imagen.'
  } finally {
    uploading.value = false
    // Reset para permitir subir el MISMO archivo dos veces seguidas.
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(file)
  })
}

// ─── Errores flotantes de acción (upload/alt/reorder/delete) ───────────────
const actionError = ref('')
</script>

<style scoped>
/* Aspect ratio fallback si `aspect-4/3` no está generada por Tailwind 4. */
.aspect-4\/3 { aspect-ratio: 4 / 3; }
</style>
