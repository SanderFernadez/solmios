// hotelmedia/tests/service.test.ts — Smoke tests del módulo hotel_media (F0).
// Los tests funcionales del CRUD/ownership/reorder viven en `tests/media-crud.test.ts`.
// Acá solo verificamos que service + controller son importables y construibles, para
// que cualquier rotura de importaciones se detecte antes de llegar al analyze/build.
import { describe, it, expect } from 'bun:test'
import { HotelMediaService } from '../service'
import { HotelMediaController } from '../controller'
import type { Logger, RepositoryAdapter } from 'arckode-framework'
import type { HotelMediaDTO } from '../types'

// Stubs mínimos — no se invocan en smoke, solo satisfies TypeScript.
const noop = async () => undefined
const mediaRepo = { findMany: noop, findOne: noop } as unknown as RepositoryAdapter<HotelMediaDTO>
const roomsRepo = { findMany: noop, findOne: noop } as unknown as RepositoryAdapter<any>
const hotelsRepo = { findMany: noop, findOne: noop } as unknown as RepositoryAdapter<any>
const log = { info: noop, child: () => log, error: noop, warn: noop, debug: noop } as unknown as Logger

describe('hotel_media — smoke (F0 task 0.8)', () => {
  it('HotelMediaService es importable y construible', () => {
    expect(typeof HotelMediaService).toBe('function')
    // Sin instanciar: la DI completa y los casos de negocio están cubiertos en
    // media-crud.test.ts. Construimos para verificar el contract del constructor.
    const svc = new HotelMediaService(mediaRepo, roomsRepo, {} as any, log, {} as any)
    expect(svc).toBeDefined()
  })

  it('HotelMediaController expone los 6 handlers admin/público', () => {
    expect(typeof HotelMediaController).toBe('function')
    const svc = new HotelMediaService(mediaRepo, roomsRepo, {} as any, log, {} as any)
    const ctrl = new HotelMediaController(svc, log, mediaRepo, roomsRepo, hotelsRepo)
    expect(typeof ctrl.index).toBe('function')
    expect(typeof ctrl.store).toBe('function')
    expect(typeof ctrl.update).toBe('function')
    expect(typeof ctrl.destroy).toBe('function')
    expect(typeof ctrl.reorder).toBe('function')
    expect(typeof ctrl.publicMedia).toBe('function')
  })
})
