// services/Guarantee.service.ts — PIN de tarjeta de garantía del hotel (MisterPlan).
import { http } from './http'

export const GuaranteeService = {
  /** Setea/cambia el PIN del hotel (4-8 dígitos). Se guarda hasheado en el backend. */
  setPin: (pin: string) => http.post<{ success: boolean }>('/guarantee/pin', { pin }),
  /** Indica si el hotel ya tiene un PIN de garantía configurado. */
  hasPin: () => http.get<{ hasPin: boolean }>('/guarantee/has-pin'),
}
