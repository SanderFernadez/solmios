// usuarios/validators/schema.ts — Validación de entrada
import type { ValidationRule } from 'arckode-framework'

export const CreateUsuarioSchema: Record<string, ValidationRule> = {
    name: { type: 'string', required: true, min: 2, max: 100 },
  email: { type: 'string', required: true, min: 5, max: 200 },
  password: { type: 'string', required: true, min: 6, max: 100 },
  role: { type: 'string' },
  hotelId: { type: 'string' },
    phone: { type: 'string' },
}

export const UpdateUsuarioSchema: Record<string, ValidationRule> = {
    name: { type: 'string', min: 2, max: 100 },
  email: { type: 'string', min: 5, max: 200 },
  password: { type: 'string', min: 6, max: 100 },
  role: { type: 'string' },
    phone: { type: 'string' },
    active: { type: 'number' },
}

export const UsuarioValidator = { create: CreateUsuarioSchema, update: UpdateUsuarioSchema }

export const LoginSchema: Record<string, ValidationRule> = {
  email: { type: 'string' as const, required: true },
  password: { type: 'string' as const, required: true },
}

export const ChangePasswordSchema: Record<string, ValidationRule> = {
  currentPassword: { type: 'string' as const, required: true },
  newPassword: { type: 'string' as const, required: true, min: 6 },
}

export const ForgotPasswordSchema: Record<string, ValidationRule> = {
  email: { type: 'string' as const, required: true },
}

export const ResetPasswordSchema: Record<string, ValidationRule> = {
  token: { type: 'string' as const, required: true },
  newPassword: { type: 'string' as const, required: true, min: 6 },
}
