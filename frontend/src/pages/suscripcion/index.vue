<template>
  <div>
    <div class="mb-6">
      <h2 class="text-xl font-black text-navy">Tu suscripción</h2>
      <p class="text-sm text-text-muted mt-0.5">Estado de tu cuenta y planes disponibles</p>
    </div>

    <!-- Estado actual -->
    <SectionCard title="Estado" :subtitle="stateSubtitle">
      <div v-if="loading" class="h-16 animate-pulse rounded-xl bg-surface"></div>
      <div v-else class="flex items-center gap-4 flex-wrap">
        <span class="text-[11px] font-bold px-3 py-1.5 rounded-full" :class="statusClass">{{ statusLabel }}</span>
        <div v-if="sub?.status === 'trialing' && sub.daysLeft !== null" class="text-sm text-text-secondary">
          Te {{ sub.daysLeft === 1 ? 'queda' : 'quedan' }}
          <strong class="text-navy">{{ sub.daysLeft }} {{ sub.daysLeft === 1 ? 'día' : 'días' }}</strong>
          de prueba.
        </div>
        <div v-else-if="sub && !sub.allowed" class="text-sm text-danger font-bold">
          Tu acceso está cortado. Elegí un plan para volver a entrar.
        </div>
        <button
          v-if="sub?.hasStripeCustomer"
          @click="openPortal"
          :disabled="portalLoading"
          class="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg bg-surface text-navy hover:bg-surface-dark transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
        >{{ portalLoading ? 'Abriendo…' : 'Gestionar método de pago' }}</button>
      </div>
    </SectionCard>

    <!-- Planes -->
    <div class="mt-6">
      <div class="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-3">Planes disponibles</div>
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="i in 3" :key="i" class="h-56 animate-pulse rounded-2xl bg-surface"></div>
      </div>
      <EmptyState
        v-else-if="!plans.length"
        title="Todavía no hay planes publicados"
        message="Escribinos y te ayudamos a activar tu cuenta."
      />
      <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          v-for="p in plans" :key="p.id"
          class="rounded-2xl border-2 bg-white p-5 flex flex-col transition-colors"
          :class="p.id === sub?.planId ? 'border-navy' : 'border-border hover:border-navy/30'"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="text-sm font-black text-navy">{{ p.name }}</div>
            <span v-if="p.id === sub?.planId" class="text-[9px] font-bold text-navy bg-navy/10 px-2 py-0.5 rounded-full shrink-0">Tu plan</span>
          </div>
          <div class="mt-2 mb-1">
            <span class="text-3xl font-black text-navy tabular-nums">${{ p.price }}</span>
            <span class="text-xs text-text-muted">/mes</span>
          </div>
          <p v-if="p.description" class="text-xs text-text-secondary mb-3">{{ p.description }}</p>
          <ul v-if="p.features?.length" class="space-y-1.5 mb-4">
            <li v-for="f in p.features" :key="f" class="flex items-start gap-2 text-xs text-text-secondary">
              <span class="w-3.5 h-3.5 mt-0.5 rounded-full bg-teal/15 grid place-items-center shrink-0">
                <svg class="w-2 h-2 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="4"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
              </span>
              {{ f }}
            </li>
          </ul>
          <button
            @click="choose(p)"
            :disabled="checkoutLoading !== null"
            class="mt-auto w-full py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer bg-navy text-white hover:bg-navy-light disabled:opacity-60 disabled:cursor-wait"
          >{{ checkoutLoading === p.id ? 'Redirigiendo…' : (p.id === sub?.planId && sub?.status === 'active' ? 'Tu plan actual' : `Suscribirse a ${p.name}`) }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { SignupService, type PublicPlan, type MySubscription } from '@/services/Signup.service'
import { SubscriptionsService } from '@/services/Subscriptions.service'
import { useToast } from '@/composables/useToast'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const toast = useToast()

const loading = ref(true)
const sub = ref<MySubscription | null>(null)
const plans = ref<PublicPlan[]>([])
/** id del plan cuyo checkout está en curso — null cuando no hay ninguno en vuelo. */
const checkoutLoading = ref<string | null>(null)
const portalLoading = ref(false)

const STATUS_LABELS: Record<string, string> = {
  trialing: 'En prueba', active: 'Activa', past_due: 'Pago pendiente',
  expired: 'Vencida', canceled: 'Cancelada', none: 'Sin suscripción',
}

const statusLabel = computed(() => STATUS_LABELS[sub.value?.status ?? 'none'] ?? sub.value?.status ?? '—')
const statusClass = computed(() => {
  const s = sub.value?.status
  if (s === 'active') return 'bg-teal/10 text-teal'
  if (s === 'trialing') return 'bg-cyan/10 text-cyan'
  if (s === 'past_due') return 'bg-warning/10 text-warning'
  if (s === 'none') return 'bg-surface text-text-muted'
  return 'bg-danger/10 text-danger'
})
const stateSubtitle = computed(() =>
  sub.value?.trialEndsAt ? `Prueba hasta el ${new Date(sub.value.trialEndsAt).toLocaleDateString('es-DO')}` : '',
)

/** Elige un plan: crea la Checkout Session de Stripe y redirige el navegador ahí mismo
 * (no una pestaña nueva — el hotel tiene que volver a `/panel/suscripcion` al terminar). */
async function choose(p: PublicPlan) {
  if (checkoutLoading.value) return
  checkoutLoading.value = p.id
  try {
    const { url } = await SubscriptionsService.checkout(p.id)
    window.location.href = url
  } catch (e: any) {
    toast.error('No se pudo iniciar el pago', e.message)
    checkoutLoading.value = null
  }
}

async function openPortal() {
  if (portalLoading.value) return
  portalLoading.value = true
  try {
    const { url } = await SubscriptionsService.portal()
    window.location.href = url
  } catch (e: any) {
    toast.error('No se pudo abrir el portal de facturación', e.message)
    portalLoading.value = false
  }
}

onMounted(async () => {
  try {
    const [s, p] = await Promise.all([
      SignupService.mySubscription().catch(() => null),
      SignupService.publicPlans().catch(() => []),
    ])
    sub.value = s
    plans.value = p
  } finally {
    loading.value = false
  }

  // Vuelta del Checkout/Portal de Stripe (success_url/cancel_url en create-checkout-session.ts).
  const params = new URLSearchParams(window.location.search)
  if (params.get('checkout') === 'success') {
    toast.success('¡Listo! Tu pago se está confirmando — puede tardar unos segundos en reflejarse acá.')
  } else if (params.get('checkout') === 'cancelled') {
    toast.info('Pago cancelado. Podés intentar de nuevo cuando quieras.')
  }
})
</script>

<style scoped>
</style>
