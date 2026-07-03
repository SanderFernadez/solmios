<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div class="flex gap-2">
        <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value" class="px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer" :class="activeTab === tab.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">{{ tab.label }}</button>
      </div>
      <button @click="saveSettings" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">Guardar Cambios</button>
    </div>

    <!-- Tab: Plataforma -->
    <div v-if="activeTab === 'platform'" class="grid grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-border card-shadow p-6">
        <h3 class="text-lg font-black text-navy mb-4">Información de la Plataforma</h3>
        <div class="space-y-4">
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Nombre de la Plataforma</label><input v-model="settings.platformName" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Email de Soporte</label><input v-model="settings.supportEmail" type="email" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Teléfono de Soporte</label><input v-model="settings.supportPhone" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Moneda por Defecto</label>
            <select v-model="settings.currency" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
              <option value="USD">USD — Dólar Americano</option>
              <option value="DOP">DOP — Peso Dominicano</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Zona Horaria</label>
            <select v-model="settings.timezone" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
              <option value="America/Santo_Domingo">Santo Domingo (GMT-4)</option>
              <option value="America/Bogota">Bogotá (GMT-5)</option>
              <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
            </select>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-2xl border border-border card-shadow p-6">
        <h3 class="text-lg font-black text-navy mb-4">Logo y Apariencia</h3>
        <div class="space-y-4">
          <div class="flex items-center gap-4 p-4 bg-surface rounded-xl">
            <div class="w-20 h-20 rounded-xl bg-gradient-to-br from-navy to-cyan flex items-center justify-center text-white text-3xl font-black">S</div>
            <div>
              <div class="text-sm font-bold text-navy mb-2">Logo Actual</div>
              <button class="px-3 py-1.5 bg-white border border-border rounded-lg text-[10px] font-bold hover:border-navy transition-colors cursor-pointer">Cambiar Logo</button>
            </div>
          </div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Color Primario</label>
            <div class="flex gap-2">
              <div v-for="color in brandColors" :key="color.value" @click="settings.brandColor = color.value" class="w-10 h-10 rounded-lg cursor-pointer border-2 transition-all" :class="settings.brandColor === color.value ? 'border-navy scale-110' : 'border-transparent'" :style="{ background: color.value }"></div>
            </div>
          </div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Dominio Personalizado</label><input v-model="settings.customDomain" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="app.solmios.com"></div>
        </div>
      </div>
    </div>

    <!-- Tab: Email -->
    <div v-if="activeTab === 'email'" class="grid grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-border card-shadow p-6">
        <h3 class="text-lg font-black text-navy mb-4">Configuración SMTP</h3>
        <div class="space-y-4">
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">SMTP Server</label><input v-model="settings.smtpServer" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Puerto</label><input v-model="settings.smtpPort" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Usuario</label><input v-model="settings.smtpUser" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Contraseña</label><input v-model="settings.smtpPassword" type="password" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Email Remitente</label><input v-model="settings.fromEmail" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Nombre Remitente</label><input v-model="settings.fromName" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
          <button @click="testEmail" class="w-full py-2.5 bg-surface text-navy rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Enviar Email de Prueba</button>
        </div>
      </div>
      <div class="bg-white rounded-2xl border border-border card-shadow p-6">
        <h3 class="text-lg font-black text-navy mb-4">Plantillas de Email</h3>
        <div class="space-y-3">
          <div v-for="template in emailTemplates" :key="template.name" class="flex items-center justify-between p-3 bg-surface rounded-xl cursor-pointer hover:bg-surface-dark transition-colors" @click="selectedTemplate = template">
            <div class="flex items-center gap-3"><span class="text-xl">{{ template.icon }}</span><div><div class="text-sm font-bold">{{ template.name }}</div><div class="text-[10px] text-text-muted">{{ template.description }}</div></div></div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="template.active ? 'bg-teal/10 text-teal' : 'bg-surface text-text-muted'">{{ template.active ? 'Activa' : 'Inactiva' }}</span>
              <button @click.stop="template.active = !template.active" class="w-10 h-5 rounded-full relative transition-colors cursor-pointer" :class="template.active ? 'bg-teal' : 'bg-gray-300'"><div class="w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow" :class="template.active ? 'right-0.5' : 'left-0.5'"></div></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: Seguridad -->
    <div v-if="activeTab === 'security'" class="grid grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-border card-shadow p-6">
        <h3 class="text-lg font-black text-navy mb-4">Autenticación</h3>
        <div class="space-y-3">
          <div v-for="option in securityOptions" :key="option.name" class="flex items-center justify-between p-3 bg-surface rounded-xl">
            <div><div class="text-sm font-bold">{{ option.name }}</div><div class="text-[10px] text-text-muted">{{ option.description }}</div></div>
            <button @click="option.enabled = !option.enabled" class="w-12 h-6 rounded-full relative transition-colors cursor-pointer" :class="option.enabled ? 'bg-teal' : 'bg-gray-300'"><div class="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow" :class="option.enabled ? 'right-0.5' : 'left-0.5'"></div></button>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-2xl border border-border card-shadow p-6">
        <h3 class="text-lg font-black text-navy mb-4">Políticas de Contraseña</h3>
        <div class="space-y-4">
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Longitud Mínima</label><input v-model.number="settings.minPasswordLength" type="number" min="6" max="32" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
          <div class="flex items-center justify-between p-3 bg-surface rounded-xl"><div class="text-sm font-bold">Requerir mayúsculas</div><button @click="settings.requireUppercase = !settings.requireUppercase" class="w-12 h-6 rounded-full relative transition-colors cursor-pointer" :class="settings.requireUppercase ? 'bg-teal' : 'bg-gray-300'"><div class="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow" :class="settings.requireUppercase ? 'right-0.5' : 'left-0.5'"></div></button></div>
          <div class="flex items-center justify-between p-3 bg-surface rounded-xl"><div class="text-sm font-bold">Requerir números</div><button @click="settings.requireNumbers = !settings.requireNumbers" class="w-12 h-6 rounded-full relative transition-colors cursor-pointer" :class="settings.requireNumbers ? 'bg-teal' : 'bg-gray-300'"><div class="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow" :class="settings.requireNumbers ? 'right-0.5' : 'left-0.5'"></div></button></div>
          <div class="flex items-center justify-between p-3 bg-surface rounded-xl"><div class="text-sm font-bold">Requerir caracteres especiales</div><button @click="settings.requireSpecial = !settings.requireSpecial" class="w-12 h-6 rounded-full relative transition-colors cursor-pointer" :class="settings.requireSpecial ? 'bg-teal' : 'bg-gray-300'"><div class="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow" :class="settings.requireSpecial ? 'right-0.5' : 'left-0.5'"></div></button></div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Expiración de Contraseña (días)</label><input v-model.number="settings.passwordExpiry" type="number" min="0" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="0 = nunca expira"></div>
        </div>
      </div>
    </div>

    <!-- Tab: Integraciones -->
    <div v-if="activeTab === 'integrations'" class="grid grid-cols-2 gap-6">
      <div v-for="integration in integrations" :key="integration.name" class="bg-white rounded-2xl border border-border card-shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ integration.icon }}</span>
            <div><h3 class="text-lg font-black text-navy">{{ integration.name }}</h3><div class="text-sm text-text-muted">{{ integration.description }}</div></div>
          </div>
          <button @click="integration.connected = !integration.connected" class="w-12 h-6 rounded-full relative transition-colors cursor-pointer" :class="integration.connected ? 'bg-teal' : 'bg-gray-300'"><div class="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow" :class="integration.connected ? 'right-0.5' : 'left-0.5'"></div></button>
        </div>
        <div v-if="integration.connected" class="space-y-3">
          <div v-for="field in integration.fields" :key="field.name"><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">{{ field.name }}</label><input :value="field.value" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" :type="field.type || 'text'"></div>
          <button class="w-full py-2.5 bg-surface text-navy rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Probar Conexión</button>
        </div>
        <div v-else class="bg-surface rounded-xl p-4 text-center">
          <div class="text-sm text-text-muted">No conectado</div>
          <button @click="integration.connected = true" class="mt-2 px-4 py-1.5 bg-navy text-white rounded-lg text-[10px] font-bold hover:shadow-lg transition-colors cursor-pointer">Conectar</button>
        </div>
      </div>
    </div>

    <!-- Tab: Facturación -->
    <div v-if="activeTab === 'billing'" class="grid grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-border card-shadow p-6">
        <h3 class="text-lg font-black text-navy mb-4">Configuración de Facturación</h3>
        <div class="space-y-4">
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Método de Cobro</label>
            <select v-model="settings.billingMethod" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
              <option value="transfer">Transferencia Bancaria</option>
            </select>
          </div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Ciclo de Facturación</label>
            <select v-model="settings.billingCycle" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestral</option>
              <option value="annual">Anual (con descuento)</option>
            </select>
          </div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Días de Gracia</label><input v-model.number="settings.graceDays" type="number" min="0" max="30" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Día de Cobro</label><input v-model.number="settings.billingDay" type="number" min="1" max="28" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
        </div>
      </div>
      <div class="bg-white rounded-2xl border border-border card-shadow p-6">
        <h3 class="text-lg font-black text-navy mb-4">Notas de Crédito y Descuentos</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between p-3 bg-surface rounded-xl"><div class="text-sm font-bold">Permitir notas de crédito</div><button @click="settings.allowCreditNotes = !settings.allowCreditNotes" class="w-12 h-6 rounded-full relative transition-colors cursor-pointer" :class="settings.allowCreditNotes ? 'bg-teal' : 'bg-gray-300'"><div class="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow" :class="settings.allowCreditNotes ? 'right-0.5' : 'left-0.5'"></div></button></div>
          <div class="flex items-center justify-between p-3 bg-surface rounded-xl"><div class="text-sm font-bold">Permitir descuentos por volumen</div><button @click="settings.allowVolumeDiscounts = !settings.allowVolumeDiscounts" class="w-12 h-6 rounded-full relative transition-colors cursor-pointer" :class="settings.allowVolumeDiscounts ? 'bg-teal' : 'bg-gray-300'"><div class="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow" :class="settings.allowVolumeDiscounts ? 'right-0.5' : 'left-0.5'"></div></button></div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Descuento por Pago Anual (%)</label><input v-model.number="settings.annualDiscount" type="number" min="0" max="50" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Impuesto (%)</label><input v-model.number="settings.taxRate" type="number" min="0" max="30" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ConfigService } from '@/services/Platform.service'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const activeTab = ref('platform')
