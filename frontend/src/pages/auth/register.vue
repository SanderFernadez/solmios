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
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">
              Tu nombre <span class="text-danger">*</span>
            </label>
            <input v-model="form.ownerName" type="text" required autocomplete="name" :maxlength="LIMITS.ownerName"
              class="w-full px-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:border-navy"
              placeholder="Ana Pérez">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">
              Email <span class="text-danger">*</span>
            </label>
            <input v-model="form.email" type="email" required autocomplete="email" :maxlength="LIMITS.email"
              class="w-full px-4 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:border-navy"
              :class="emailTouched && !emailValid ? 'border-danger' : 'border-border'"
              @blur="emailTouched = true"
              placeholder="vos@tuhotel.com">
            <p v-if="emailTouched && !emailValid" class="text-[11px] text-danger mt-1">
              Escribí un email válido, con dominio completo (ej: ana@tuhotel.com).
            </p>
            <p v-else class="text-[11px] text-text-muted mt-1">Con este email vas a iniciar sesión.</p>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">
              Contraseña <span class="text-danger">*</span>
            </label>
            <div class="relative">
              <input v-model="form.password" :type="showPassword ? 'text' : 'password'" required
                autocomplete="new-password" :maxlength="PASSWORD_MAX"
                class="w-full px-4 py-2.5 pr-16 bg-white border border-border rounded-xl text-sm focus:outline-none focus:border-navy"
                placeholder="Elegí una contraseña segura">
              <button type="button" @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-text-muted hover:text-navy cursor-pointer">
                {{ showPassword ? 'Ocultar' : 'Ver' }}
              </button>
            </div>

            <!-- Fuerza + checklist. Se muestran recién al escribir: en blanco,
                 una lista de requisitos en rojo recibe mal a quien llega. -->
            <div v-if="form.password" class="mt-2">
              <div class="flex items-center gap-2">
                <div class="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-300"
                    :class="passwordBarClass" :style="{ width: `${(passwordScore + 1) * 20}%` }"></div>
                </div>
                <span class="text-[11px] font-bold" :class="passwordValid ? 'text-success' : 'text-text-muted'">
                  {{ passwordLabel }}
                </span>
              </div>
              <ul class="mt-2 space-y-1">
                <li v-for="req in passwordRequirements" :key="req.label"
                  class="flex items-center gap-1.5 text-[11px]"
                  :class="req.met ? 'text-success' : 'text-text-muted'">
                  <span class="w-3 h-3 shrink-0" v-html="req.met ? ICON_CHECK : ICON_DOT"></span>
                  {{ req.label }}
                </li>
              </ul>
            </div>
          </div>
          <div v-if="error" class="text-xs text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{{ error }}</div>
          <button type="submit" :disabled="!step1Valid"
            class="w-full py-3 rounded-xl bg-navy text-white text-sm font-black hover:bg-navy-light transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            Continuar
          </button>
        </form>

        <!-- Paso 2: el hotel -->
        <form v-else @submit.prevent="submit" class="space-y-4">
          <div>
            <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">
              Nombre del hotel <span class="text-danger">*</span>
            </label>
            <input v-model="form.hotelName" type="text" required :minlength="2" :maxlength="LIMITS.hotelName"
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
              <input v-model="form.address" type="text" :maxlength="LIMITS.address"
                class="w-full px-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:border-navy"
                placeholder="Ciudad donde está el hotel">
            </div>
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Teléfono</label>
              <input v-model="form.phone" type="tel" :maxlength="LIMITS.phone"
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

          <!-- Captcha. Solo aparece si hay site key configurada: sin ella el
               backend tampoco lo exige, y un hueco vacío confundiría. -->
          <div v-if="captchaSiteKey">
            <div ref="captchaEl" class="cf-turnstile"></div>
            <p v-if="captchaError" class="text-[11px] text-danger mt-1">{{ captchaError }}</p>
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { SignupService, type PublicPlan } from '@/services/Signup.service'
import SearchSelect from '@/components/ui/SearchSelect.vue'
import { COUNTRIES } from '@/data/locales'
import { usePasswordStrength, PASSWORD_MAX } from '@/composables/usePasswordStrength'

/** Debe coincidir con `TRIAL_DAYS` del backend. Se muestra en 4 lugares. */
const trialDays = 7

/**
 * Topes de cada campo. Espejan los `max` de SignupSchema en el backend: acá
 * evitan que se escriba de más, allá que alguien se saltee el formulario.
 */
const LIMITS = {
  ownerName: 120,
  email: 254,
  hotelName: 120,
  address: 200,
  phone: 40,
} as const

const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
const ICON_DOT = '<svg viewBox="0 0 24 24" fill="currentColor" class="w-full h-full"><circle cx="12" cy="12" r="4"/></svg>'

