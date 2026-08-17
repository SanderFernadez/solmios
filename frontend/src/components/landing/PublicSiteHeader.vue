<template>
  <!-- Navbar liviana para páginas públicas de contenido (legal/*): mismo lenguaje visual
       que el navbar de la landing (pages/landing/index.vue) — logo, frosted glass al
       scrollear, CTAs de login/prueba — pero SIN los links de anchor a secciones
       (#features, #pricing, …) que solo existen en la landing y sin el scroll-spy que
       los resalta, porque acá no aplican. -->
  <nav
    class="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 transition-shadow duration-300"
    :class="scrolled ? 'shadow-[0_1px_24px_rgba(13,43,78,0.07)]' : ''"
  >
    <div class="max-w-7xl mx-auto px-6 h-[4.5rem]">
      <div class="flex items-center justify-between h-full">
        <router-link to="/" class="flex items-center gap-2.5 group">
          <div class="w-9 h-9 rounded-xl bg-navy text-white flex items-center justify-center font-black text-base shadow-sm group-hover:bg-blue transition-colors">S</div>
          <span class="font-black text-lg tracking-tight text-navy">Solmi<span class="text-blue">OS</span></span>
        </router-link>

        <div class="flex items-center gap-2.5">
          <router-link
            to="/login"
            class="text-sm font-semibold text-slate-600 hover:text-navy transition-colors duration-200 hidden sm:inline-block"
          >Iniciar Sesión</router-link>
          <router-link
            to="/login"
            class="inline-flex items-center gap-1.5 font-bold text-sm px-5 py-2.5 rounded-xl bg-blue text-white hover:bg-navy transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          >Prueba Gratis
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
          </router-link>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const scrolled = ref(false)
let ticking = false

function handleScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    scrolled.value = window.scrollY > 12
    ticking = false
  })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
})
onUnmounted(() => window.removeEventListener('scroll', handleScroll))
</script>
