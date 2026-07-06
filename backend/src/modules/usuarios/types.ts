// usuarios/types.ts — DTOs de autenticación

// Roles disponibles en el sistema
export type UserRole = 'super_admin' | 'hotel_admin' | 'receptionist' | 'housekeeper' | 'supervisor' | 'maintenance'

// DTO interno — incluye campos sensibles. NUNCA exponer en responses HTTP.
export interface UsuarioDTO {
  id: string
  name: string
  email: string
  password: string       // campo interno, nunca exponer
  role: UserRole
  hotelId: string
  active: number         // 0 | 1
  token?: string         // JWT actual, nunca exponer
  resetToken?: string    // token de recuperación, nunca exponer
  resetExpires?: number  // expiración del reset token
  avatar?: string
  phone?: string
  createdAt: string
  updatedAt: string
}

// DTO público — sin campos sensibles. Usar en responses HTTP.
export interface UsuarioPublicDTO {
  id: string
  name: string
  email: string
  role: UserRole
  hotelId: string
  active: number
  avatar?: string
  phone?: string
  createdAt: string
}

export interface LoginDTO {
  email: string
  password: string
}

export interface CreateUsuarioDTO {
  name: string
  email: string
  password: string
  role?: UserRole
  hotelId?: string
  phone?: string
  avatar?: string
}

export interface UpdateUsuarioDTO {
  name?: string
  email?: string
  password?: string
  phone?: string
  avatar?: string
}

export interface ChangePasswordDTO {
  currentPassword: string
  newPassword: string
}

export interface AuthResponse {
  token: string
  user: {
    id: string
    nombre: string
    email: string
    role: UserRole
    hotelId: string
  }
}
