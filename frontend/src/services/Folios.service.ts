import { http } from './http'

export interface FolioCharge {
  id: string
  description: string | null
  category: string
  kind: 'charge' | 'payment'
  quantity: number
  amount: number
  taxes: number
  total: number
  source: string
  postedAt: string | null
}

export interface Folio {
  id: string
  hotelId: string
  reservationId: string | null
  guestId: string | null
  roomId: string | null
  status: 'open' | 'closed' | 'void'
  currency: string
  invoiceId: string | null
  openedAt: string | null
  closedAt: string | null
  guestName?: string
  roomNumber?: string
  chargesTotal?: number
  paymentsTotal?: number
  balance?: number
  chargeCount?: number
  charges?: FolioCharge[]
}

interface FolioResponse { data: Folio[]; total: number }

export const FoliosService = {
  async list(hotelId?: string, status?: string): Promise<Folio[]> {
    const params = new URLSearchParams()
    if (hotelId) params.set('hotelId', hotelId)
    if (status) params.set('status', status)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const res = await http.get<FolioResponse>(`/folios${qs}`)
    return res.data ?? []
  },

  async get(id: string): Promise<Folio> {
    return http.get<Folio>(`/folios/${id}`)
  },

  async open(data: { hotelId?: string; reservationId?: string; guestId?: string; roomId?: string }): Promise<Folio> {
    return http.post('/folios', data)
  },

  async charge(id: string, data: { description: string; amount: number; category?: string; quantity?: number }): Promise<FolioCharge> {
    return http.post(`/folios/${id}/charges`, data)
  },

  async pay(id: string, data: { amount: number; method?: string; reference?: string }): Promise<FolioCharge> {
    return http.post(`/folios/${id}/payments`, data)
  },

  /** Cierra el folio y genera la factura (con NCF). */
  async closeAndInvoice(id: string): Promise<{ folio: Folio; invoice: any }> {
    return http.post(`/folios/${id}/invoice`, {})
  },
}
