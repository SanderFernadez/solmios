<template>
  <div class="min-h-screen bg-surface flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-navy to-blue mx-auto flex items-center justify-center font-black text-white text-2xl mb-4 shadow-lg">S</div>
        <h1 class="text-2xl font-black text-navy">Manager<span class="text-cyan">Hotel</span></h1>
        <p class="text-sm text-text-muted mt-1">Hospitality OS · LATAM</p>
      </div>

      <!-- Login Form -->
      <div class="bg-white rounded-2xl border border-border card-shadow p-8">
        <h2 class="text-lg font-extrabold text-navy mb-6">Iniciar Sesión</h2>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5 block">Email</label>
            <input v-model="email" type="email" placeholder="admin@hotel.com" class="w-full h-11 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/30" required />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide">Contraseña</label>
              <router-link to="/forgot-password" class="text-[11px] font-bold text-cyan hover:text-navy transition-colors">¿Olvidaste tu contraseña?</router-link>
            </div>
            <input v-model="password" type="password" placeholder="••••••••" class="w-full h-11 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/30" required />
          </div>

          <div v-if="error" class="bg-red/10 text-red text-xs font-bold p-3 rounded-xl">{{ error }}</div>

          <button type="submit" :disabled="loading" class="w-full h-11 bg-navy text-white font-extrabold text-sm rounded-xl hover:bg-navy-light transition-colors disabled:opacity-50 cursor-pointer">
            {{ loading ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>

        <!-- Demo Accounts -->
        <div class="mt-6 pt-6 border-t border-border">
          <div class="text-[10px] font-bold text-text-muted uppercase mb-3">Cuentas Demo</div>
          <div class="space-y-2">
            <button v-for="account in demoAccounts" :key="account.email" @click="loginAs(account)" class="w-full p-3 bg-surface rounded-xl hover:bg-surface-dark transition-colors cursor-pointer text-left">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" :class="account.avatarClass">{{ account.initials }}</div>
                <div class="flex-1">
                  <div class="text-sm font-bold text-navy">{{ account.name }}</div>
                  <div class="text-[10px] text-text-muted">{{ account.email }}</div>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="account.roleClass">{{ account.roleLabel }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { AuthService } from '@/services/Auth.service'

const router = useRouter()
const auth = useAuthStore()

const email = ref('admin@solmios.com')
const password = ref('demo123')
const error = ref('')
const loading = ref(false)

const ROLE_LABELS: Record<string, string> = { super_admin: 'Super Admin', hotel_admin: 'Hotel Admin', receptionist: 'Recepcionista' }
const AVATAR_CLASS: Record<string, string> = { super_admin: 'bg-red/20 text-red', hotel_admin: 'bg-cyan/20 text-cyan', receptionist: 'bg-teal/20 text-teal' }
const ROLE_CLASS: Record<string, string> = { super_admin: 'bg-red/10 text-red', hotel_admin: 'bg-cyan/10 text-cyan', receptionist: 'bg-teal/10 text-teal' }

const demoAccounts = ref<any[]>([])

onMounted(async () => {
  try {
    // Raw fetch justified: public endpoint, no auth required, AuthService has no method for this.
    // Matches http.ts behavior: check response.ok, parse JSON, handle errors.
    const r = await fetch('/api/public/users')
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}: ${r.statusText}`)
    }
    const json = await r.json()
    const list = Array.isArray(json) ? json : (json.data || [])
    if (Array.isArray(list)) {
      demoAccounts.value = list.map((u: any) => ({
        name: u.name,
        email: u.email,
        password: 'demo123',
        initials: (u.name || '??').split(' ').map((p: string) => p[0]).slice(0, 2).join(''),
        avatarClass: AVATAR_CLASS[u.role] || 'bg-surface text-navy',
        roleLabel: ROLE_LABELS[u.role] || u.role,
        roleClass: ROLE_CLASS[u.role] || '',
      }))
    }
  } catch (e) {
    // Silently degrade — demo accounts are a convenience, not critical. Log for debugging.
    console.warn('Failed to load demo accounts:', e)
  }
})

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(email.value, password.value)
    const role = auth.userRole
    if (role === 'super_admin') {
      router.push('/admin')
    } else {
      router.push('/panel')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al iniciar sesión'
  } finally {
    loading.value = false
  }
}

function loginAs(account: { email: string; password: string; name: string; role: string }) {
  email.value = account.email
  password.value = account.password
  handleLogin()
}
</script>
