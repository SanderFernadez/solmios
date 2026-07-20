import { describe, it, expect } from 'bun:test'
import { releaseRoomAfterCleaning, type RoomPort, type CleaningTask } from '../release-room-after-cleaning'

/** Habitación falsa con un estado dado; registra si la actualizaron y a qué. */
function fakeRooms(status: string | undefined, opts: { missing?: boolean; throwOnGet?: boolean } = {}) {
  const calls: { status: string }[] = []
  const rooms: RoomPort = {
    getById: async () => {
      if (opts.throwOnGet) throw new Error('boom')
      if (opts.missing) return null
      return { id: 'r1', status }
    },
    update: async (_id, dto) => { calls.push(dto); return {} },
  }
  return { rooms, updated: () => calls }
}

const inspected: CleaningTask = { roomId: 'r1', hotelId: 'h1', status: 'inspected' }

describe('releaseRoomAfterCleaning', () => {
  it('libera la habitación cuando la limpieza se aprobó y la habitación sigue en cleaning', async () => {
    const { rooms, updated } = fakeRooms('cleaning')
    const did = await releaseRoomAfterCleaning(rooms, inspected)
    expect(did).toBe(true)
    expect(updated()).toEqual([{ status: 'available' }])
  })

  // La guarda: entre el checkout y la aprobación la habitación pudo cambiar de estado. Pisarla
  // con 'available' vendería algo que no está disponible.
  it.each(['occupied', 'maintenance', 'out_of_order', 'reserved', 'available'])(
    'NO toca la habitación si está en %s (no en cleaning)',
    async (status) => {
      const { rooms, updated } = fakeRooms(status)
      const did = await releaseRoomAfterCleaning(rooms, inspected)
      expect(did).toBe(false)
      expect(updated()).toHaveLength(0)
    },
  )

  it('solo la aprobación libera: completed/pending/in_progress no hacen nada', async () => {
    for (const status of ['completed', 'pending', 'in_progress']) {
      const { rooms, updated } = fakeRooms('cleaning')
      const did = await releaseRoomAfterCleaning(rooms, { ...inspected, status })
      expect(did).toBe(false)
      expect(updated()).toHaveLength(0)
    }
  })

  it('tarea sin roomId o sin hotelId no hace nada', async () => {
    const { rooms, updated } = fakeRooms('cleaning')
    expect(await releaseRoomAfterCleaning(rooms, { ...inspected, roomId: null })).toBe(false)
    expect(await releaseRoomAfterCleaning(rooms, { ...inspected, hotelId: null })).toBe(false)
    expect(updated()).toHaveLength(0)
  })

  it('habitación inexistente: no lanza, no actualiza', async () => {
    const { rooms, updated } = fakeRooms('cleaning', { missing: true })
    expect(await releaseRoomAfterCleaning(rooms, inspected)).toBe(false)
    expect(updated()).toHaveLength(0)
  })

  it('un fallo al leer la habitación no revierte la aprobación (no lanza)', async () => {
    const { rooms } = fakeRooms('cleaning', { throwOnGet: true })
    const warns: unknown[] = []
    const did = await releaseRoomAfterCleaning(rooms, inspected, { warn: (m, e) => warns.push([m, e]) })
    expect(did).toBe(false)
    expect(warns).toHaveLength(1)
  })
})
