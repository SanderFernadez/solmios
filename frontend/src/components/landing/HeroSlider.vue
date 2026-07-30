<template>
  <!--
    HeroSlider — fondo del hero con auto-rotate (carrusel). Vanilla JS (Interval + opacity),
    SIN dependencias nuevas (ver NOTA al final). Decisiones:
      • 0 imágenes → no renderiza (el caller decide el fallback gradient).
      • 1 imagen → <img> simple eager (igual que antes: sin controles, sin interval).
      • 2+ imágenes → slides apiladas absolute + transición opacity (fade suave, sin flash
        out/in que tiene <Transition mode="out-in">). Auto-rotate cada `intervalMs` (default 5s),
        flechas prev/next + dots indicadores. Pausa en hover (toggleable).
    El componente es PURAMENTE visual (fondo). El overlay + texto viven en HeroBlock.vue por
    template (classic/modern/boutique) — el slider se dropea dentro del contenedor de fondo
    de cada variante. Las imágenes son decorativas (alt=""); el contenido accesible es el
    título/subtítulo que HeroBlock pone encima.
  -->

  <!-- Caso single (1 imagen): sin carrusel, sin controles — performance igual al <img> previo. -->
  <img
    v-if="images.length === 1"
    :src="images[0]"
    :alt="alt"
    class="w-full h-full object-cover"
    loading="eager"
    fetchpriority="high"
  />

  <!-- Carrusel (2+ imágenes). -->
  <div
    v-else-if="images.length > 1"
    class="relative w-full h-full overflow-hidden"
    role="group"
    aria-roledescription="carrusel"
    :aria-label="`${images.length} imágenes de fondo`"
    @mouseenter="onHover(true)"
    @mouseleave="onHover(false)"
  >
    <!-- Slides apiladas (fade por opacity).preload todas eager: son fondo above-the-fold. -->
    <div
      v-for="(src, i) in images"
      :key="`${i}-${src}`"
      class="absolute inset-0 transition-opacity duration-700 ease-out"
      :class="i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'"
      :aria-hidden="i !== current ? 'true' : undefined"
    >
      <img
        :src="src"
        :alt="alt"
        class="w-full h-full object-cover"
        :loading="i === 0 ? 'eager' : 'lazy'"
        :fetchpriority="i === 0 ? 'high' : 'auto'"
        draggable="false"
      />
    </div>

    <!-- Flechas (solo mouse / desktop; los dots son el control principal táctil). -->
    <button
      type="button"
      @click="prev"
      aria-label="Imagen anterior"
      class="hidden sm:grid absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 place-items-center rounded-full bg-navy/40 text-white backdrop-blur-sm transition-colors hover:bg-navy/70 cursor-pointer"
    >
      <span aria-hidden="true" class="text-lg leading-none">‹</span>
    </button>
    <button
      type="button"
      @click="next"
      aria-label="Imagen siguiente"
      class="hidden sm:grid absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 place-items-center rounded-full bg-navy/40 text-white backdrop-blur-sm transition-colors hover:bg-navy/70 cursor-pointer"
    >
      <span aria-hidden="true" class="text-lg leading-none">›</span>
    </button>

    <!-- Dots (barra inferior, siempre visibles — control principal en touch + desktop). -->
    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
      <button
        v-for="(src, i) in images"
        :key="`dot-${i}-${src}`"
        type="button"
        @click="go(i)"
        :aria-label="`Ir a la imagen ${i + 1}`"
        :aria-current="i === current ? 'true' : undefined"
        class="h-2 w-2 rounded-full transition-all cursor-pointer"
        :class="i === current ? 'bg-white w-5' : 'bg-white/50 hover:bg-white/80'"
      />
    </div>
  </div>

  <!-- 0 imágenes: nada. El caller renderiza el fallback gradient. -->
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

/** Intervalo default entre slides (ms). El hero es above-the-fold: 5s es suficiente para
 *  registrar la imagen sin hacer ruido visual. Override vía prop `intervalMs`. */
const DEFAULT_SLIDE_INTERVAL_MS = 5000

const props = withDefaults(defineProps<{
  /** URLs de las imágenes del fondo. Orden = orden del carrusel. */
  images: string[]
  /** alt compartido (decorativo — el contenido accesible va en HeroBlock). */
  alt?: string
  /** ms entre slides. Default DEFAULT_SLIDE_INTERVAL_MS (5s). */
  intervalMs?: number
  /** Pausar auto-rotate en hover. Default true. */
  pauseOnHover?: boolean
}>(), {
  alt: '',
  intervalMs: DEFAULT_SLIDE_INTERVAL_MS,
  pauseOnHover: true,
})

const current = ref(0)
const paused = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

function advance() {
  if (props.images.length <= 1) return
  current.value = (current.value + 1) % props.images.length
}

function start() {
  stop()
  if (props.images.length <= 1) return
  timer = setInterval(() => {
    if (paused.value) return
    advance()
  }, props.intervalMs)
}

function stop() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

function next() { advance(); start() }
function prev() {
  if (props.images.length <= 1) return
  current.value = (current.value - 1 + props.images.length) % props.images.length
  start()
}
function go(i: number) {
  if (i < 0 || i >= props.images.length) return
  current.value = i
  start()
}

function onHover(isHovering: boolean) {
  if (!props.pauseOnHover) return
  paused.value = isHovering
}

// Si cambia el set de imágenes (ej: el admin edita y el watcher del padre refresca),
// resetear al primero y re-armar el interval con el nuevo length.
watch(
  () => [props.images.length, props.intervalMs],
  () => {
    if (current.value > props.images.length - 1) current.value = 0
    start()
  },
)

onMounted(start)
onBeforeUnmount(stop)
</script>

<style scoped>
/*
  NOTA DE DISEÑO — Carrusel SIN librería:
  El task sugería "vanilla o lib liviana". Elegí vanilla (Interval + opacity) porque:
    1. El carrusel es solo fondo (fade) — sin swipe complejo, sin RTL, sin lazy-heuristics.
       Swiper/Splide/Embla suman 30-80KB para resolver problemas que este componente no tiene.
    2. El fade por opacity (slides apiladas absolute) es más suave que <Transition mode="out-in">:
       este último descarga la slide vieja ANTES de montar la nueva → flash de fondo vacío en
       conexiones lentas. Apiladas + opacity mantiene ambas visibles durante la transición.
    3. Los controles (flechas + dots) son 2 botones cada uno — reusarlos de una lib es más
       boilerplate que escribirlos a mano.
  Si más adelante se necesita swipe/RTL/drag, migrar a embla-carousel-reactivo (8KB) antes
  que a swiper (40KB+).
*/
</style>