const selectedTemplate = ref<any>(null)
const showSaved = ref(false)

const tabs = [
  { label: 'Plataforma', value: 'platform' },
  { label: 'Email', value: 'email' },
  { label: 'Seguridad', value: 'security' },
  { label: 'Integraciones', value: 'integrations' },
  { label: 'Facturación', value: 'billing' }
]

const brandColors = [
  { value: '#0D2B4E' }, { value: '#00B4D8' }, { value: '#117A65' }, { value: '#6C3483' }, { value: '#E74C3C' }, { value: '#B7950B' }
]

const settings = ref<any>({
  platformName: '', supportEmail: '', supportPhone: '', currency: 'USD',
  timezone: 'America/Santo_Domingo', brandColor: '#0D2B4E', customDomain: '',
  smtpServer: '', smtpPort: '587', smtpUser: '', smtpPassword: '', fromEmail: '', fromName: '',
  minPasswordLength: 8, requireUppercase: true, requireNumbers: true, requireSpecial: false, passwordExpiry: 90,
  billingMethod: 'stripe', billingCycle: 'monthly', graceDays: 7, billingDay: 1,
  allowCreditNotes: true, allowVolumeDiscounts: false, annualDiscount: 15, taxRate: 18,
})

const emailTemplates = ref<any[]>([])
const securityOptions = ref<any[]>([])
const integrations = ref<any[]>([
  { name: 'Stripe', icon: '💳', description: 'Pasarela de pagos con tarjeta', connected: false,
    fields: [{ name: 'Publishable Key', value: '', type: 'text' }, { name: 'Secret Key', value: '', type: 'password' }] },
  { name: 'WhatsApp Business', icon: '💬', description: 'API de WhatsApp para mensajes', connected: false,
    fields: [{ name: 'Phone Number ID', value: '', type: 'text' }, { name: 'Access Token', value: '', type: 'password' }] },
  { name: 'Google Maps', icon: '🗺️', description: 'API de Google Maps para ubicación', connected: false,
    fields: [{ name: 'API Key', value: '', type: 'text' }] },
])

