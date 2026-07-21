import { http } from './http'
import type { User, UserRole } from '@/types'

interface LoginResponse {
  token: string
  refreshToken: string
  user: {
    id: string
    name: string
    email: string
    role: string
    hotelId: string | null
    hotelName: string
  }
}

interface MeResponse {
  id: string
  name: string
  email: string
  role: string
  hotelId: string | null
  hotelName: string
  emailVerified?: boolean
}

function mapUser(raw: LoginResponse['user'] | MeResponse): User {
  const role = raw.role as UserRole
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role,
    hotelId: raw.hotelId || '',
    hotelName: raw.hotelName || '',
    // Solo /auth/me trae emailVerified; en login queda undefined (se resuelve al hidratar el perfil).
    emailVerified: 'emailVerified' in raw ? raw.emailVerified : undefined,
    permissions:
      role === 'super_admin'
        ? ['total', 'config', 'users', 'billing', 'support', 'analytics']
        : ['dashboard', 'reservations', 'rooms', 'guests'],
  }
}

export const AuthService = {
  async login(email: string, password: string): Promise<{ token: string; refreshToken: string; user: User }> {
    const data = await http.post<LoginResponse>('/auth/login', { email, password })
    return { token: data.token, refreshToken: data.refreshToken, user: mapUser(data.user) }
  },

  async me(): Promise<User> {
    const data = await http.get<MeResponse>('/auth/me')
    return mapUser(data)
  },

  async logout() {
    return http.post('/auth/logout')
  },

  /** Reenvía el correo de verificación al usuario autenticado. */
  async resendVerification(): Promise<{ sent: boolean }> {
    return http.post<{ sent: boolean }>('/auth/resend-verification')
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return http.post('/auth/change-password', { currentPassword, newPassword })
  },

  async forgotPassword(email: string) {
    return http.post('/auth/forgot-password', { email })
  },

  async resetPassword(token: string, newPassword: string) {
    return http.post('/auth/reset-password', { token, newPassword })
  },

  // PC-2 Multi-property
  async getHotels(): Promise<any[]> {
    const data = await http.get<{ data: any[] }>('/auth/hotels')
    return data.data || []
  },

  async switchHotel(hotelId: string): Promise<{ token: string; refreshToken: string; user: LoginResponse['user'] }> {
    const data = await http.post<{ token: string; refreshToken: string; user: LoginResponse['user'] }>(`/auth/switch-hotel/${hotelId}`)
    return data
  },

  async refresh(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    return http.post<{ token: string; refreshToken: string }>('/auth/refresh', { refreshToken })
  },
}
