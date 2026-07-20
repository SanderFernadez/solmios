<template>
  <div class="min-h-screen flex">
    <!-- Columna de marca: qué incluye la prueba -->
    <div class="hidden lg:flex lg:w-2/5 relative overflow-hidden bg-navy">
      <div class="absolute inset-0 bg-gradient-to-br from-navy via-navy to-navy-light"></div>
      <div class="relative z-10 flex flex-col justify-between w-full p-12 text-white">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-lg">S</div>
          <div>
            <div class="font-black text-lg leading-none">Solmi<span class="text-cyan">OS</span></div>
            <div class="text-[10px] text-white/60 uppercase tracking-wide mt-0.5">Panel Hotel</div>
          </div>
        </div>

        <div class="max-w-sm">
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan/15 border border-cyan/30 mb-5">
            <span class="w-1.5 h-1.5 rounded-full bg-cyan"></span>
            <span class="text-[11px] font-bold text-cyan">{{ trialDays }} días gratis</span>
          </div>
          <h2 class="text-3xl font-black leading-tight mb-3">Empezá a gestionar tu hotel hoy</h2>
          <p class="text-white/70 text-sm leading-relaxed mb-8">
            Sin tarjeta de crédito. Configurás tu hotel y arrancás en minutos.
          </p>
          <ul class="space-y-3">
            <li v-for="item in perks" :key="item" class="flex items-start gap-2.5 text-sm text-white/85">
              <span class="w-4 h-4 mt-0.5 rounded-full bg-cyan/20 grid place-items-center shrink-0">
                <svg class="w-2.5 h-2.5 text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
              </span>
              {{ item }}
            </li>
          </ul>
        </div>

        <p class="text-[11px] text-white/40">
          ¿Ya tenés cuenta?
          <router-link to="/login" class="text-cyan font-bold hover:underline">Iniciá sesión</router-link>
        </p>
      </div>
    </div>

    <!-- Formulario -->
    <div class="flex-1 flex items-center justify-center p-6 bg-surface">
      <div class="w-full max-w-md">
        <!-- Pasos. Se piden los datos en dos tandas para que no sea un muro de
             campos, pero la cuenta se crea de una sola vez al final: si se
             creara el usuario en el paso 1, una salida a mitad de camino dejaría
             cuentas sin hotel. -->
        <div class="flex items-center gap-2 mb-8">
          <div v-for="s in 2" :key="s" class="flex items-center gap-2 flex-1">
            <span
              class="w-7 h-7 rounded-full grid place-items-center text-xs font-black shrink-0 transition-colors"
              :class="step >= s ? 'bg-navy text-white' : 'bg-white text-text-muted border border-border'"
            >{{ s }}</span>
            <span class="text-[11px] font-bold" :class="step >= s ? 'text-navy' : 'text-text-muted'">
              {{ s === 1 ? 'Tu cuenta' : 'Tu hotel' }}
            </span>
            <span v-if="s === 1" class="h-px flex-1" :class="step > 1 ? 'bg-navy' : 'bg-border'"></span>
          </div>
        </div>

        <h1 class="text-2xl font-black text-navy mb-1">
          {{ step === 1 ? 'Creá tu cuenta' : 'Contanos de tu hotel' }}
        </h1>
        <p class="text-sm text-text-muted mb-6">
          {{ step === 1 ? `Empezás con ${trialDays} días gratis, sin tarjeta.` : 'Estos datos se pueden cambiar después.' }}
        </p>

        <!-- Paso 1: la persona -->
        <form v-if="step === 1" @submit.prevent="goToStep2" class="space-y-4">
          <div>
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Tu nombre *</label>
            <input v-model="form.ownerName" type="text" required autocomplete="name"
              class="w-full px-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:border-navy"
              placeholder="Ana Pérez">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Email *</label>
            <input v-model="form.email" type="email" required autocomplete="email"
              class="w-full px-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:border-navy"
              placeholder="vos@tuhotel.com">
            <p class="text-[11px] text-text-muted mt-1">Con este email vas a iniciar sesión.</p>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Contraseña *</label>
            <input v-model="form.password" type="password" required autocomplete="new-password" :minlength="MIN_PASSWORD"
              class="w-full px-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:border-navy"
              placeholder="Mínimo 8 caracteres">
          </div>
          <div v-if="error" class="text-xs text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{{ error }}</div>
          <button type="submit"
            class="w-full py-3 rounded-xl bg-navy text-white text-sm font-black hover:bg-navy-light transition-colors cursor-pointer">
            Continuar
          </button>
        </form>

        <!-- Paso 2: el hotel -->
        <form v-else @submit.prevent="submit" class="space-y-4">
          <div>
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Nombre del hotel *</label>
            <input v-model="form.hotelName" type="text" required
              class="w-full px-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:border-navy"
              placeholder="Hotel Boutique Palma">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">País</label>
            <SearchSelect v-model="form.country" :options="COUNTRIES" placeholder="Buscar país..." />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Ciudad</label>
              <input v-model="form.address" type="text"
                class="w-full px-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:border-navy"
                placeholder="Ciudad donde está el hotel">
            </div>
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Teléfono</label>
              <input v-model="form.phone" type="tel"
                class="w-full px-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:border-navy"
                placeholder="+1 809 555 0100">
            </div>
          </div>
          <div v-if="plans.length">
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Plan a probar</label>
            <select v-model="form.planId"
              class="w-full px-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
              <option v-for="p in plans" :key="p.id" :value="p.id">
                {{ p.name }} — ${{ p.price }}/mes (después de la prueba)
              </option>
            </select>
          </div>

          <div v-if="error" class="text-xs text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{{ error }}</div>

          <div class="flex gap-2">
            <button type="button" @click="step = 1; error = ''"
              class="px-4 py-3 rounded-xl border border-border text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">
              Atrás
            </button>
            <button type="submit" :disabled="saving"
              class="flex-1 py-3 rounded-xl bg-navy text-white text-sm font-black hover:bg-navy-light transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {{ saving ? 'Creando tu hotel…' : `Empezar mis ${trialDays} días gratis` }}
            </button>
          </div>
        </form>

        <p class="text-[11px] text-text-muted text-center mt-6 lg:hidden">
          ¿Ya tenés cuenta?
          <router-link to="/login" class="text-cyan font-bold hover:underline">Iniciá sesión</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { SignupService, type PublicPlan } from '@/services/Signup.service'
