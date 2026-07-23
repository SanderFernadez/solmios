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

export const CreateBankAccountSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const },
  name: { type: 'string' as const, required: true },
  bank: { type: 'string' as const },
  accountNumber: { type: 'string' as const },
  currency: { type: 'string' as const },
  type: { type: 'string' as const, enum: ['checking', 'savings', 'cash'] },
  openingBalance: { type: 'number' as const },
  accountId: { type: 'string' as const },
}
export const UpdateBankAccountSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const },
  bank: { type: 'string' as const },
  accountNumber: { type: 'string' as const },
  active: { type: 'number' as const },
  accountId: { type: 'string' as const },
}
export const CreateBudgetSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const },
  period: { type: 'string' as const, required: true },
  category: { type: 'string' as const, required: true },
  budgetedAmount: { type: 'number' as const, min: 0 },
  notes: { type: 'text' as const },
}
export const UpdateBudgetSchema: Record<string, ValidationRule> = {
  budgetedAmount: { type: 'number' as const, min: 0 },
  notes: { type: 'text' as const },
}

export const TreasuryValidator = { create: CreateSupplierSchema, update: UpdateSupplierSchema }
