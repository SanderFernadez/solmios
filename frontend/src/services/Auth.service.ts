import { http } from './http'
import type { User, UserRole } from '@/types'

interface LoginResponse {
  token: string
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
    permissions:
      role === 'super_admin'
        ? ['total', 'config', 'users', 'billing', 'support', 'analytics']
        : ['dashboard', 'reservations', 'rooms', 'guests'],
  }
}

export const AuthService = {
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const data = await http.post<LoginResponse>('/auth/login', { email, password })
    return { token: data.token, user: mapUser(data.user) }
  },

  async me(): Promise<User> {
    const data = await http.get<MeResponse>('/auth/me')
    return mapUser(data)
  },

  async logout() {
    return http.post('/auth/logout')
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
}
