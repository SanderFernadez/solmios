import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserRole } from '@/types'
import { AuthService } from '@/services/Auth.service'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const loading = ref(false)
  const impersonating = ref(false)
  const originalUser = ref<User | null>(null)

  const isAuthenticated = computed(() => !!token.value)
  const userRole = computed(() => user.value?.role ?? null)
  const isSuperAdmin = computed(() => user.value?.role === 'super_admin')
  const isHotelAdmin = computed(() => user.value?.role === 'hotel_admin')
  const isReceptionist = computed(() => user.value?.role === 'receptionist')
  const canAccessSuperAdmin = computed(() => user.value?.role === 'super_admin' && !impersonating.value)
  const currentHotel = computed(() => user.value?.hotelName ?? '')

  async function login(email: string, password: string) {
    loading.value = true
    try {
      const { token: tkn, user: usr } = await AuthService.login(email, password)
      token.value = tkn
      user.value = usr
      localStorage.setItem('token', tkn)
      localStorage.setItem('user', JSON.stringify(usr))
    } finally {
      loading.value = false
    }
  }

  async function restoreSession() {
    if (!token.value) return
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        user.value = JSON.parse(savedUser)
      } catch {
        logout()
        return
      }
    }
    try {
      user.value = await AuthService.me()
      localStorage.setItem('user', JSON.stringify(user.value))
    } catch {
      // token invalid — keep cached user but don't force logout on transient errors
    }
  }

  function loginAs(targetUser: User) {
    if (!isSuperAdmin.value) return
    originalUser.value = { ...user.value! }
    impersonating.value = true
    user.value = { ...targetUser }
  }

  function stopImpersonation() {
    if (!impersonating.value || !originalUser.value) return
    user.value = { ...originalUser.value }
    originalUser.value = null
    impersonating.value = false
  }

  async function logout() {
    try {
      await AuthService.logout()
    } catch {
      // ignore — clear local state regardless
    }
    token.value = null
    user.value = null
    originalUser.value = null
    impersonating.value = false
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return {
    user, token, loading, impersonating,
    isAuthenticated, userRole, isSuperAdmin, isHotelAdmin, isReceptionist,
    canAccessSuperAdmin, currentHotel,
    login, loginAs, stopImpersonation, logout, restoreSession
  }
})
