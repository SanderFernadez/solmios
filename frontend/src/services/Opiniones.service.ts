// services/Opiniones.service.ts
//
// El módulo backend expone `/api/opiniones` (CRUD). Este servicio pegaba a `/api/reviews`, que no
// existe: toda la página devolvía 404. Tampoco existen `/stats`, `/request` ni `/:id/respond`
// —responder es un PUT sobre la opinión—, así que esos métodos se fueron: nadie los usaba.
//
// Los campos son los del modelo `Reviews`: `comment` y `channel`. La interfaz declaraba `text`,
// `platform` y `respondedAt`, que no existen en la tabla. La página siempre usó los correctos.
// `guestName` no lo devuelve el backend (la opinión guarda `guestId`); la página cae en 'Anónimo'.

import { http } from './http'

export interface Review {
  id: string; hotelId: string; guestId: string; reservationId: string | null
  rating: number; title: string; comment: string
  response: string | null; date: string | null
  visible: number; channel: string; createdAt: string
  guestName?: string
}

export const OpinionesService = {
  list: (params?: Record<string, any>): Promise<Review[]> => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return http.get(`/api/opiniones${qs}`)
  },
  respond: (id: string, response: string): Promise<Review> => http.put(`/api/opiniones/${id}`, { response }),
}
