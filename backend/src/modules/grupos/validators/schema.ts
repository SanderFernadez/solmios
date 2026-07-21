// grupos/validators/schema.ts — Validación de entrada

import type { BodyRule as ValidationRule } from '../../../shared/validators/validate-body'

// #392: totalRooms/totalAmount eran number sin cota → aceptaban negativos y absurdos que se
// arrastran a los agregados del grupo. min:0 corta lo negativo; el tope alto evita cifras delirantes
// sin estorbar a un grupo grande legítimo.
export const CreateGruposSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
    name: { type: 'string' as const, required: true, min: 2, max: 200 },
    leadGuestId: { type: 'string' as const },
    totalRooms: { type: 'number' as const, min: 0, max: 100_000 },
  checkIn: { type: 'string' as const },
  checkOut: { type: 'string' as const },
    status: { type: 'string' as const },
    totalAmount: { type: 'number' as const, min: 0 },
    notes: { type: 'text' as const },
}

export const UpdateGruposSchema: Record<string, ValidationRule> = {
    name: { type: 'string' as const, min: 2, max: 200 },
    leadGuestId: { type: 'string' as const },
    totalRooms: { type: 'number' as const, min: 0, max: 100_000 },
  checkIn: { type: 'string' as const },
  checkOut: { type: 'string' as const },
    status: { type: 'string' as const },
    totalAmount: { type: 'number' as const, min: 0 },
    notes: { type: 'text' as const },
}

export const GruposValidator = {
  create: CreateGruposSchema,
  update: UpdateGruposSchema,
}