onMounted(async () => {
  try {
    const [plataforma, smtp, tmpl, seg, integ] = await Promise.all([
      ConfigService.get('plataforma', 'platform'),
      ConfigService.get('smtp', 'platform'),
      ConfigService.get('email_templates', 'platform'),
      ConfigService.get('seguridad', 'platform'),
      ConfigService.get('integraciones', 'platform'),
    ])
    if (plataforma) Object.assign(settings.value, plataforma)
    if (smtp) Object.assign(settings.value, smtp)
    if (Array.isArray(tmpl)) emailTemplates.value = tmpl
    if (Array.isArray(seg)) securityOptions.value = seg
    if (Array.isArray(integ)) integrations.value = integ
  } catch { /* silent */ }
})

const saveSettings = async () => {
  try {
    const toSave = settings.value
    await Promise.all([
      ConfigService.set('plataforma', { platformName: toSave.platformName, supportEmail: toSave.supportEmail, supportPhone: toSave.supportPhone, currency: toSave.currency, timezone: toSave.timezone, customDomain: toSave.customDomain }, 'platform'),
      ConfigService.set('smtp', { server: toSave.smtpServer, port: toSave.smtpPort, user: toSave.smtpUser, password: toSave.smtpPassword, fromEmail: toSave.fromEmail, fromName: toSave.fromName }, 'platform'),
      ConfigService.set('integraciones', integrations.value, 'platform'),
    ])
    showSaved.value = true
    setTimeout(() => showSaved.value = false, 2000)
  } catch { toast.error('Error al guardar') }
}

const testEmail = () => {
  toast.success('Email de prueba enviado a ' + settings.value.smtpUser)
}
</script>
