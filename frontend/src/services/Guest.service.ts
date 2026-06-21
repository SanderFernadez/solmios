import { http } from './http'
import type { Guest } from '@/types'

interface RawGuest {
  id: string
  hotelId: string
  name: string
  email?: string
  phone?: string
  telefono?: string
  document?: string
  documentType?: string
  tipoDocumento?: string
  nationality?: string
  nacionalidad?: string
  totalStays?: number
  totalEstancias?: number
  totalSpent?: number
  totalGastado?: number
  loyaltyPoints?: number
  puntos?: number
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export function mapGuest(g: RawGuest): Guest {
  const fullName = g.name || ''
  const { first, last } = splitName(fullName)
  return {
    id: g.id,
    hotelId: g.hotelId,
    firstName: first,
    lastName: last,
    name: fullName,
    email: g.email,
    phone: g.phone || g.telefono,
    documentType: g.documentType || g.tipoDocumento || '',
    documentNumber: g.document || '',
    nationality: g.nationality || g.nacionalidad || '',
    totalStays: g.totalStays ?? g.totalEstancias ?? 0,
    totalSpent: g.totalSpent ?? g.totalGastado ?? 0,
    loyaltyPoints: g.loyaltyPoints ?? g.puntos ?? 0,
  } as Guest
}

interface GuestsResponse {
  data: RawGuest[]
  total: number
}

export const GuestService = {
  async list(params?: { hotelId?: string; search?: string }): Promise<{ guests: Guest[]; total: number }> {
    const qs = new URLSearchParams()
    if (params?.hotelId) qs.set('hotelId', params.hotelId)
    if (params?.search) qs.set('search', params.search)
    const query = qs.toString()
    const data = await http.get<GuestsResponse>(`/huespedes${query ? `?${query}` : ''}`)
    return { guests: data.data.map(mapGuest), total: data.total }
  },

  async create(guest: Partial<RawGuest>): Promise<RawGuest> {
    return http.post('/huespedes', guest)
  },

  async update(id: string, guest: Partial<RawGuest>): Promise<RawGuest> {
    return http.put(`/huespedes/${id}`, guest)
  },

  async delete(id: string, hotelId?: string): Promise<void> {
    return http.delete(`/huespedes/${id}${hotelId ? `?hotelId=${hotelId}` : ''}`)
  },
}
