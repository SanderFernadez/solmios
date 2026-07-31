import { http } from './http'

/** Código de descuento aplicable en el widget público de reservas.
 *  API: `/api/promo-codes` (admin, auth) — el guest los aplica vía
 *  `POST /api/public/hotels/:slug/promo/validate` (sin auth, ver bookingengine/usecases). */
export interface PromoCode {
  id: string
  hotelId?: string
  /** Se normaliza a MAYÚSCULAS en el backend al crear/editar. */
  code: string
  kind: 'percent' | 'fixed'
  /** Porcentaje (0-100) si kind='percent'; monto fijo en la moneda del hotel si kind='fixed'. */
  value: number
  /** Subtotal mínimo requerido para aplicar. null/undefined = sin mínimo. */
  minAmount?: number | null
  /** Cantidad máxima de usos. null/undefined = ilimitado. */
  maxUses?: number | null
  /** Usos actuales — el backend lo incrementa al crear una reserva con el código aplicado. */
  uses?: number
  /** ISO date (yyyy-mm-dd). null/undefined = sin ventana de inicio. */
  validFrom?: string | null
  /** ISO date (yyyy-mm-dd). null/undefined = sin vencimiento. */
  validTo?: string | null
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

export type CreatePromoCodeInput = Omit<PromoCode, 'id' | 'uses' | 'createdAt' | 'updatedAt'>
export type UpdatePromoCodeInput = Partial<CreatePromoCodeInput> & { uses?: number }

export interface PromoValidationResult {
  valid: boolean
  discount: number
  reason?: string
  code?: string
}

const BASE = '/promo-codes'

function toList(res: unknown): PromoCode[] {
  if (Array.isArray(res)) return res as PromoCode[]
  const data = (res as { data?: unknown } | null)?.data
  return Array.isArray(data) ? (data as PromoCode[]) : []
}

export const PromoCodeService = {
  async list(): Promise<PromoCode[]> {
    const res = await http.get<unknown>(BASE)
    return toList(res)
  },

  create(input: CreatePromoCodeInput): Promise<PromoCode> {
    return http.post<PromoCode>(BASE, input)
  },

  update(id: string, input: UpdatePromoCodeInput): Promise<PromoCode> {
    return http.put<PromoCode>(`${BASE}/${id}`, input)
  },

  remove(id: string): Promise<void> {
    return http.delete<void>(`${BASE}/${id}`)
  },

  /** Preview autenticado (staff, reserva manual) — hotelId sale del token. Sin permiso `promo:view`. */
  preview(code: string, subtotal: number): Promise<PromoValidationResult> {
    return http.post<PromoValidationResult>(`${BASE}/preview`, { code, subtotal })
  },
}
