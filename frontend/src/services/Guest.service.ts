import { http } from './http'
import type { Guest } from '@/types'

// RawGuest espejea el naming canónico del modelo DB `guests` (backend huespedes/model.ts).
// Sin dobles (firstName/lastName, documentNumber, dateOfBirth, observations, *_es): un solo naming.
interface RawGuest {
  id: string
  hotelId: string
  name: string
  email?: string
  phone?: string
  document?: string
  documentType?: string
  documentIssueDate?: string
  nationality?: string
  language?: string
  country?: string
  sex?: string
  address?: string
  city?: string
  province?: string
  communicateClient?: string
  totalStays?: number
  totalSpent?: number
  loyaltyPoints?: number
  birthDate?: string
  preferences?: string[] | string
  notes?: string
  tier?: string
  profession?: string
  emergencyContact?: string | object
}

// preferences se persiste como JSON (array). Normaliza string→array para que la UI siempre reciba string[].
function normalizePreferences(p: string[] | string | undefined): string[] {
  if (!p) return []
  if (Array.isArray(p)) return p as string[]
  try {
    const parsed = JSON.parse(p)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// emergencyContact se persiste como JSON. Normaliza string|object → objeto plano para la UI.
function normalizeEmergency(ec: string | object | undefined | null): { name: string; phone: string; relation: string; email: string } {
  const empty = { name: '', phone: '', relation: '', email: '' }
  if (!ec) return empty
  let obj: any = ec
  if (typeof ec === 'string') {
    try { obj = JSON.parse(ec) } catch { return empty }
  }
  return {
    name: String(obj?.name ?? ''),
    phone: String(obj?.phone ?? ''),
    relation: String(obj?.relation ?? ''),
    email: String(obj?.email ?? ''),
  }
}

// mapGuest: mapeo 1:1 RawGuest→Guest (naming canónico, sin split ni fallbacks de dobles).
export function mapGuest(g: RawGuest): Guest {
  return {
    id: g.id,
    hotelId: g.hotelId,
    name: g.name || '',
    email: g.email,
    phone: g.phone,
    documentType: g.documentType || '',
    document: g.document || '',
    documentIssueDate: g.documentIssueDate || '',
    nationality: g.nationality || '',
    language: g.language,
    country: g.country,
    sex: g.sex as Guest['sex'],
    birthDate: g.birthDate,
    address: g.address,
    city: g.city,
    province: g.province,
    communicateClient: g.communicateClient as Guest['communicateClient'],
    totalStays: g.totalStays ?? 0,
    totalSpent: g.totalSpent ?? 0,
    loyaltyPoints: g.loyaltyPoints ?? 0,
    preferences: normalizePreferences(g.preferences),
    notes: g.notes,
    tier: g.tier,
    profession: g.profession,
    emergencyContact: normalizeEmergency(g.emergencyContact) as any,
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

  async get(id: string): Promise<Guest> {
    const data = await http.get<RawGuest>(`/huespedes/${id}`)
    return mapGuest(data)
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
