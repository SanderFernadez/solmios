import type { ValidationRule } from 'arckode-framework'

const arrayType = 'array' as any
const objectType = 'object' as any

export const CreatePlanSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, required: true, min: 2, max: 100 },
  price: { type: 'number' as const, required: true, min: 0 },
  currency: { type: 'string' as const, min: 3, max: 3 },
  description: { type: 'string' as const, max: 500 },
  features: { type: arrayType },
  modules: { type: arrayType },
  limits: { type: objectType },
  isActive: { type: 'boolean' as const },
  sortOrder: { type: 'number' as const, min: 0 },
}

export const UpdatePlanSchema: Record<string, ValidationRule> = {
  name: { type: 'string' as const, min: 2, max: 100 },
  price: { type: 'number' as const, min: 0 },
  currency: { type: 'string' as const, min: 3, max: 3 },
  description: { type: 'string' as const, max: 500 },
  features: { type: arrayType },
  modules: { type: arrayType },
  limits: { type: objectType },
  isActive: { type: 'boolean' as const },
  sortOrder: { type: 'number' as const, min: 0 },
}

export const CreateAmenityCatalogSchema: Record<string, ValidationRule> = {
  key: { type: 'string' as const, required: true, min: 2, max: 80 },
  label: { type: 'string' as const, required: true, min: 2, max: 100 },
  category: { type: 'string' as const, max: 50 },
  icon: { type: 'string' as const, max: 50 },
  isActive: { type: 'boolean' as const },
  sortOrder: { type: 'number' as const, min: 0 },
}

export const UpdateAmenityCatalogSchema: Record<string, ValidationRule> = {
  key: { type: 'string' as const, min: 2, max: 80 },
  label: { type: 'string' as const, min: 2, max: 100 },
  category: { type: 'string' as const, max: 50 },
  icon: { type: 'string' as const, max: 50 },
  isActive: { type: 'boolean' as const },
  sortOrder: { type: 'number' as const, min: 0 },
}

export const AdminValidator = {
  createPlan: CreatePlanSchema,
  updatePlan: UpdatePlanSchema,
  createAmenityCatalog: CreateAmenityCatalogSchema,
  updateAmenityCatalog: UpdateAmenityCatalogSchema,
}
