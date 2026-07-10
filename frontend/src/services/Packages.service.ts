// services/Packages.service.ts — Ofertas: paquetes y servicios adicionales
import { http } from './http'

/** `combo` = paquete (habitación + extras). `servicio` = extra suelto que se vende aparte. */
export type OfferType = 'combo' | 'servicio'

export interface Offer {
  id?: string
  hotelId?: string
  name: string
  description?: string
  type?: OfferType
  price: number
  /** Qué incluye la oferta. El backend lo guarda como JSON. */
  contents?: string[]
  active?: number
}

interface Paginated {
  data: Offer[]
  total?: number
}

/**
 * Filas viejas traen `upsell` o `service` como tipo. Todo lo que no sea un combo es un servicio
 * suelto: así la pantalla no las esconde.
 */
export function offerType(raw?: string): OfferType {
  return raw === 'combo' ? 'combo' : 'servicio'
}

export const PackagesService = {
  list: (hotelId?: string) => http.get<Paginated>(`/paquetes${hotelId ? `?hotelId=${hotelId}` : ''}`),
  create: (data: Omit<Offer, 'id'>) => http.post<Offer>('/paquetes', data),
  update: (id: string, data: Partial<Offer>) => http.put<Offer>(`/paquetes/${id}`, data),
  remove: (id: string, hotelId?: string) =>
    http.delete<{ success: boolean }>(`/paquetes/${id}${hotelId ? `?hotelId=${hotelId}` : ''}`),
}