import SearchSelect from '@/components/ui/SearchSelect.vue'
import { COUNTRIES } from '@/data/locales'

/** Debe coincidir con `TRIAL_DAYS` del backend. Se muestra en 4 lugares. */
const trialDays = 7
const MIN_PASSWORD = 8

const perks = [
  'Reservas, habitaciones y huéspedes',
  'Limpieza y mantenimiento del día',
  'Cobros, caja y facturación',
  'Sin tarjeta de crédito',
]

const router = useRouter()
const auth = useAuthStore()

const step = ref(1)
const saving = ref(false)
const error = ref('')
const plans = ref<PublicPlan[]>([])

const form = ref({
  ownerName: '', email: '', password: '',
  hotelName: '', country: '', address: '', phone: '', planId: '',
})

onMounted(async () => {
  try {
    const res = await SignupService.publicPlans()
    plans.value = res ?? []
    if (plans.value.length && !form.value.planId) form.value.planId = plans.value[0]!.id
  } catch { /* los planes son opcionales para registrarse */ }
})

function goToStep2() {
  error.value = ''
  if (form.value.password.length < MIN_PASSWORD) {
    error.value = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`
    return
  }
  step.value = 2
}

/**
 * Crea la cuenta y entra derecho al panel: pedirle que inicie sesión después de
 * registrarse es un paso extra sin sentido, ya escribió su contraseña.
 */
async function submit() {
  error.value = ''
  saving.value = true
  try {
    await SignupService.signup({
      hotelName: form.value.hotelName.trim(),
      email: form.value.email.trim(),
      password: form.value.password,
      ownerName: form.value.ownerName.trim(),
      country: form.value.country.trim(),
      address: form.value.address.trim(),
      phone: form.value.phone.trim(),
      planId: form.value.planId || undefined,
    })
    await auth.login(form.value.email.trim(), form.value.password)
    router.push('/panel/dashboard')
  } catch (e: any) {
    // El email repetido se decide en el paso 1: se vuelve ahí para corregirlo.
    error.value = e?.message || 'No se pudo crear la cuenta. Intentá de nuevo.'
    if (/email/i.test(error.value)) step.value = 1
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
</style>
