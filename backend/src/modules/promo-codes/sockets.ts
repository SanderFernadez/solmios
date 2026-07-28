// promo-codes/sockets.ts — Hooks OPCIONALES hacia otros módulos (F2 booking-widget).
// El módulo no emite eventos críticos hoy. Si un conector futuro necesita reaccionar
// (ej. invalidar cache pública de "códigos vigentes" al crear/editar), se engancha acá.
import type { PromoCodeDTO } from './types'

export interface PromoCodesSockets {
  onPromoCodeCreated?: (promo: PromoCodeDTO) => Promise<void>
  onPromoCodeUpdated?: (promo: PromoCodeDTO) => Promise<void>
  onPromoCodeDeleted?: (id: string, hotelId: string) => Promise<void>
}
