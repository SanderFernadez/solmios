import { http } from './http'
import type { Reservation, ReservationStatus, ReservationSource, ReservationDetail, GuaranteeCardData, AuditLogEntry } from '@/types'

interface RawReservation {
  id: string
  hotelId: string
  guestId: string | null
  roomId: string | null
  checkIn: string
  checkOut: string
  channel: string
  totalAmount: number
  status: string
  adults?: number
  children?: number
  currency?: string
  deposit?: number
  autoSendEnabled?: boolean
  gdprAccepted?: boolean
  marketingAccepted?: boolean
  termsAccepted?: boolean
  otherCharges?: number
  roomNumber?: string
  roomType?: string
  guestName?: string
  guestEmail?: string
}

const STATUS_MAP: Record<string, ReservationStatus> = {
  pendiente: 'pending', pending: 'pending',
  confirmada: 'confirmed', confirmed: 'confirmed',
  check_in: 'checked_in', 'checked-in': 'checked_in', checked_in: 'checked_in', checkin: 'checked_in',
  check_out: 'checked_out', 'checked-out': 'checked_out', checked_out: 'checked_out', checkout: 'checked_out',
  cancelada: 'cancelled', cancelled: 'cancelled', canceled: 'cancelled',
}

const SOURCE_MAP: Record<string, ReservationSource> = {
  direct: 'direct', directa: 'direct',
  phone: 'phone',
  whatsapp: 'whatsapp',
  booking: 'booking', 'booking.com': 'booking',
  expedia: 'expedia',
  agoda: 'agoda',
  airbnb: 'airbnb',
  google: 'google',
  other: 'other',
}

export function mapReservation(r: RawReservation): Reservation {
  const status = STATUS_MAP[r.status?.toLowerCase()] ?? 'pending'
  return {
    id: r.id,
    hotelId: r.hotelId,
    guestId: r.guestId || '',
    roomId: r.roomId || '',
    checkIn: r.checkIn as unknown as Date,
    checkOut: r.checkOut as unknown as Date,
    adults: r.adults ?? 2,
    children: r.children ?? 0,
    status,
    source: SOURCE_MAP[r.channel?.toLowerCase()] ?? 'other',
    totalAmount: r.totalAmount,
    depositAmount: r.deposit ?? 0,
    paymentStatus: (r.deposit ?? 0) >= r.totalAmount ? 'paid' : (r.deposit ?? 0) > 0 ? 'partial' : 'pending',
    roomNumber: r.roomNumber,
    roomType: r.roomType,
    guestName: r.guestName,
    guestEmail: r.guestEmail,
  } as Reservation
}

interface ReservationsResponse {
  data: RawReservation[]
  total: number
}

export const ReservationService = {
  async list(params?: { hotelId?: string; status?: string; limit?: number; guestId?: string }): Promise<{ reservations: Reservation[]; total: number }> {
    const qs = new URLSearchParams()
    if (params?.hotelId) qs.set('hotelId', params.hotelId)
    if (params?.status) qs.set('status', params.status)
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.guestId) qs.set('guestId', params.guestId)
    const query = qs.toString()
    const data = await http.get<ReservationsResponse>(`/reservas${query ? `?${query}` : ''}`)
    return { reservations: data.data.map(mapReservation), total: data.total }
  },

  async create(input: {
    hotelId: string
    roomId: string
    guestId?: string
    checkIn: string
    checkOut: string
    channel?: string
    source?: string
    totalAmount: number
    status?: string
    deposit?: number
    depositPercentage?: number
    depositStatus?: string
    paymentMethod?: string
    adults?: number
    children?: number
    notes?: string
    ownerNotes?: string
    commission?: number
    commissionAmount?: number
    externalLocator?: string
    otaNotes?: string
    regime?: string
    promoCode?: string
    autoSendEnabled?: boolean
    emergencyContact?: { name: string; phone: string; relation: string; email?: string }
    creditCard?: { holderName: string; brand: string; number: string; cvv: string; expMonth: string; expYear: string }
  }): Promise<Reservation> {
    const data = await http.post<RawReservation>('/reservas', input)
    return mapReservation(data)
  },

  async update(id: string, patch: Partial<RawReservation>): Promise<Reservation> {
    const data = await http.put<RawReservation>(`/reservas/${id}`, patch)
    return mapReservation(data)
  },

  /**
   * Detalle extendido: reserva + guest + room + companions + lockCodes + payments + messageLogs.
   * Usa /reservations/:id (handler enriquecido en composition-root) — DISTINTO del CRUD del módulo
   * (/reservas). No es inconsistencia: son dos endpoints con propósito distinto — list/create/update
   * usan el módulo estándar; el detalle usa el handler con joins cross-module.
   */
  async getById(id: string): Promise<ReservationDetail> {
    return http.get<ReservationDetail>(`/reservations/${id}`)
  },

  /** Tarjeta de garantía: revela los datos parciales tras validar el PIN del hotel (MisterPlan). */
  async unlockGuaranteeCard(id: string, pin: string): Promise<GuaranteeCardData> {
    return http.post<GuaranteeCardData>(`/reservations/${id}/guarantee-card/unlock`, { pin })
  },

  /** Historial de cambios (audit trail) de una reserva. */
  async getAudit(id: string): Promise<{ data: AuditLogEntry[] }> {
    return http.get<{ data: AuditLogEntry[] }>(`/reservations/${id}/audit`)
  },

  /** Check-in real: reserva → checked_in + habitación occupied + folio abierto + huésped. */
  async checkin(id: string): Promise<{ folioId: string; guestId: string }> {
    const data = await http.post<{ ok: boolean; folioId: string; guestId: string }>(`/reservas/${id}/checkin`, {})
    return { folioId: data.folioId, guestId: data.guestId }
  },

  /** Check-out real: reserva → checked_out + habitación cleaning + tarea de limpieza.
   * Opcionalmente cierra folio, genera factura y registra pago. */
  async checkout(id: string, settle?: { method: string; amount: number; reference?: string } | null): Promise<{ settlement?: { folioId: string; invoiceId: string | null; balance: number; amountPaid: number; invoiceNumber: string | null } }> {
    return http.post(`/reservas/${id}/checkout`, { settle })
  },

  /** Elimina una reserva (la UI lo limita a pendientes/canceladas). */
  async remove(id: string): Promise<void> {
    await http.delete(`/reservas/${id}`)
  },
}
