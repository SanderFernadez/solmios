// validators/schema.ts — StaffAuth
import { z } from 'zod'

export const PinLoginSchema = z.object({
  phone: z.string().min(8, 'Teléfono requerido'),
  pin: z.string().length(6, 'PIN debe tener 6 dígitos'),
})

export const PinSetSchema = z.object({
  userId: z.string().min(1, 'userId requerido'),
  pin: z.string().length(6, 'PIN debe tener 6 dígitos'),
})
