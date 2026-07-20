import type { ValidationRule } from 'arckode-framework'
import { PASSWORD_MIN, PASSWORD_MAX } from '../../../shared/password-policy'
import { EMAIL_MAX } from '../../../shared/email'

// Los `max` de acá son el tope duro de entrada: recortan antes de tocar la base
// y deben coincidir con los `maxlength` del formulario (pages/auth/register.vue).
// El formulario evita que se escriba de más; esto evita que alguien lo saltee.
//
// La fuerza de la contraseña NO se valida acá: `min` solo mide largo y el
// mensaje de error del framework es genérico. La revisa el usecase con
// shared/password-policy, que devuelve los motivos concretos en español.
export const SignupSchema: Record<string, ValidationRule> = {
  hotelName: { type: 'string' as const, required: true, min: 2, max: 120 },
  // `email` y no `string`: como string, "a@" pasaba la validación.
  email: { type: 'email' as const, required: true, max: EMAIL_MAX },
  password: { type: 'string' as const, required: true, min: PASSWORD_MIN, max: PASSWORD_MAX },
  ownerName: { type: 'string' as const, max: 120 },
  phone: { type: 'string' as const, max: 40 },
  // `country` DEBE estar declarado acá: validateSchema devuelve únicamente los
  // campos del schema, así que un campo que el formulario manda pero el schema
  // no declara se pierde antes de llegar al usecase, sin error.
  country: { type: 'string' as const, max: 80 },
  address: { type: 'string' as const, max: 200 },
  planId: { type: 'string' as const, max: 60 },
  // Token del captcha (Cloudflare Turnstile). Opcional en el schema porque el
  // backend solo lo exige cuando hay secret configurado; lo verifica el
  // controller antes de crear nada.
  captchaToken: { type: 'string' as const, max: 4096 },
}
