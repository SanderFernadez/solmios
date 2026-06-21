// usuarios/types.ts — DTOs de autenticación

// DTO interno — incluye passwordHash para operaciones de autenticación.
// NUNCA exponer este DTO directamente en responses HTTP.
export interface UsuarioDTO {
  id: string
    name: string
  email: string
  passwordHash: string  // campo interno, nunca exponer en response
  rol: 'admin' | 'usuario'
    active: boolean
  emailVerificado: boolean
  ultimoAcceso?: string
  createdAt: string
  updatedAt: string
}

// DTO público — sin passwordHash. Usar este en responses HTTP.
export interface UsuarioPublicDTO {
  id: string
    name: string
  email: string
  rol: 'admin' | 'usuario'
    active: boolean
  emailVerificado: boolean
  ultimoAcceso?: string
  createdAt: string
}

export interface LoginDTO {
  email: string
  password: string
}

export interface RegisterDTO {
    name: string
  email: string
  password: string
  passwordConfirm: string
}

export interface AuthResponse {
  usuario: UsuarioPublicDTO
  token: string
}

export interface ChangePasswordDTO {
  passwordActual: string
  passwordNuevo: string
}
