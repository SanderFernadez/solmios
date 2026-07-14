<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Pasarelas de Pago</h2>
        <p class="text-sm text-text-muted mt-0.5">Conectá tu cuenta: el dinero de tus reservas entra directo a tu banco</p>
      </div>
    </div>

    <!-- Cada hotel cobra a SU cuenta: el aviso importa porque acá se cargan llaves que mueven plata -->
    <div class="rounded-[20px] border border-cyan/20 bg-cyan/5 p-4 mb-6 flex gap-3">
      <span class="text-lg shrink-0">🔒</span>
      <div class="text-xs text-text-secondary leading-relaxed">
        <strong class="text-navy">Estas credenciales son tuyas y de nadie más.</strong>
        Los cobros de tu hotel se procesan contra la cuenta que configurés acá, y el dinero llega a tu banco.
        Las llaves se guardan cifradas y no se muestran nunca más una vez cargadas.
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-sm text-text-muted">Cargando pasarelas…</div>

    <div v-else class="space-y-4">
      <div v-for="p in providers" :key="p.provider" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
        <!-- Cabecera del proveedor -->
        <div class="p-5 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ p.icon }}</span>
            <div>
              <h3 class="font-extrabold text-navy">{{ p.name }}</h3>
              <p class="text-[11px] text-text-muted">{{ p.description }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="!p.implemented" class="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500">Próximamente</span>
            <span v-else-if="gatewayOf(p.provider)?.enabled" class="text-[10px] font-bold px-2 py-1 rounded-full bg-teal/10 text-teal">Activa</span>
            <span v-else-if="gatewayOf(p.provider)" class="text-[10px] font-bold px-2 py-1 rounded-full bg-gold/10 text-gold">Configurada — inactiva</span>
            <span v-else class="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500">Sin configurar</span>
            <button
              v-if="p.implemented"
              @click="toggleForm(p.provider)"
              class="text-[11px] font-bold text-navy/70 hover:text-navy transition-colors cursor-pointer"
            >{{ openForm === p.provider ? 'Cerrar' : (gatewayOf(p.provider) ? 'Editar' : 'Configurar') }}</button>
          </div>
        </div>

        <!-- Lo que el proveedor puede y no puede hacer: se lee del backend, no se adivina -->
        <div v-if="p.implemented || gatewayOf(p.provider)" class="px-5 pb-4 flex gap-2 flex-wrap">
          <span class="text-[10px] px-2 py-1 rounded-full bg-surface text-text-secondary">{{ confirmationLabel(p.confirmation) }}</span>
          <span class="text-[10px] px-2 py-1 rounded-full" :class="p.capabilities.refund ? 'bg-surface text-text-secondary' : 'bg-coral/10 text-coral'">
            {{ p.capabilities.refund ? 'Permite reembolsos' : 'No permite reembolsos' }}
          </span>
          <span v-if="p.capabilities.paymentLinks" class="text-[10px] px-2 py-1 rounded-full bg-surface text-text-secondary">Links de pago</span>
        </div>

        <!-- Formulario -->
        <div v-if="openForm === p.provider" class="border-t border-border p-5 bg-surface/30">
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Modo</label>
              <select v-model="form.mode" class="w-full px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer bg-white">
                <option value="test">Prueba (no cobra dinero real)</option>
                <option value="live">Producción (cobra dinero real)</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Moneda</label>
              <select v-model="form.currency" class="w-full px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer bg-white">
                <option value="usd">USD — Dólar</option>
                <option value="dop">DOP — Peso dominicano</option>
                <option value="eur">EUR — Euro</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Llave secreta</label>
              <input
                v-model="form.secretKey" type="password"
                :placeholder="current?.hasSecret ? `${current.secretMask} (guardada)` : 'sk_test_… o sk_live_…'"
                class="w-full px-4 py-2.5 rounded-full border border-border text-sm bg-white"
              />
              <p v-if="current?.hasSecret" class="text-[10px] text-text-muted mt-1 ml-4">Guardada. Dejala vacía para conservarla.</p>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Llave pública</label>
              <input v-model="form.publishableKey" type="text" placeholder="pk_test_… o pk_live_…" class="w-full px-4 py-2.5 rounded-full border border-border text-sm bg-white" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Secreto del webhook</label>
              <input
                v-model="form.webhookSecret" type="password"
                :placeholder="current?.hasWebhookSecret ? '•••••••• (guardado)' : 'whsec_…'"
                class="w-full px-4 py-2.5 rounded-full border border-border text-sm bg-white"
              />
              <p class="text-[10px] text-text-muted mt-1 ml-4">
                En Stripe, apuntá el webhook a: <code class="font-mono text-navy">{{ webhookUrl }}</code>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 mt-5 flex-wrap">
            <button @click="save(p.provider)" :disabled="saving" class="px-5 py-2.5 bg-navy text-white rounded-full text-sm font-bold hover:bg-navy-light transition-all cursor-pointer disabled:opacity-50">
              {{ saving ? 'Guardando…' : 'Guardar' }}
            </button>
            <button v-if="current" @click="testConnection(current.id)" :disabled="testing" class="px-5 py-2.5 bg-teal text-white rounded-full text-sm font-bold hover:bg-teal-light transition-all cursor-pointer disabled:opacity-50">
              {{ testing ? 'Probando…' : 'Probar conexión' }}
            </button>
            <button v-if="current" @click="toggleEnabled(current)" class="px-5 py-2.5 border border-border rounded-full text-sm font-bold text-text-secondary hover:border-navy/30 transition-all cursor-pointer">
              {{ current.enabled ? 'Desactivar' : 'Activar' }}
            </button>
            <button v-if="current" @click="remove(current)" class="ml-auto text-[11px] font-bold text-coral hover:text-navy transition-colors cursor-pointer">
              Eliminar
            </button>
          </div>

          <p v-if="form.mode === 'live'" class="text-[11px] text-coral font-bold mt-3">
            ⚠ En modo Producción los cobros son reales y el dinero se mueve de verdad.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useToast } from '@/composables/useToast'
