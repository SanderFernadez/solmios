<template>
  <div class="relative" ref="menuRef">
    <!-- Trigger: avatar + nombre + chevron -->
    <button
      type="button"
      @click="open = !open"
      class="flex items-center gap-2 bg-surface rounded-lg pl-1.5 pr-2.5 py-1.5 border border-border hover:bg-surface-dark transition-colors cursor-pointer"
      :class="{ 'ring-2 ring-cyan/30': open }"
      aria-haspopup="menu"
      :aria-expanded="open"
    >
      <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" :class="avatarClass">
        {{ initials }}
      </div>
      <div class="hidden sm:block text-left leading-tight">
        <div class="text-xs font-bold text-navy max-w-[120px] truncate">{{ name }}</div>
        <div class="text-[10px] text-text-muted">{{ roleLabel }}</div>
      </div>
      <svg class="w-4 h-4 text-text-muted transition-transform" :class="{ 'rotate-180': open }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown -->
    <div
      v-if="open"
      role="menu"
      class="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-border overflow-hidden z-50"
    >
      <!-- Info usuario -->
      <div class="px-4 py-3 border-b border-border bg-surface">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" :class="avatarClass">
            {{ initials }}
          </div>
          <div class="min-w-0">
            <div class="text-sm font-bold text-navy truncate">{{ name }}</div>
            <div class="text-[11px] text-text-muted truncate">{{ email }}</div>
          </div>
        </div>
      </div>

      <!-- Opciones -->
      <div class="py-1.5">
        <router-link
          v-for="opt in options"
          :key="opt.path"
          :to="opt.path"
          @click="open = false"
          role="menuitem"
          class="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-navy hover:bg-surface transition-colors cursor-pointer"
        >
          <span class="text-base">{{ opt.icon }}</span>
          <span>{{ opt.label }}</span>
        </router-link>
      </div>

      <!-- Separador + Salir -->
      <div class="border-t border-border py-1.5">
        <button
          type="button"
          @click="logout"
          role="menuitem"
          class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-coral hover:bg-coral/5 transition-colors cursor-pointer"
        >
          <span class="text-base">🚪</span>
          <span>Salir</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()

const open = ref(false)
const menuRef = ref<HTMLElement | null>(null)

const name = computed(() => auth.user?.name ?? 'Usuario')
const email = computed(() => auth.user?.email ?? '')
const initials = computed(() =>
  name.value.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
)

const ROLE_LABELS: Record<string, string> = {
  hotel_admin: 'Hotel Admin',
  receptionist: 'Recepción',
  super_admin: 'Super Admin',
}
const roleLabel = computed(() => ROLE_LABELS[auth.userRole ?? ''] ?? '')

const avatarClass = computed(() => {
  const classes: Record<string, string> = {
    hotel_admin: 'bg-cyan/30 text-white',
    receptionist: 'bg-teal/30 text-white',
    super_admin: 'bg-coral/30 text-white',
  }
  return classes[auth.userRole ?? ''] ?? 'bg-cyan/30 text-white'
})

// Opciones del menú. super_admin usa la ruta de super-admin, el resto la del panel.
const options = computed(() => {
  const isSuperAdmin = auth.userRole === 'super_admin'
  return [
    { icon: '⚙️', label: 'Configuración', path: isSuperAdmin ? '/admin/settings' : '/panel/settings' },
    { icon: '🔑', label: 'Cambiar contraseña', path: '/change-password' },
  ]
})

// Cerrar al clickear fuera
function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))

// Cerrar con Escape
function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
onMounted(() => document.addEventListener('keydown', handleEsc))
onUnmounted(() => document.removeEventListener('keydown', handleEsc))

async function logout() {
  open.value = false
  await auth.logout()
  router.push('/login')
}
</script>

<style scoped>
</style>
