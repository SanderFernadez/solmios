// shared/tests/open-maintenance-from-housekeeping.test.ts — El reporte de la camarera abre un ticket.
//
// Regresión: reportar dos veces abría dos tickets. La app se usa en el pasillo, con mala señal: el
// doble-toque y el reintento son la regla, no la excepción.

import { describe, it, expect } from 'bun:test'
import {
  openMaintenanceFromHousekeeping,
  type MantenimientoPort,
  type HabitacionesPort,
} from '../usecases/open-maintenance-from-housekeeping'
import type { IssueReport } from '../../modules/housekeeping/sockets'

const issue = (over: Partial<IssueReport> = {}): IssueReport => ({
  hotelId: 'h1',
  taskId: 't1',
  roomId: 'r1',
  description: 'El aire acondicionado gotea sobre la cama',
  photos: [{ url: '/uploads/rota1.jpg' }],
  reportedBy: 'camarera-1',
  ...over,
})

function makePorts(existing: Array<{ description?: string }> = []) {
  const created: any[] = []
  const users: any[] = []
  const mantenimiento: MantenimientoPort = {
    findBySourceTask: async () => existing,
    create: async (dto: any, user: any) => { created.push(dto); users.push(user); return { id: 'm1' } },
  }
  const habitaciones: HabitacionesPort = { getById: async () => ({ number: 101 }) }
  return { mantenimiento, habitaciones, created, users }
}

describe('openMaintenanceFromHousekeeping', () => {
  it('abre el ticket con la descripción, las fotos y la habitación', async () => {
    const { mantenimiento, habitaciones, created } = makePorts()

    await openMaintenanceFromHousekeeping(mantenimiento, habitaciones, issue())

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      hotelId: 'h1',
      title: 'Reporte de limpieza — Hab. 101',
      description: 'El aire acondicionado gotea sobre la cama',
      priority: 'medium',
      status: 'open',
      sourceTaskId: 't1',
    })
    expect(created[0].photos).toEqual([{ url: '/uploads/rota1.jpg' }])
  })

  // Mantenimiento tiene que saber a quién preguntarle.
  it('el ticket lo levanta la camarera, no el sistema', async () => {
    const { mantenimiento, habitaciones, users } = makePorts()

    await openMaintenanceFromHousekeeping(mantenimiento, habitaciones, issue())

    expect(users[0]).toEqual({ id: 'camarera-1', role: 'housekeeper', hotelId: 'h1' })
  })

  it('tocar dos veces reportar no abre dos tickets', async () => {
    const { mantenimiento, habitaciones, created } = makePorts([
      { description: 'El aire acondicionado gotea sobre la cama' },
    ])

    expect(await openMaintenanceFromHousekeeping(mantenimiento, habitaciones, issue())).toBeNull()
    expect(created).toHaveLength(0)
  })

  // Una misma tarea sí puede tener dos incidencias distintas.
  it('una incidencia distinta en la misma tarea sí abre otro ticket', async () => {
    const { mantenimiento, habitaciones, created } = makePorts([{ description: 'Cortina rota' }])

    await openMaintenanceFromHousekeeping(mantenimiento, habitaciones, issue())

    expect(created).toHaveLength(1)
  })

  it('sin descripción no hay nada que arreglar: no abre ticket', async () => {
    const { mantenimiento, habitaciones, created } = makePorts()

    expect(await openMaintenanceFromHousekeeping(mantenimiento, habitaciones, issue({ description: '   ' }))).toBeNull()
    expect(created).toHaveLength(0)
  })

  it('sin número de habitación el ticket igual sirve: lleva descripción y fotos', async () => {
    const { mantenimiento, created } = makePorts()

    await openMaintenanceFromHousekeeping(mantenimiento, null, issue({ roomId: undefined }))

    expect(created[0].title).toBe('Reporte de limpieza — Sin habitación')
    expect(created[0].description).toBe('El aire acondicionado gotea sobre la cama')
  })

  it('si habitaciones falla, el ticket se abre igual', async () => {
    const { mantenimiento, created } = makePorts()
    const rota: HabitacionesPort = { getById: async () => { throw new Error('caído') } }

    await openMaintenanceFromHousekeeping(mantenimiento, rota, issue())

    expect(created).toHaveLength(1)
    expect(created[0].title).toBe('Reporte de limpieza — Sin habitación')
  })

  // NO es best-effort: la camarera tiene que enterarse de que su reporte no llegó.
  it('propaga el error si el ticket no se puede abrir', async () => {
    const { mantenimiento, habitaciones } = makePorts()
    mantenimiento.create = async () => { throw new Error('mantenimiento caído') }

    await expect(openMaintenanceFromHousekeeping(mantenimiento, habitaciones, issue()))
      .rejects.toThrow('mantenimiento caído')
  })
})
