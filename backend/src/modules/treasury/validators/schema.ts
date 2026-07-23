import type { BodyRule as ValidationRule } from '../../../shared/validators/validate-body'

export const CreateSupplierSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const },
  name: { type: 'string' as const, required: true },
  taxId: { type: 'string' as const },
  contact: { type: 'string' as const },
  email: { type: 'string' as const },
  phone: { type: 'string' as const },
  active: { type: 'number' as const },
}

export const UpdateSupplierSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const },
  taxId: { type: 'string' as const },
  contact: { type: 'string' as const },
  email: { type: 'string' as const },
  phone: { type: 'string' as const },
  active: { type: 'number' as const },
}

export const TreasuryValidator = { create: CreateSupplierSchema, update: UpdateSupplierSchema }
