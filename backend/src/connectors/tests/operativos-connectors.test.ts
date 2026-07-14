// connectors/tests/operativos-connectors.test.ts — TC-03: conectores operativos.
//
// housekeeping-* y mantenimiento-*. Un conector solo DELEGA: se verifica el cableado y el mapeo.
// Lo crítico: el mapa de estado orden→habitación (una orden cerrada deja la habitación en
// `cleaning`, una en curso la saca de servicio) y que un satélite ausente no rompa la operación.

import { describe, it, expect } from 'bun:test'
import type { ConnectorContext } from 'arckode-framework'
import { housekeepingMantenimientoConnector } from '../housekeeping-mantenimiento'
import { housekeepingNotificacionesConnector } from '../housekeeping-notificaciones'
import { mantenimientoHabitacionesConnector } from '../mantenimiento-habitaciones'
import { mantenimientoNotificacionesConnector } from '../mantenimiento-notificaciones'

function makeCtx(hosts: string[], modules: Record<string, any> = {}) {
  const captured: any = { sockets: {} }
  const hostStub = { setSockets: (s: any) => Object.assign(captured.sockets, s) }
  const ctx = {
    resolveModule: (name: string) => {
      if (hosts.includes(name)) return { ...hostStub, ...(modules[name] ?? {}) }
      if (name in modules) return modules[name]
      throw new Error(`módulo desconocido: ${name}`) // simula un módulo no montado
    },
  } as unknown as ConnectorContext
  return { ctx, captured }
}

describe('mantenimientoHabitacionesConnector', () => {
  it('orden cerrada → habitación a cleaning; orden en curso → out_of_order', async () => {
    const updates: any[] = []
    const { ctx, captured } = makeCtx(['mantenimiento'], {
      habitaciones: { update: async (id: string, dto: any) => { updates.push({ id, dto }); return {} } },
    })
    mantenimientoHabitacionesConnector(ctx)

    await captured.sockets.onMantenimientoUpdated({ roomId: 'r1', status: 'closed', hotelId: 'h1' })
    await captured.sockets.onMantenimientoUpdated({ roomId: 'r2', status: 'in_progress', hotelId: 'h1' })

    expect(updates).toHaveLength(2)
    expect(updates[0].dto.status).toBe('cleaning')
    expect(updates[1].dto.status).toBe('out_of_order')
  })

  it('no toca la habitación si el estado no mapea, o si la orden no tiene habitación', async () => {
    const updates: any[] = []
    const { ctx, captured } = makeCtx(['mantenimiento'], {
      habitaciones: { update: async (id: string, dto: any) => { updates.push({ id, dto }); return {} } },
    })
    mantenimientoHabitacionesConnector(ctx)

    await captured.sockets.onMantenimientoUpdated({ roomId: 'r1', status: 'open', hotelId: 'h1' }) // sin mapeo
    await captured.sockets.onMantenimientoUpdated({ status: 'closed', hotelId: 'h1' }) // sin roomId
    expect(updates).toHaveLength(0)
  })
})

describe('housekeepingMantenimientoConnector', () => {
  it('un problema reportado en limpieza abre una orden de mantenimiento', async () => {
    const created: any[] = []
    const { ctx, captured } = makeCtx(['housekeeping'], {
      mantenimiento: {
        findBySourceTask: async () => [], // sin orden previa → no hay dedup
        create: async (dto: any) => { created.push(dto); return { id: 'ord1' } },
      },
      habitaciones: { getById: async () => ({ number: '101' }) },
    })
    housekeepingMantenimientoConnector(ctx)
    await captured.sockets.onIssueReported({
      hotelId: 'h1', roomId: 'r1', taskId: 't1', description: 'Canilla rota', reportedBy: 'u1',
    } as any)

    expect(created).toHaveLength(1)
    expect(created[0].hotelId).toBe('h1')
  })

  it('si habitaciones no está montado, igual abre la orden (satélite opcional)', async () => {
    const created: any[] = []
    const { ctx, captured } = makeCtx(['housekeeping'], {
      mantenimiento: {
        findBySourceTask: async () => [],
        create: async (dto: any) => { created.push(dto); return { id: 'ord1' } },
      },
      // habitaciones ausente a propósito → resolveModule lanza y el connector lo absorbe
    })
    housekeepingMantenimientoConnector(ctx)
    await captured.sockets.onIssueReported({
      hotelId: 'h1', roomId: 'r1', taskId: 't1', description: 'Canilla rota', reportedBy: 'u1',
    } as any)
    expect(created).toHaveLength(1)
  })
})

describe('housekeepingNotificacionesConnector', () => {
  it('notifica al asignar una tarea de limpieza', async () => {
    const notes: any[] = []
    const { ctx, captured } = makeCtx(['housekeeping'], {
      notificaciones: { create: async (dto: any) => { notes.push(dto); return dto } },
      habitaciones: { getById: async () => ({ number: '101' }) },
      pushtokens: { notifyUser: async () => 1 },
    })
    housekeepingNotificacionesConnector(ctx)
    await captured.sockets.onTaskAssigned({ hotelId: 'h1', roomId: 'r1', staffId: 'u1', id: 't1', type: 'full_cleaning', priority: 'high' })
    expect(notes.length).toBeGreaterThan(0)
  })

  it('si push/habitaciones no están montados, la notificación NO se rompe', async () => {
    const notes: any[] = []
    const { ctx, captured } = makeCtx(['housekeeping'], {
      notificaciones: { create: async (dto: any) => { notes.push(dto); return dto } },
      // sin habitaciones ni pushtokens → ambos son opcionales
    })
    housekeepingNotificacionesConnector(ctx)
    await expect(
      captured.sockets.onTaskAssigned({ hotelId: 'h1', roomId: 'r1', staffId: 'u1', id: 't1', type: 'full_cleaning', priority: 'high' }),
    ).resolves.toBeUndefined()
    expect(notes.length).toBeGreaterThan(0)
  })
})

describe('mantenimientoNotificacionesConnector', () => {
  it('cablea los tres eventos (creada / actualizada / asignada) a notificaciones', async () => {
    const notes: any[] = []
    const { ctx, captured } = makeCtx(['mantenimiento'], {
      notificaciones: { create: async (dto: any) => { notes.push(dto); return dto } },
    })
    mantenimientoNotificacionesConnector(ctx)

    expect(typeof captured.sockets.onMantenimientoCreated).toBe('function')
    expect(typeof captured.sockets.onMantenimientoUpdated).toBe('function')
    expect(typeof captured.sockets.onMantenimientoAssigned).toBe('function')

    await captured.sockets.onMantenimientoCreated({ id: 'o1', hotelId: 'h1', title: 'Fuga', priority: 'high', status: 'open' })
    expect(notes.length).toBeGreaterThan(0)
  })
})
