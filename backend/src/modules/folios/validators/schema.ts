// folios/validators/schema.ts — Validación de entrada
import type { ValidationRule } from 'arckode-framework'

export const OpenFolioSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const },
  reservationId: { type: 'string' as const },
  guestId: { type: 'string' as const },
  roomId: { type: 'string' as const },
  currency: { type: 'string' as const },
}

export const PostChargeSchema: Record<string, ValidationRule> = {
  description: { type: 'string' as const, required: true },
  amount: { type: 'number' as const, required: true },
  category: { type: 'string' as const },
  quantity: { type: 'number' as const },
  source: { type: 'string' as const },
  // Idempotency key externa ('pos:' + orderId, idempotencia-settlement-pos). Sin declararla acá,
  // validateSchema (allow-list) la descarta en silencio para cualquier caller HTTP directo.
  reference: { type: 'string' as const },
}

export const ApplyPaymentSchema: Record<string, ValidationRule> = {
  amount: { type: 'number' as const, required: true },
  method: { type: 'string' as const },
  reference: { type: 'string' as const },
}

export const FoliosValidator = { open: OpenFolioSchema, charge: PostChargeSchema, payment: ApplyPaymentSchema }
