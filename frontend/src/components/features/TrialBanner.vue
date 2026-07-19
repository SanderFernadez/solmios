<template>
  <!-- Aviso de la prueba gratis.
       Sin esto, el corte del día 7 llega de sorpresa: el hotel entra, trabaja
       normal y de golpe no puede iniciar sesión. El aviso se pone urgente en los
       últimos días para que haya tiempo de decidir. -->
  <div
    v-if="show"
    class="flex items-center gap-3 px-6 py-2.5 border-b"
    :class="urgent ? 'bg-warning/10 border-warning/30' : 'bg-cyan/5 border-cyan/20'"
  >
    <span
      class="text-[10px] font-black px-2 py-1 rounded-full shrink-0"
      :class="urgent ? 'bg-warning text-navy' : 'bg-cyan text-navy'"
    >PRUEBA GRATIS</span>

    <span class="text-xs font-bold text-navy">
      <template v-if="daysLeft === 0">Tu prueba termina hoy</template>
      <template v-else-if="daysLeft === 1">Te queda 1 día de prueba</template>
      <template v-else>Te quedan {{ daysLeft }} días de prueba</template>
    </span>

    <span class="text-[11px] text-text-secondary hidden sm:inline">
      Después vas a necesitar un plan para seguir entrando.
    </span>

    <router-link
      to="/panel/suscripcion"
      class="ml-auto shrink-0 px-3.5 py-1.5 rounded-full bg-navy text-white text-[11px] font-bold hover:bg-navy-light transition-colors"
    >Ver planes</router-link>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { SignupService } from '@/services/Signup.service'

/** A partir de acá el aviso cambia de informativo a urgente. */
const URGENT_FROM_DAYS = 3

const status = ref<string>('')
const daysLeft = ref<number | null>(null)

const show = computed(() => status.value === 'trialing' && daysLeft.value !== null)
const urgent = computed(() => (daysLeft.value ?? 99) <= URGENT_FROM_DAYS)

onMounted(async () => {
  try {
    const sub = await SignupService.mySubscription()
    status.value = sub.status
    daysLeft.value = sub.daysLeft
  } catch {
    // Un hotel viejo sin suscripción no tiene nada que avisar: la barra no se muestra.
  }
})
</script>

<style scoped>
</style>
