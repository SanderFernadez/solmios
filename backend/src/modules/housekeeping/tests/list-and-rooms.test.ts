// "Mis Tareas" mostraba las habitaciones de todo el hotel, sin número y sin piso.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { ListUseCase } from '../usecases/list'
import { withRoomInfo } from '../usecases/room-info'
import { notifyTaskAssigned } from '../../../shared/usecases/notify-task-assigned'

const rosa = { id: 'rosa', hotelId: 'h1', role: 'housekeeper' }

const rooms = [
  { id: 'r1', number: '201', floor: 2, type: 'suite' },
  { id: 'r2', number: '305', floor: null, type: 'doble' },
]
const roomRepo = { findMany: async () => rooms } as unknown as RepositoryAdapter<any>
const userRepo = { findById: async () => ({ hotelId: 'h1' }) } as unknown as RepositoryAdapter<any>

/** Cache real en memoria: sin esto no se detecta que la clave ignora los filtros. */
function memoryCache(): CacheAdapter {
  const store = new Map<string, unknown>()
  return {
    get: async (k: string) => store.get(k),
    set: async (k: string, v: unknown) => { store.set(k, v) },
    delete: async (k: string) => { store.delete(k) },
  } as unknown as CacheAdapter
}

const allTasks = [
  { id: 't1', hotelId: 'h1', roomId: 'r1', staffId: 'rosa', status: 'pending' },
  { id: 't2', hotelId: 'h1', roomId: 'r2', staffId: 'otra', status: 'pending' },
]

/** Repo que respeta los filtros, como el ORM real. */
function repoWith(rows: any[]) {
  return {
    paginate: async (filters: any) => {
      const data = rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v))
      return { data, total: data.length }
    },
  } as unknown as RepositoryAdapter<any>
}

describe('withRoomInfo', () => {
  it('agrega número, piso y tipo desde la habitación', async () => {
    const [task] = await withRoomInfo(roomRepo, [{ roomId: 'r1' }])

    expect(task.roomNumber).toBe('201')
    expect(task.floor).toBe(2)
    expect(task.roomType).toBe('suite')
  })

  // `floor: null` rompía el parseo de la app, que espera int.
  it('un piso null se normaliza a 0', async () => {
    const [task] = await withRoomInfo(roomRepo, [{ roomId: 'r2' }])

    expect(task.floor).toBe(0)
    expect(task.roomNumber).toBe('305')
  })

  it('una habitación desconocida deja la tarea intacta', async () => {
    const [task] = await withRoomInfo(roomRepo, [{ roomId: 'fantasma' }])

    expect((task as any).roomNumber).toBeUndefined()
  })

  it('sin roomRepo devuelve las tareas tal cual', async () => {
    expect(await withRoomInfo(undefined, [{ roomId: 'r1' }])).toEqual([{ roomId: 'r1' }])
  })
})

describe('ListUseCase — la caché no puede ignorar los filtros', () => {
  // El bug: `housekeeping:list:<hotelId>` cacheaba la primera consulta y
  // `?staffId=rosa` recibía la lista completa del hotel.
  it('pedir todas y luego las de Rosa NO devuelve la lista cacheada', async () => {
    const uc = new ListUseCase(repoWith(allTasks), memoryCache(), userRepo, roomRepo)

    const todas = await uc.list({} as any, { ...rosa, role: 'hotel_admin' })
    expect(todas.data).toHaveLength(2)

    const suyas = await uc.list({ staffId: 'rosa' } as any, rosa)
    expect(suyas.data).toHaveLength(1)
    expect(suyas.data[0].id).toBe('t1')
  })

  it('la segunda página no devuelve la primera', async () => {
    const cache = memoryCache()
    const uc = new ListUseCase(repoWith(allTasks), cache, userRepo, roomRepo)

    const p1 = await uc.list({ page: 1, limit: 1 } as any, { ...rosa, role: 'hotel_admin' })
    const p2 = await uc.list({ page: 2, limit: 1 } as any, { ...rosa, role: 'hotel_admin' })

    expect(p1.page).toBe(1)
    expect(p2.page).toBe(2)
  })

  it('las tareas listadas ya traen el número de habitación', async () => {
    const uc = new ListUseCase(repoWith(allTasks), memoryCache(), userRepo, roomRepo)

    const suyas = await uc.list({ staffId: 'rosa' } as any, rosa)

    expect((suyas.data[0] as any).roomNumber).toBe('201')
  })

  it('nadie ve las tareas de otro hotel', async () => {
    const uc = new ListUseCase(repoWith(allTasks), memoryCache(), userRepo, roomRepo)

    const r = await uc.list({} as any, { id: 'x', hotelId: 'h2', role: 'housekeeper' })

    expect(r.data).toEqual([])
  })
})

describe('notifyTaskAssigned', () => {
  const roomsPort = { getById: async () => ({ number: '201' }) }

  it('avisa a la persona asignada, con habitación y tipo', async () => {
    const sent: any[] = []
    const notif = { create: async (d: any) => { sent.push(d); return d } }

    await notifyTaskAssigned(notif, roomsPort, {
      hotelId: 'h1', staffId: 'rosa', roomId: 'r1', type: 'deep_cleaning',
    })

    expect(sent[0].userId).toBe('rosa')
    expect(sent[0].title).toBe('Nueva tarea asignada')
    expect(sent[0].message).toBe('Habitación 201 · Limpieza profunda')
    expect(sent[0].type).toBe('cleaning')
  })

  it('una tarea sin asignar no avisa a nadie', async () => {
    const sent: any[] = []
    const notif = { create: async (d: any) => { sent.push(d); return d } }

    await notifyTaskAssigned(notif, roomsPort, { hotelId: 'h1' })

    expect(sent).toEqual([])
  })

  it('sin habitación resoluble el aviso igual llega', async () => {
    const sent: any[] = []
    const notif = { create: async (d: any) => { sent.push(d); return d } }

    await notifyTaskAssigned(notif, null, { hotelId: 'h1', staffId: 'rosa', type: 'full_cleaning' })

    expect(sent[0].message).toBe('Sin habitación · Limpieza completa')
  })

  it('un tipo desconocido no rompe el texto', async () => {
    const sent: any[] = []
    const notif = { create: async (d: any) => { sent.push(d); return d } }

    await notifyTaskAssigned(notif, roomsPort, { hotelId: 'h1', staffId: 'rosa', type: 'raro' })

    expect(sent[0].message).toContain('Limpieza')
    expect(sent[0].message).not.toContain('undefined')
  })
})
