// bookingengine/tests/service.test.ts — Tests del servicio
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { BookingengineService } from '../service'
import { PaymentGatewayRegistry } from '../../../services/payment-gateway/registry'
import type { BookingConfigDTO, PublicBookingDTO, ConversionEventDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

// El registry es obligatorio: ninguna reserva puede cobrarse sin decir a qué hotel le paga.
const emptyGatewayRepo: any = { findMany: async () => [], findById: async () => null, create: async (d: any) => d, update: async () => {}, delete: async () => {}, count: async () => 0 }
const testRegistry = new PaymentGatewayRegistry(emptyGatewayRepo, log)

function makeConfigRepo(overrides: Partial<RepositoryAdapter<BookingConfigDTO>> = {}): RepositoryAdapter<BookingConfigDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'config-1', ...data } as BookingConfigDTO),
    update: async (id, data) => ({ id, ...data } as BookingConfigDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

function makeAvailabilityRepo(overrides: Partial<RepositoryAdapter<any>> = {}): RepositoryAdapter<any> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'avail-1', ...data }),
    update: async (id, data) => ({ id, ...data }),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

function makeBookingRepo(overrides: Partial<RepositoryAdapter<PublicBookingDTO>> = {}): RepositoryAdapter<PublicBookingDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'booking-1', ...data } as PublicBookingDTO),
    update: async (id, data) => ({ id, ...data } as PublicBookingDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

function makeEventsRepo(overrides: Partial<RepositoryAdapter<ConversionEventDTO>> = {}): RepositoryAdapter<ConversionEventDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'event-1', ...data } as ConversionEventDTO),
    update: async (id, data) => ({ id, ...data } as ConversionEventDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

function makeReservationsRepo(overrides: Partial<RepositoryAdapter<any>> = {}): RepositoryAdapter<any> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'res-1', ...data }),
    update: async (id, data) => ({ id, ...data }),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

function makeService(overrides = {}) {
  return new BookingengineService(
    makeConfigRepo(),
    makeAvailabilityRepo(),
    undefined, // roomsRepo: estos tests no ejercitan la disponibilidad real
    // F0 0.15 — StripeUseCase ahora opera sobre Reservations; el service requiere el repo.
    makeReservationsRepo(),
    undefined, // hotelsRepo
    makeBookingRepo(),
    makeEventsRepo(),
    log,
    silentCache,
    testRegistry,
  )
}

describe('BookingengineService', () => {
  describe('getConfig', () => {
    it('creates default config if none exists', async () => {
      const service = makeService()
      const config = await service.getConfig('hotel-1')
      expect(config.hotelId).toBe('hotel-1')
      expect(config.enabled).toBe(true)
    })
  })

  describe('checkAvailability', () => {
    it('returns empty room types when no data', async () => {
      const service = makeService()
      const result = await service.checkAvailability({
        hotelId: 'hotel-1',
        checkIn: '2026-07-01',
        checkOut: '2026-07-03',
      })
      expect(result.roomTypes).toEqual([])
      expect(result.nights).toBe(2)
    })
  })

  describe('trackEvent', () => {
    it('creates event', async () => {
      const service = makeService()
      const event = await service.trackEvent({
        hotelId: 'hotel-1',
        sessionId: 'session-1',
        event: 'search',
      })
      expect(event.id).toBe('event-1')
    })
  })
})
