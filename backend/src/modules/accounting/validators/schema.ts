import type { BodyRule as ValidationRule } from '../../../shared/validators/validate-body'

// validateSchema devuelve SOLO los campos declarados acá (los demás se descartan en silencio).
const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense']

export const CreateAccountSchema: Record<string, ValidationRule> = {
  // hotelId opcional en el body: el service lo fuerza desde el JWT (solo super_admin lo usa).
  hotelId: { type: 'string' as const },
  code: { type: 'string' as const, required: true },
  name: { type: 'string' as const, required: true },
  type: { type: 'string' as const, required: true, enum: ACCOUNT_TYPES },
  parentId: { type: 'string' as const },
  isPostable: { type: 'number' as const },
  active: { type: 'number' as const },
}

export const UpdateAccountSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const },
  type: { type: 'string' as const, enum: ACCOUNT_TYPES },
  parentId: { type: 'string' as const },
  isPostable: { type: 'number' as const },
  active: { type: 'number' as const },
}

// Asiento manual: solo los campos escalares (validateSchema no soporta arrays → `lines` se
// valida en el usecase journal-entry, igual que los permisos de roles, mem 1805).
export const CreateJournalEntrySchema: Record<string, ValidationRule> = {
  entryDate: { type: 'string' as const, required: true },
  description: { type: 'text' as const },
  reference: { type: 'string' as const },
}

export const AccountingValidator = { create: CreateAccountSchema, update: UpdateAccountSchema }
