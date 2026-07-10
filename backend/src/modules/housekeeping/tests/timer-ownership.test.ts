// El cronómetro de la camarera. `task.staffId` es un `users.id`, no un
// `employee_profiles.id`: comparar contra la otra tabla dejaba a la camarera
// sin poder arrancar la limpieza de su propia habitación.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { TimingsUseCase } from '../usecases/timings'
import type { HousekeepingDTO } from '../types'

const rosa = { id: 'rosa', hotelId: 'hotel-1', role: 'housekeeper' }
const otra = { id: 'otra', hotelId: 'hotel-1', role: 'housekeeper' }
const admin = { id: 'jefe', hotelId: 'hotel-1', role: 'hotel_admin' }

function task(over: Partial<HousekeepingDTO> = {}) {
  return {
    id: 't1',
    hotelId: 'hotel-1',
    staffId: 'rosa',
    status: 'pending',
    startTime: null,
    ...over,
  } as unknown as HousekeepingDTO
}

function useCase(row: HousekeepingDTO, sink: any[] = []) {
  const repo = {
    findById: async () => row,
    update: async (id: string, d: any) => { sink.push({ id, ...d }); return { ...row, ...d } },
  } as unknown as RepositoryAdapter<HousekeepingDTO>
  // El tercer arg es `employeeRepo`: ya no hace falta y no se pasa.
  return new TimingsUseCase(repo, async () => {}, async () => {})
}

describe('start — ownership', () => {
  it('la camarera asignada arranca su cronómetro', async () => {
    const sink: any[] = []
    const item = await useCase(task(), sink).start('t1', rosa)

    expect(item.status).toBe('in_progress')
    expect(sink[0].startTime).toBeTruthy()
  })

  it('otra camarera no puede arrancar una tarea ajena', async () => {
    expect(useCase(task()).start('t1', otra)).rejects.toThrow()
  })

  it('el admin puede arrancar cualquier tarea', async () => {
    const item = await useCase(task()).start('t1', admin)

    expect(item.status).toBe('in_progress')
  })

  it('una tarea sin asignar no se puede arrancar', async () => {
    expect(useCase(task({ staffId: undefined as any })).start('t1', admin)).rejects.toThrow()
  })

  it('no se arranca la tarea de otro hotel', async () => {
    expect(useCase(task({ hotelId: 'hotel-2' })).start('t1', rosa)).rejects.toThrow()
  })
})

describe('complete — ownership', () => {
  it('la camarera asignada termina su tarea', async () => {
    const row = task({ status: 'in_progress', startTime: '2026-07-09T10:00:00Z' } as any)
    const item = await useCase(row).complete('t1', rosa)

    expect(item.status).toBe('completed')
  })

  it('otra camarera no puede terminarla', async () => {
    const row = task({ status: 'in_progress', startTime: '2026-07-09T10:00:00Z' } as any)

    expect(useCase(row).complete('t1', otra)).rejects.toThrow()
  })

  it('no se termina una tarea que nunca arrancó', async () => {
    expect(useCase(task({ status: 'in_progress' })).complete('t1', rosa)).rejects.toThrow()
  })
})
