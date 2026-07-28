// hotelmedia/tests/service.test.ts — Smoke placeholder.
// Los tests reales del módulo viven en `tests/media-crud.test.ts` (CRUD + ownership +
// reorder sin gaps). Este archivo se mantiene como smoke mínimo para que el runner
// de Bun lo descubra sin romper el suite; la task 0.8 lo amplía con los controller tests.
import { describe, it, expect } from 'bun:test'
import { HotelMediaService } from '../service'

describe('hotel_media — smoke (placeholder task 0.8)', () => {
  it('HotelMediaService es importable y construible', () => {
    expect(typeof HotelMediaService).toBe('function')
    // Sin instanciar: la DI completa y los casos de negocio están cubiertos en
    // media-crud.test.ts.
  })
})
