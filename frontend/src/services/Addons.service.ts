// services/Addons.service.ts — Otros servicios y descuentos por reserva (F3 match-misterplan).
import { http } from './http'
import type { ReservationDetailAddon } from '@/types'

export const AddonsService = {
  list: (reservationId: string) =>
    http.get<{ data: ReservationDetailAddon[] }>(`/reservations/${reservationId}/addons`),
  create: (reservationId: string, data: { description: string; kind?: 'service' | 'discount'; amount?: number; quantity?: number }) =>
    http.post<ReservationDetailAddon>(`/reservations/${reservationId}/addons`, data),
  remove: (id: string) =>
    http.delete<{ success: boolean }>(`/addons/${id}`),
}