/**
 * Site key del captcha (Cloudflare Turnstile). Es pública por diseño. Si no
 * está definida en el build, el captcha no se muestra y el backend tampoco lo
 * exige: el registro sigue funcionando, protegido solo por rate-limit.
 */
const captchaSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''

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

const showPassword = ref(false)
const emailTouched = ref(false)

// Espejo de shared/password-policy.ts del backend. La validación que decide es
// la del servidor; esto es para no tener que apretar "Continuar" para saber qué
// falta.
const {
  requirements: passwordRequirements,
  isValid: passwordValid,
  score: passwordScore,
  label: passwordLabel,
  barClass: passwordBarClass,
} = usePasswordStrength(
  computed(() => form.value.password),
  () => ({ email: form.value.email, name: form.value.hotelName }),
)

/**
 * Mismo criterio que `isValidEmail` del backend: algo, arroba, dominio con
 * punto y TLD de 2+. No pretende cubrir el RFC entero, solo descartar lo
 * imposible. Que la dirección exista de verdad lo dirá la verificación por
 * correo.
 */
const emailValid = computed(() => {
  const e = form.value.email.trim()
  if (!e || e.length > LIMITS.email || e.includes('..')) return false
  return /^[^\s@,;:<>()[\]\\]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(e)
})

/** El botón de "Continuar" se habilita recién cuando el paso 1 está completo. */
const step1Valid = computed(() =>
  form.value.ownerName.trim().length > 0 && emailValid.value && passwordValid.value,
)

// — Captcha —
const captchaEl = ref<HTMLElement | null>(null)
const captchaToken = ref('')
const captchaError = ref('')
let captchaWidgetId: string | undefined

/** API que inyecta el script de Turnstile en `window`. */
interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id?: string) => void
}
function turnstile(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile
}

/** Carga el script una sola vez, aunque se entre y salga del paso 2. */
function loadCaptchaScript(): Promise<void> {
  const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  if (turnstile()) return Promise.resolve()
  const existing = document.querySelector(`script[src="${SRC}"]`)
  if (existing) return new Promise((res) => existing.addEventListener('load', () => res()))
  return new Promise((res, rej) => {
    const sc = document.createElement('script')
    sc.src = SRC
    sc.async = true
    sc.defer = true
    sc.onload = () => res()
    sc.onerror = () => rej(new Error('no se pudo cargar el captcha'))
    document.head.appendChild(sc)
  })
}

async function mountCaptcha() {
  if (!captchaSiteKey || captchaWidgetId !== undefined) return
  try {
    await loadCaptchaScript()
    await nextTick()
    const api = turnstile()
    if (!api || !captchaEl.value) return
    captchaWidgetId = api.render(captchaEl.value, {
      sitekey: captchaSiteKey,
      callback: (token: string) => { captchaToken.value = token; captchaError.value = '' },
      'expired-callback': () => { captchaToken.value = '' },
      'error-callback': () => {
        captchaToken.value = ''
        captchaError.value = 'No se pudo cargar la verificación. Revisá tu conexión.'
      },
    })
  } catch {
    captchaError.value = 'No se pudo cargar la verificación anti-robots. Recargá la página.'
  }
}

// El widget vive en el paso 2, que no está montado hasta que se llega.
watch(step, (s) => { if (s === 2) void mountCaptcha() })

onUnmounted(() => {
  if (captchaWidgetId !== undefined) turnstile()?.remove(captchaWidgetId)
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
  emailTouched.value = true
  if (!emailValid.value) {
    error.value = 'Revisá el email: falta el dominio o tiene un error de tipeo.'
    return
  }
  if (!passwordValid.value) {
    error.value = 'La contraseña todavía no cumple los requisitos de seguridad.'
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
  // Sin token no se manda: el backend lo rechazaría igual, pero el token se
  // consume en el intento y habría que resolver el captcha de nuevo por nada.
  if (captchaSiteKey && !captchaToken.value) {
    captchaError.value = 'Completá la verificación anti-robots para continuar.'
    return
  }
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
      captchaToken: captchaToken.value || undefined,
    })
    await auth.login(form.value.email.trim(), form.value.password)
    router.push('/panel/dashboard')
  } catch (e: any) {
    // El email repetido se decide en el paso 1: se vuelve ahí para corregirlo.
    error.value = e?.message || 'No se pudo crear la cuenta. Intentá de nuevo.'
    // El token de Turnstile es de un solo uso: sin resetear, todo reintento
    // vuelve a fallar por captcha aunque se corrija lo que estaba mal.
    captchaToken.value = ''
    if (captchaWidgetId !== undefined) turnstile()?.reset(captchaWidgetId)
    if (/email/i.test(error.value)) step.value = 1
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
</style>
