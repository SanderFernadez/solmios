// Reportar una incidencia debe abrir un ticket REAL con descripción y fotos.
// Antes solo dejaba una línea en las notas de la tarea y mantenimiento nunca
// veía qué había que arreglar.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { ApproveUseCase } from '../usecases/approve'
import type { IssueReport } from '../sockets'
import type { HousekeepingDTO } from '../types'

const camarera = { id: 'rosa', hotelId: 'hotel-1', role: 'housekeeper' }

function task(over: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    hotelId: 'hotel-1',
    roomId: 'room-4',
    status: 'in_progress',
    notes: '',
    photos: [{ url: '/uploads/hk/rota.jpg' }],
    ...over,
  }
}

function repoWith(row: Record<string, unknown> | null, updates: any[] = []) {
  return {
    findById: async () => row,
    update: async (id: string, d: any) => { updates.push({ id, ...d }); return { ...row, ...d } },
  } as unknown as RepositoryAdapter<HousekeepingDTO>
}

describe('reportIssue', () => {
  it('abre un ticket con la descripción, la habitación y las fotos de la tarea', async () => {
    const reported: IssueReport[] = []
    const uc = new ApproveUseCase(repoWith(task()))

    await uc.reportIssue('task-1', 'La ducha pierde agua', 'maintenance', camarera,
      async (i) => { reported.push(i) })

    expect(reported).toHaveLength(1)
    expect(reported[0].description).toBe('La ducha pierde agua')
    expect(reported[0].roomId).toBe('room-4')
    expect(reported[0].photos).toEqual([{ url: '/uploads/hk/rota.jpg' }])
    expect(reported[0].reportedBy).toBe('rosa')
    expect(reported[0].hotelId).toBe('hotel-1')
  })

  it('deja la nota en la tarea aunque no haya quien abra el ticket', async () => {
    const updates: any[] = []
    const uc = new ApproveUseCase(repoWith(task(), updates))

    await uc.reportIssue('task-1', 'Foco quemado', 'maintenance', camarera)

    expect(updates[0].notes).toContain('Foco quemado')
  })

  // Un reporte al supervisor es una nota interna, no una orden de trabajo.
  it('un reporte al supervisor NO abre ticket de mantenimiento', async () => {
    const reported: IssueReport[] = []
    const uc = new ApproveUseCase(repoWith(task()))

    await uc.reportIssue('task-1', 'Huésped se quejó', 'supervisor', camarera,
      async (i) => { reported.push(i) })

    expect(reported).toEqual([])
  })

  it('una tarea sin fotos reporta una lista vacía, no null', async () => {
    const reported: IssueReport[] = []
    const uc = new ApproveUseCase(repoWith(task({ photos: null })))

    await uc.reportIssue('task-1', 'Ruido raro', 'maintenance', camarera,
      async (i) => { reported.push(i) })

    expect(reported[0].photos).toEqual([])
  })

  // Sin esto se reportaba sobre la tarea de otro hotel y el ticket nacía allá.
  it('no se puede reportar sobre la tarea de otro hotel', async () => {
    const uc = new ApproveUseCase(repoWith(task({ hotelId: 'hotel-2' })))

    expect(
      uc.reportIssue('task-1', 'intruso', 'maintenance', camarera),
    ).rejects.toThrow()
  })

  it('el super_admin sí puede reportar en cualquier hotel', async () => {
    const reported: IssueReport[] = []
    const uc = new ApproveUseCase(repoWith(task({ hotelId: 'hotel-2' })))

    await uc.reportIssue('task-1', 'ok', 'maintenance',
      { id: 'root', hotelId: undefined, role: 'super_admin' },
      async (i) => { reported.push(i) })

    expect(reported[0].hotelId).toBe('hotel-2')
  })

  it('una tarea inexistente falla en vez de abrir un ticket vacío', async () => {
    const uc = new ApproveUseCase(repoWith(null))

    expect(uc.reportIssue('nope', 'x', 'maintenance', camarera)).rejects.toThrow()
  })
})
