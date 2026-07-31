<template>
  <!--
    MediaPicker — selector visual de media para el builder de la landing (admin).
    Lista las imágenes del hotel de un `type` dado (GET /api/hotel-media?type=hero|gallery)
    como thumbnails en grid, multi-select toggle (click agrega/quita del array ordenado),
    upload inline (input file → POST /api/hotel-media con data-URL base64) y reorder del set
    seleccionado (flechas arriba/abajo — el orden del array = orden del slider/sección).

    Emite `update:modelValue` con el array de ids en orden. El padre (landing.vue) lo guarda
    en `config.backgroundMediaIds` (hero, type='hero') o `config.mediaIds` (storytelling,
    type='gallery' — FIX landing-storytelling-block: antes hardcodeado a type='hero' siempre).

    NO toca el backend directamente salvo vía HotelMediaService (regla "no fetch en componentes").
  -->
  <div class="space-y-4">
    <!-- Header del picker: estado + acciones (upload). -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="min-w-0">
        <p class="text-[11px] font-bold uppercase tracking-wide text-text-muted">
          {{ heading }}
        </p>
        <p class="mt-0.5 text-[11px] text-text-muted leading-relaxed">
          {{ hint }}
        </p>
      </div>
      <label
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-cyan px-3.5 py-1.5 text-xs font-extrabold text-navy transition-colors hover:bg-cyan-light"
      >
        <span aria-hidden="true">↑</span> Subir imagen
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

    <!-- Estados de carga / error del listado. -->
    <div v-if="loading" class="grid grid-cols-3 gap-2 sm:grid-cols-4">
      <div
        v-for="i in 8"
        :key="i"
        class="aspect-4/3 animate-pulse rounded-lg border border-border bg-surface"
      />
    </div>
    <p v-else-if="loadError" class="rounded-lg bg-danger/10 p-3 text-xs font-bold text-danger">
      {{ loadError }}
    </p>

    <template v-else>
      <!-- Grid de thumbnails (todas las hero del hotel). -->
      <div v-if="mediaItems.length > 0" class="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <button
          v-for="item in mediaItems"
          :key="item.id"
          type="button"
          @click="toggle(item.id)"
          :aria-pressed="isSelected(item.id)"
          :aria-label="isSelected(item.id) ? 'Quitar del carrusel' : 'Agregar al carrusel'"
          class="group relative aspect-4/3 overflow-hidden rounded-lg border-2 bg-surface transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan"
          :class="isSelected(item.id) ? 'border-cyan ring-2 ring-cyan/40' : 'border-border hover:border-navy/40'"
        >
          <img
            :src="item.url"
            :alt="item.alt ?? ''"
            class="h-full w-full object-cover"
            loading="lazy"
            draggable="false"
          />
          <!-- Badge de selección (número de orden en el array). -->
          <span
            v-if="isSelected(item.id)"
            class="absolute top-1 left-1 grid h-5 w-5 place-items-center rounded-full bg-cyan text-[10px] font-black text-navy shadow"
          >
            {{ orderOf(item.id) + 1 }}
          </span>
          <!-- Check overlay cuando está seleccionada. -->
          <span
            v-if="isSelected(item.id)"
            class="absolute inset-0 grid place-items-center bg-navy/30"
            aria-hidden="true"
          >
            <span class="text-xl font-black text-white">✓</span>
          </span>
        </button>
      </div>

      <!-- Empty state: sin imágenes hero todavía. -->
      <p
        v-else
        class="rounded-xl border border-dashed border-border bg-surface p-4 text-center text-xs text-text-muted leading-relaxed"
      >
        Todavía no hay imágenes {{ emptyStateNoun }}. Subí la primera con el botón
        <strong>«Subir imagen»</strong>.
      </p>

      <!-- Set seleccionado (orden del carrusel/sección). -->
      <div v-if="selectedItems.length > 0" class="rounded-xl border border-border bg-surface p-3">
        <p class="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-text-muted">
          <span>{{ selectionLabel }} · {{ selectedItems.length }}</span>
          <button
            v-if="selectedItems.length > 0"
            type="button"
            @click="clearAll"
            class="rounded-full bg-danger/10 px-2.5 py-1 text-[10px] font-bold text-danger hover:bg-danger/20 cursor-pointer"
          >
            Limpiar
          </button>
        </p>
        <ol class="space-y-1.5">
          <li
            v-for="(item, idx) in selectedItems"
            :key="item.id"
            class="flex items-center gap-2 rounded-lg bg-white p-1.5"
          >
            <img
              :src="item.url"
              :alt="item.alt ?? ''"
              class="h-9 w-12 shrink-0 rounded object-cover"
              loading="lazy"
              draggable="false"
            />
            <span class="min-w-0 flex-1 truncate text-xs font-bold text-navy">
              <span class="text-text-muted">#{{ idx + 1 }}</span>
              {{ item.alt?.trim() || `Imagen ${idx + 1}` }}
            </span>
            <button
              type="button"
              @click="move(idx, -1)"
              :disabled="idx === 0"
              aria-label="Mover antes"
              class="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-navy/5 text-navy hover:bg-navy/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
            >▲</button>
            <button
              type="button"
              @click="move(idx, 1)"
              :disabled="idx === selectedItems.length - 1"
              aria-label="Mover después"
              class="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-navy/5 text-navy hover:bg-navy/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
            >▼</button>
            <button
              type="button"
              @click="toggle(item.id)"
              aria-label="Quitar del carrusel"
              class="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-danger/10 text-danger hover:bg-danger/20 cursor-pointer"
            >✕</button>
          </li>
        </ol>
      </div>
    </template>

    <!-- Estado de upload (spinner sutil sobre el botón ya deshabilitado). -->
    <p v-if="uploading" class="text-[11px] font-bold text-text-muted">Subiendo imagen…</p>
    <p v-if="uploadError" class="rounded-lg bg-danger/10 p-2.5 text-[11px] font-bold text-danger">
      {{ uploadError }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { HotelMediaService, type HotelMediaItem } from '@/services/HotelMedia.service'

const props = withDefaults(defineProps<{ modelValue: string[]; type?: 'hero' | 'gallery' }>(), {
  type: 'hero',
})
const emit = defineEmits<{ 'update:modelValue': [ids: string[]] }>()

// Copy por type — 'hero' usa lenguaje de carrusel (fondo del hero rota entre varias fotos),
// 'gallery' (storytelling) usa lenguaje de "fotos de la sección" (no hay rotación automática).
const heading = computed(() => props.type === 'hero' ? 'Imágenes del fondo (carrusel)' : 'Fotos de la sección')
const hint = computed(() => props.type === 'hero'
  ? 'Tocá una imagen para agregarla o quitarla. El orden del set seleccionado abajo es el orden del carrusel. Si elegís una sola, no hay carrusel (igual que antes).'
  : 'Tocá una imagen para agregarla o quitarla. El orden del set seleccionado abajo es el orden en que se muestran.')
const selectionLabel = computed(() => props.type === 'hero' ? 'Orden del carrusel' : 'Orden de las fotos')
const emptyStateNoun = computed(() => props.type === 'hero' ? 'para el hero del hotel' : 'en la galería del hotel')

// ─── Estado del listado ────────────────────────────────────────────────────
const loading = ref(true)
const loadError = ref('')
const mediaItems = ref<HotelMediaItem[]>([])

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const result = await HotelMediaService.list({ type: props.type })
    mediaItems.value = (result?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
    // Limpiar ids seleccionados que ya no existen en el set (ej: se borró una imagen).
    pruneSelection()
  } catch (e) {
    loadError.value = (e as Error)?.message || 'No pudimos cargar las imágenes.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

// ─── Selección (array ordenado, emit向 padre) ──────────────────────────────
const selectedIds = computed<string[]>({
  get: () => props.modelValue ?? [],
  set: (next) => emit('update:modelValue', next),
})

const selectedItems = computed<HotelMediaItem[]>(() =>
  selectedIds.value
    .map((id) => mediaItems.value.find((m) => m.id === id))
    .filter((m): m is HotelMediaItem => Boolean(m)),
)

function isSelected(id: string): boolean {
  return selectedIds.value.includes(id)
}
function orderOf(id: string): number {
  return selectedIds.value.indexOf(id)
}

function toggle(id: string) {
  const current = selectedIds.value.slice()
  const idx = current.indexOf(id)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(id)
  selectedIds.value = current
}

function move(idx: number, delta: number) {
  const next = selectedIds.value.slice()
  const target = idx + delta
  if (target < 0 || target >= next.length) return
  ;[next[idx], next[target]] = [next[target], next[idx]]
  selectedIds.value = next
}

function clearAll() {
  selectedIds.value = []
}

function pruneSelection() {
  const validIds = new Set(mediaItems.value.map((m) => m.id))
  const next = (props.modelValue ?? []).filter((id) => validIds.has(id))
  // Solo emit si cambió (evita loop innecesario).
  if (next.length !== (props.modelValue ?? []).length) {
    emit('update:modelValue', next)
  }
}

// ─── Upload inline (input file → base64 → POST) ────────────────────────────
const uploading = ref(false)
const uploadError = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  uploadError.value = ''
  try {
    const dataUrl = await readAsDataUrl(file)
    const created = await HotelMediaService.upload({
      type: props.type,
      url: dataUrl,
      alt: file.name.replace(/\.[^.]+$/, '').slice(0, 80) || null,
      fileName: file.name,
    })
    // Apendear al listado local sin refetch (el item ya viene completo del backend).
    mediaItems.value = [...mediaItems.value, created as HotelMediaItem].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )
    // Auto-seleccionar la recién subida (flujo esperado: subo → la quiero en el slider).
    if (!isSelected(created.id)) toggle(created.id)
  } catch (e) {
    uploadError.value = (e as Error)?.message || 'No se pudo subir la imagen.'
  } finally {
    uploading.value = false
    // Reset del input para permitir subir el MISMO archivo dos veces seguidas.
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
</script>

<style scoped>
/* Aspect ratio fallback si `aspect-4/3` no está generada por Tailwind 4 (suele estar,
   pero dejamos esto para no romper si purge la saca). */
.aspect-4\/3 { aspect-ratio: 4 / 3; }
</style>
