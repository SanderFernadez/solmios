import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock del service: el store no debe pegarle a la API real en tests.
vi.mock('@/services/Reservation.service', () => ({
  ReservationService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

import { useReservationStore } from './reservation.store'
import { ReservationService } from '@/services/Reservation.service'
import type { Reservation } from '@/types'

const makeReservation = (id: string, over: Partial<Reservation> = {}): Reservation =>
  ({ id, hotelId: 'h1', status: 'confirmed', totalAmount: 100, ...over } as unknown as Reservation)

describe('reservation.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('arranca vacío y sin loading', () => {
    const store = useReservationStore()
    expect(store.reservations).toEqual([])
    expect(store.total).toBe(0)
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
  })

  it('fetchReservations happy path: carga data + total y baja loading', async () => {
    vi.mocked(ReservationService.list).mockResolvedValue({
      reservations: [makeReservation('r1'), makeReservation('r2')],
      total: 2,
    })
    const store = useReservationStore()

    await store.fetchReservations({ hotelId: 'h1', status: 'confirmed' })

    expect(ReservationService.list).toHaveBeenCalledWith({ hotelId: 'h1', status: 'confirmed' })
    expect(store.reservations).toHaveLength(2)
    expect(store.total).toBe(2)
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
  })

  it('fetchReservations en error: setea error, vacía la lista y baja loading', async () => {
    vi.mocked(ReservationService.list).mockRejectedValue(new Error('boom'))
    const store = useReservationStore()
    // pre-cargar para verificar que se limpia
    store.reservations = [makeReservation('viejo')]

    await store.fetchReservations()

    expect(store.error).toBe('boom')
    expect(store.reservations).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('fetchReservations con error no-Error usa mensaje por defecto', async () => {
    vi.mocked(ReservationService.list).mockRejectedValue('string feo')
    const store = useReservationStore()

    await store.fetchReservations()

    expect(store.error).toBe('Error al cargar reservas')
  })

  it('createReservation antepone (unshift) la nueva reserva y la devuelve', async () => {
    const store = useReservationStore()
    store.reservations = [makeReservation('existente')]
    vi.mocked(ReservationService.create).mockResolvedValue(makeReservation('nueva'))

    const created = await store.createReservation({
      hotelId: 'h1', roomId: 'room1', checkIn: '2026-01-01', checkOut: '2026-01-02', totalAmount: 100,
    })

    expect(created.id).toBe('nueva')
    // regla: la nueva va PRIMERO en la lista
    expect(store.reservations[0].id).toBe('nueva')
    expect(store.reservations).toHaveLength(2)
  })

  it('updateReservation reemplaza en su lugar si existe', async () => {
    const store = useReservationStore()
    store.reservations = [makeReservation('r1', { status: 'confirmed' }), makeReservation('r2')]
    vi.mocked(ReservationService.update).mockResolvedValue(makeReservation('r1', { status: 'checked_in' }))

    const updated = await store.updateReservation('r1', { status: 'checked_in' })

    expect(updated.status).toBe('checked_in')
    expect(store.reservations[0].status).toBe('checked_in')
    expect(store.reservations).toHaveLength(2)
  })

  it('updateReservation no toca la lista si el id no existe (edge case)', async () => {
    const store = useReservationStore()
    store.reservations = [makeReservation('r1')]
    vi.mocked(ReservationService.update).mockResolvedValue(makeReservation('fantasma'))

    const updated = await store.updateReservation('fantasma', { status: 'cancelled' })

    expect(updated.id).toBe('fantasma')
    // la lista original queda intacta: no se insertó nada
    expect(store.reservations).toHaveLength(1)
    expect(store.reservations[0].id).toBe('r1')
  })
})
