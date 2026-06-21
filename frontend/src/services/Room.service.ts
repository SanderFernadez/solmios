import { http } from './http'
import type { Room, RoomType, RoomStatus } from '@/types'

interface RawRoom {
  id: string
  hotelId: string
  number: string
  name?: string
  type: string
  basePrice: number
  status: string
  capacity: number
  floor: number
}

const ROOM_TYPE_MAP: Record<string, RoomType> = {
  single: 'single', sencilla: 'single', individual: 'single',
  double: 'double', doble: 'double',
  suite: 'suite',
  villa: 'villa',
  dorm: 'dorm', compartida: 'dorm',
  family: 'family', familiar: 'family',
}

const ROOM_STATUS_MAP: Record<string, RoomStatus> = {
  disponible: 'available', available: 'available',
  ocupada: 'occupied', occupied: 'occupied',
  pendiente: 'pending', pending: 'pending',
  limpieza: 'cleaning', cleaning: 'cleaning', 'en limpieza': 'cleaning',
  'fuera de servicio': 'out_of_service', out_of_service: 'out_of_service', 'mantenimiento': 'out_of_service',
}

export function mapRoom(r: RawRoom): Room {
  return {
    id: r.id,
    hotelId: r.hotelId,
    number: r.number,
    name: r.name,
    type: ROOM_TYPE_MAP[r.type?.toLowerCase()] ?? 'double',
    floor: r.floor,
    status: ROOM_STATUS_MAP[r.status?.toLowerCase()] ?? 'available',
    amenities: [],
    maxGuests: r.capacity,
    basePrice: r.basePrice,
  }
}

interface RoomsResponse {
  data: RawRoom[]
  total: number
  tipos: string[]
  estados: string[]
}

export const RoomService = {
  async list(params?: { hotelId?: string; tipo?: string; estado?: string }): Promise<{ rooms: Room[]; total: number }> {
    const qs = new URLSearchParams()
    if (params?.hotelId) qs.set('hotelId', params.hotelId)
    if (params?.type) qs.set('tipo', params.type)
    if (params?.status) qs.set('estado', params.status)
    const query = qs.toString()
    const data = await http.get<RoomsResponse>(`/habitaciones${query ? `?${query}` : ''}`)
    return { rooms: data.data.map(mapRoom), total: data.total }
  },

  async create(input: Partial<Room> & { hotelId: string }): Promise<Room> {
    const body = {
      number: input.number,
      name: input.name,
      type: input.type,
      basePrice: input.basePrice,
      hotelId: input.hotelId,
      capacity: input.maxGuests ?? 2,
      floor: input.floor ?? 1,
    }
    const data = await http.post<RawRoom>('/habitaciones', body)
    return mapRoom(data)
  },

  async update(id: string, patch: Partial<Room>): Promise<Room> {
    const body: Record<string, unknown> = {}
    if (patch.number !== undefined) body.number = patch.number
    if (patch.name !== undefined) body.name = patch.name
    if (patch.type !== undefined) body.type = patch.type
    if (patch.basePrice !== undefined) body.basePrice = patch.basePrice
    if (patch.maxGuests !== undefined) body.capacity = patch.maxGuests
    if (patch.floor !== undefined) body.floor = patch.floor
    if (patch.status !== undefined) {
      body.status = patch.status === 'available' ? 'disponible'
        : patch.status === 'occupied' ? 'ocupada'
        : patch.status === 'cleaning' ? 'limpieza'
        : patch.status === 'pending' ? 'pendiente'
        : 'fuera de servicio'
    }
    const data = await http.put<RawRoom>(`/habitaciones/${id}`, body)
    return mapRoom(data)
  },

  async delete(id: string): Promise<void> {
    return http.delete(`/habitaciones/${id}`)
  },
}