import {
  PaymentGatewayService,
  type PaymentGateway,
  type PaymentProvider,
  type ConfirmationMode,
} from '@/services/PaymentGateway.service'

const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const gateways = ref<PaymentGateway[]>([])
const openForm = ref<PaymentProvider | null>(null)

const form = reactive({
  mode: 'test' as 'test' | 'live',
  currency: 'usd',
  secretKey: '',
  publishableKey: '',
  webhookSecret: '',
})

/**
 * Catálogo de proveedores. Las capacidades reales las manda el backend por cada pasarela ya
 * configurada; esto describe lo que el sistema ofrece hoy. `implemented: false` = el puerto lo
 * admite pero falta el adapter, así que no se puede configurar todavía.
 */
const CATALOG = [
  {
    provider: 'stripe' as PaymentProvider,
    name: 'Stripe',
    icon: '💳',
    description: 'Tarjetas internacionales. Cobros, links de pago y reembolsos.',
    implemented: true,
    confirmation: 'push' as ConfirmationMode,
    capabilities: { refund: true, void: true, paymentLinks: true, confirmation: 'push' as ConfirmationMode },
  },
  {
    provider: 'azul' as PaymentProvider,
    name: 'Azul (Banco Popular)',
    icon: '🇩🇴',
    description: 'Pasarela dominicana. El huésped paga en el sitio de Azul y vuelve.',
    implemented: false,
    confirmation: 'return' as ConfirmationMode,
    capabilities: { refund: false, void: false, paymentLinks: false, confirmation: 'return' as ConfirmationMode },
  },
  {
    provider: 'cardnet' as PaymentProvider,
    name: 'CardNet',
    icon: '🏦',
    description: 'Pasarela dominicana. Requiere confirmar el tipo de contrato con tu ejecutivo.',
    implemented: false,
    confirmation: 'pull' as ConfirmationMode,
    capabilities: { refund: true, void: true, paymentLinks: false, confirmation: 'pull' as ConfirmationMode },
  },
  {
    provider: 'paypal' as PaymentProvider,
    name: 'PayPal',
    icon: '🅿️',
    description: 'Wallet y tarjetas. El huésped paga en PayPal y vuelve.',
    implemented: false,
    confirmation: 'push' as ConfirmationMode,
    capabilities: { refund: true, void: true, paymentLinks: false, confirmation: 'push' as ConfirmationMode },
  },
]

