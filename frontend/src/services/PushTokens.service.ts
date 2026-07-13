import { http } from './http'
import type { PushToken, RegisterPushTokenPayload } from '@/types'

/**
 * Espeja backend/src/modules/pushtokens/index.ts.
 * - GET (list): tokens del hotel del usuario (solo hotel_admin/super_admin, filtrado por hotelId).
 * - POST/DELETE: sobre el token del dispositivo actual (el dueño sale del JWT, nunca de query/body).
 */
export const PushTokensService = {
  /** Lista los tokens registrados del hotel (multi-tenant por hotelId en el backend). */
  list: () => http.get<PushToken[]>('/push-tokens'),

  /** Registra (o transfiere de dueño) el token de push de este dispositivo. */
  register: (data: RegisterPushTokenPayload) => http.post<PushToken>('/push-tokens', data),

  /** Da de baja un token. El backend solo borra si pertenece al usuario autenticado. */
  unregister: (token: string) => http.delete<{ message: string }>('/push-tokens', { token }),
}
