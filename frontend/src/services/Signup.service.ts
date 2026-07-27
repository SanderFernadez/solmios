import { http } from './http'

/** Plan tal como lo ve alguien que todavía no es cliente. */
export interface PublicPlan {
  id: string
  name: string
  slug: string
  price: number
  currency: string
  description: string
  features: string[]
}

export interface SignupPayload {
  hotelName: string
  email: string
  password: string
  ownerName?: string
  country?: string
  address?: string
  phone?: string
  planId?: string
  /** Código de referido (`?ref=` en la URL, ver `/r/:code`). */
  referralCode?: string
  /** Token del captcha (Turnstile). Solo si el build tiene site key. */
  captchaToken?: string
}

export interface SignupResult {
  hotelId: string
  userId: string
  trialEndsAt: string
  trialDays: number
}

/** Estado de la suscripción del hotel logueado. */
export interface MySubscription {
  status: string
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  planId: string
  allowed: boolean
  reason: string | null
  daysLeft: number | null
  /** Ya pagó al menos una vez (tiene Customer de Stripe) → puede abrir el Billing Portal. */
  hasStripeCustomer: boolean
  /** Categoría especial activa (Fundador Uno/Dos, Pionero), si tiene. */
  specialCategory?: 'founder_one' | 'founder_two' | 'pioneer' | null
  /** % de descuento activo (manual o de categoría), si tiene. */
  activeDiscountPct?: number | null
}

/**
 * Rutas públicas del alta. `http` desenvuelve `{success,data}`; estas responden
 * `{data:…}` anidado, así que se normaliza acá en vez de repetirlo en la vista.
 */
function unwrap<T>(res: any): T {
  return (res?.data ?? res) as T
}

export const SignupService = {
  async publicPlans(): Promise<PublicPlan[]> {
    const res = await http.get<any>('/public/plans')
    const list = unwrap<any>(res)
    return Array.isArray(list) ? list : []
  },

  async signup(payload: SignupPayload): Promise<SignupResult> {
    const res = await http.post<any>('/public/signup', payload)
    return unwrap<SignupResult>(res)
  },

  async mySubscription(): Promise<MySubscription> {
    const res = await http.get<any>('/subscription/me')
    return unwrap<MySubscription>(res)
  },
}
