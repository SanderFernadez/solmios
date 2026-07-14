// payments/tests/service.test.ts — Tests del servicio
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { PaymentsService } from '../service'
import type { PaymentDTO, PaymentLinkDTO, DepositDTO } from '../types'
import { PaymentGatewayRegistry } from '../../../services/payment-gateway/registry'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

// Registry de pasarelas: estos tests no cobran por pasarela, pero el service lo exige para que
// NINGUNA operación de dinero pueda correr sin decir de qué hotel es (multi-tenancy).
const emptyGatewayRepo: any = { findMany: async () => [], findById: async () => null, create: async (d: any) => d, update: async () => {}, delete: async () => {}, count: async () => 0 }
const testRegistry = new PaymentGatewayRegistry(emptyGatewayRepo, log)

function makeRepo(overrides: Partial<RepositoryAdapter<any>> = {}): RepositoryAdapter<any> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data }),
    update: async (id, data) => ({ id, ...data }),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('PaymentsService', () => {
  describe('getPayment', () => {
    it('lanza NotFound si el item no existe', async () => {
      const service = new PaymentsService(makeRepo(), makeRepo(), makeRepo(), log, silentCache, undefined, undefined, testRegistry)
      await expect(service.getPayment('no-existe')).rejects.toThrow('Payment not found')
    })

    it('retorna el item si existe', async () => {
      const item = { id: '1', amount: 100, currency: 'USD', method: 'card', status: 'completed', hotelId: 'h1' } as PaymentDTO
      const service = new PaymentsService(makeRepo({ findById: async () => item }), makeRepo(), makeRepo(), log, silentCache, undefined, undefined, testRegistry)
      const result = await service.getPayment('1')
      expect(result.amount).toBe(100)
    })
  })

  describe('createPayment', () => {
    it('crea un pago de stripe', async () => {
      const service = new PaymentsService(makeRepo(), makeRepo(), makeRepo(), log, silentCache, undefined, undefined, testRegistry)
      const result = await service.createPayment({
        hotelId: 'h1',
        amount: 150,
        currency: 'USD',
        method: 'card',
        type: 'charge',
        description: 'Test payment',
      })
      expect(result.id).toBe('test-id')
      expect(result.status).toBe('pending')
    })
  })

  describe('listPayments', () => {
    it('retorna paginación vacía', async () => {
      const service = new PaymentsService(makeRepo(), makeRepo(), makeRepo(), log, silentCache, undefined, undefined, testRegistry)
      const result = await service.listPayments({ hotelId: 'h1' })
      expect(result.data).toEqual([])
    })
  })

  describe('getPaymentLinkByToken', () => {
    it('lanza NotFound si el token no existe', async () => {
      const service = new PaymentsService(makeRepo(), makeRepo(), makeRepo(), log, silentCache, undefined, undefined, testRegistry)
      await expect(service.getPaymentLinkByToken('invalid-token')).rejects.toThrow('Payment link not found')
    })
  })

  describe('createPaymentLink', () => {
    it('crea un link de pago', async () => {
      const service = new PaymentsService(makeRepo(), makeRepo(), makeRepo(), log, silentCache, undefined, undefined, testRegistry)
      const result = await service.createPaymentLink({
        hotelId: 'h1',
        amount: 200,
        description: 'Pago de reserva',
      })
      expect(result.token).toBeDefined()
      expect(result.amount).toBe(200)
    })
  })

  describe('createDeposit', () => {
    it('crea un depósito', async () => {
      const service = new PaymentsService(makeRepo(), makeRepo(), makeRepo(), log, silentCache, undefined, undefined, testRegistry)
      const result = await service.createDeposit({
        hotelId: 'h1',
        amount: 500,
        holdReason: 'Daño potencial',
        paymentMethod: 'card',
      })
      expect(result.status).toBe('held')
      expect(result.amount).toBe(500)
    })
  })
})
