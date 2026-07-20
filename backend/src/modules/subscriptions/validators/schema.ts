import type { ValidationRule } from 'arckode-framework'

/** Alta pública. Es la única ruta sin token que escribe: se valida fuerte. */
export const SignupSchema: Record<string, ValidationRule> = {
  hotelName: { type: 'string' as const, required: true, min: 2, max: 120 },
  email: { type: 'string' as const, required: true, max: 160 },
  password: { type: 'string' as const, required: true, min: 8, max: 100 },
  ownerName: { type: 'string' as const, max: 120 },
  phone: { type: 'string' as const, max: 40 },
  // `country` DEBE estar declarado acá: validateSchema devuelve únicamente los
  // campos del schema, así que un campo que el formulario manda pero el schema
  // no declara se pierde antes de llegar al usecase, sin error.
  country: { type: 'string' as const, max: 80 },
  address: { type: 'string' as const, max: 200 },
  planId: { type: 'string' as const, max: 60 },
}
