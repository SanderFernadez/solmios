import { http } from './http'
import type { PushToken, RegisterPushTokenPayload } from '@/types'

/**
 * Espeja backend/src/modules/pushtokens/index.ts.
 * Solo 2 endpoints registrados, ambos sobre el token del dispositivo actual
 * (el dueño sale del JWT, nunca de query/body): no existe un GET de listado
 * en el backend — por eso el módulo no puede enumerar tokens de terceros.
 */
export const PushTokensService = {
  /** Registra (o transfiere de dueño) el token de push de este dispositivo. */
  register: (data: RegisterPushTokenPayload) => http.post<PushToken>('/push-tokens', data),

  /** Da de baja un token. El backend solo borra si pertenece al usuario autenticado. */
  unregister: (token: string) => http.delete<{ message: string }>('/push-tokens', { token }),
}