const providers = computed(() => CATALOG)

const current = computed(() => (openForm.value ? gatewayOf(openForm.value) : undefined))

const webhookUrl = computed(() => `${window.location.origin}/api/webhooks/stripe/{tuHotelId}`)

function gatewayOf(provider: PaymentProvider): PaymentGateway | undefined {
  return gateways.value.find(g => g.provider === provider)
}

function confirmationLabel(mode: ConfirmationMode): string {
  if (mode === 'push') return 'Confirma solo (webhook)'
  if (mode === 'return') return 'Confirma al volver del pago'
  return 'Confirma por consulta'
}

async function load() {
  loading.value = true
  try {
    const r = await PaymentGatewayService.list()
    gateways.value = r.data || []
  } catch (e) {
    toast.error((e as Error).message || 'No se pudieron cargar las pasarelas')
  } finally {
    loading.value = false
  }
}

function toggleForm(provider: PaymentProvider) {
  if (openForm.value === provider) {
    openForm.value = null
    return
  }
  openForm.value = provider
  const existing = gatewayOf(provider)
  // Los secretos nunca vuelven del backend: los campos arrancan vacíos y vacío = "no lo toques".
  form.mode = existing?.mode ?? 'test'
  form.currency = existing?.currency ?? 'usd'
  form.secretKey = ''
  form.publishableKey = ''
  form.webhookSecret = ''
}

async function save(provider: PaymentProvider) {
  const existing = gatewayOf(provider)
  if (!existing && !form.secretKey) {
    toast.error('Cargá la llave secreta para conectar la pasarela')
    return
  }
  saving.value = true
  try {
    await PaymentGatewayService.upsert({
      provider,
      mode: form.mode,
      currency: form.currency,
      // Vacíos = conservar los guardados. No mandarlos evita pisarlos con ''.
      ...(form.secretKey ? { secretKey: form.secretKey } : {}),
      ...(form.publishableKey ? { publishableKey: form.publishableKey } : {}),
      ...(form.webhookSecret ? { webhookSecret: form.webhookSecret } : {}),
      ...(existing ? {} : { enabled: true, isDefault: gateways.value.length === 0 }),
    })
    toast.success('Pasarela guardada')
    form.secretKey = ''
    form.webhookSecret = ''
    await load()
  } catch (e) {
    // El backend rechaza, por ejemplo, una llave sk_live_ guardada en modo prueba.
    toast.error((e as Error).message || 'No se pudo guardar la pasarela')
  } finally {
    saving.value = false
  }
}

async function testConnection(id: string) {
  testing.value = true
  try {
    const r = await PaymentGatewayService.test(id)
    if (r.ok) toast.success(r.message)
    else toast.error(r.message)
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo probar la conexión')
  } finally {
    testing.value = false
  }
}

async function toggleEnabled(gw: PaymentGateway) {
  try {
    await PaymentGatewayService.setEnabled(gw.id, !gw.enabled)
    toast.success(gw.enabled ? 'Pasarela desactivada' : 'Pasarela activada')
    await load()
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo cambiar el estado')
  }
}

async function remove(gw: PaymentGateway) {
  if (!confirm(`¿Eliminar la pasarela ${gw.provider}? Vas a tener que volver a cargar las llaves para cobrar.`)) return
  try {
    await PaymentGatewayService.remove(gw.id)
    toast.success('Pasarela eliminada')
    openForm.value = null
    await load()
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo eliminar la pasarela')
  }
}

onMounted(load)
</script>

<style scoped>
code {
  word-break: break-all;
}
</style>
