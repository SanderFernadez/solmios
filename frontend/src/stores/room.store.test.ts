import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/Room.service', () => ({
  RoomService: {
    list: vi.fn(),
    update: vi.fn(),
  },
}))

import { useRoomStore } from './room.store'
import { RoomService } from '@/services/Room.service'
import type { Room, RoomStatus } from '@/types'

const makeRoom = (id: string, status: RoomStatus): Room =>
  ({ id, hotelId: 'h1', number: id, status, type: 'double' } as unknown as Room)

describe('room.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('arranca vacío', () => {
    const store = useRoomStore()
    expect(store.rooms).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
  })

  it('fetchRooms sin filtro de status devuelve toda la data del service', async () => {
    vi.mocked(RoomService.list).mockResolvedValue({
      rooms: [makeRoom('101', 'available'), makeRoom('102', 'occupied')],
      total: 2,
    })
    const store = useRoomStore()

    await store.fetchRooms({ hotelId: 'h1' })

    expect(store.rooms).toHaveLength(2)
    expect(store.loading).toBe(false)
  })

  it('fetchRooms traduce status EN→ES para el query param `estado`', async () => {
    vi.mocked(RoomService.list).mockResolvedValue({ rooms: [], total: 0 })
    const store = useRoomStore()

    await store.fetchRooms({ hotelId: 'h1', status: 'cleaning' })

    // regla de negocio: 'cleaning' → 'limpieza' en el request al backend (español)
    expect(RoomService.list).toHaveBeenCalledWith({ hotelId: 'h1', estado: 'limpieza', tipo: undefined })
  })

  it('fetchRooms con status filtra la respuesta por ese status (defensivo)', async () => {
    vi.mocked(RoomService.list).mockResolvedValue({
      rooms: [makeRoom('101', 'available'), makeRoom('102', 'occupied'), makeRoom('103', 'available')],
      total: 3,
    })
    const store = useRoomStore()

    await store.fetchRooms({ hotelId: 'h1', status: 'available' })

    // aunque el backend devuelva mezcla, el store re-filtra por status
    expect(store.rooms).toHaveLength(2)
    expect(store.rooms.every(r => r.status === 'available')).toBe(true)
  })

  it('fetchRooms prioriza `tipo` sobre `type` (tipo ?? type)', async () => {
    vi.mocked(RoomService.list).mockResolvedValue({ rooms: [], total: 0 })
    const store = useRoomStore()

    await store.fetchRooms({ hotelId: 'h1', type: 'suite', tipo: 'villa' })
    expect(RoomService.list).toHaveBeenCalledWith({ hotelId: 'h1', estado: undefined, tipo: 'villa' })

    // solo type presente → usa type
    await store.fetchRooms({ hotelId: 'h1', type: 'suite' })
    expect(RoomService.list).toHaveBeenLastCalledWith({ hotelId: 'h1', estado: undefined, tipo: 'suite' })
  })

  it('fetchRooms en error setea mensaje y vacía la lista', async () => {
    vi.mocked(RoomService.list).mockRejectedValue(new Error('sin red'))
    const store = useRoomStore()
    store.rooms = [makeRoom('101', 'available')]

    await store.fetchRooms()

    expect(store.error).toBe('sin red')
    expect(store.rooms).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('updateRoomStatus reemplaza la habitación en la lista', async () => {
    const store = useRoomStore()
    store.rooms = [makeRoom('101', 'available'), makeRoom('102', 'occupied')]
    vi.mocked(RoomService.update).mockResolvedValue(makeRoom('101', 'cleaning'))

    const updated = await store.updateRoomStatus('101', 'cleaning')

    expect(RoomService.update).toHaveBeenCalledWith('101', { status: 'cleaning' })
    expect(updated.status).toBe('cleaning')
    expect(store.rooms[0].status).toBe('cleaning')
  })

  it('updateRoomStatus no altera la lista si el id no existe', async () => {
    const store = useRoomStore()
    store.rooms = [makeRoom('101', 'available')]
    vi.mocked(RoomService.update).mockResolvedValue(makeRoom('999', 'occupied'))

    await store.updateRoomStatus('999', 'occupied')

    expect(store.rooms).toHaveLength(1)
    expect(store.rooms[0].id).toBe('101')
    expect(store.rooms[0].status).toBe('available')
  })
})
