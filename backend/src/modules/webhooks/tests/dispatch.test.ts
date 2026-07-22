// webhooks/tests/dispatch.test.ts — dispatcher: filtra por evento suscrito, firma HMAC correcta,
// 3 reintentos con backoff si falla, registra el resultado FINAL en webhook_deliveries.

import { describe, it, expect } from 'bun:test'
import { createHmac } from 'crypto'
import { silentLogger } from 'arckode-framework/testing'
import type { RepositoryAdapter } from 'arckode-framework'
import { dispatchWebhookEvent, testWebhookSubscription, type DispatchDeps } from '../usecases/dispatch'
import type { WebhookSubscriptionDTO, WebhookDeliveryDTO } from '../types'

const log = silentLogger()
const noSleep = async () => {}
/** `partner.example.com` no resuelve en DNS real — inyectamos una IP pública fija para no depender de red. */
const publicLookup = async () => ['93.184.216.34']

function makeSubRepo(subs: WebhookSubscriptionDTO[]): RepositoryAdapter<WebhookSubscriptionDTO> {
  return {
    findMany: async (filters) => subs.filter((s) => {
      if ((filters as any)?.hotelId && s.hotelId !== (filters as any).hotelId) return false
      if ((filters as any)?.active !== undefined && s.active !== (filters as any).active) return false
      return true
    }),
    findById: async (id) => subs.find((s) => s.id === id) ?? null,
    findOne: async () => null,
    create: async (data) => ({ id: 'x', ...data } as WebhookSubscriptionDTO),
    update: async (id, data) => ({ id, ...data } as WebhookSubscriptionDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  }
}

function makeDeliveryRepo(sink: WebhookDeliveryDTO[]): RepositoryAdapter<WebhookDeliveryDTO> {
  return {
    findMany: async () => sink,
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => { const row = { id: `del-${sink.length + 1}`, ...data } as WebhookDeliveryDTO; sink.push(row); return row },
    update: async (id, data) => ({ id, ...data } as WebhookDeliveryDTO),
    delete: async () => true,
    count: async () => sink.length,
    paginate: async () => ({ data: sink, total: sink.length, limit: 20, offset: 0, pages: 1 }),
  }
}

const sub: WebhookSubscriptionDTO = {
  id: 'wh-1', hotelId: 'hotel-1', url: 'https://partner.example.com/hook',
  events: ['reservation.created'], secret: 'whsec_test_secret', active: 1,
  createdAt: '', updatedAt: '',
}

describe('dispatchWebhookEvent', () => {
  it('solo entrega a subscriptions que escuchan ese evento', async () => {
    const otherSub: WebhookSubscriptionDTO = { ...sub, id: 'wh-2', events: ['reservation.checked_out'] }
    const deliveries: WebhookDeliveryDTO[] = []
    const calls: string[] = []
    const deps: DispatchDeps = {
      subscriptionRepo: makeSubRepo([sub, otherSub]),
      deliveryRepo: makeDeliveryRepo(deliveries),
      logger: log,
      lookupImpl: publicLookup,
      sleepImpl: noSleep,
      fetchImpl: (async (url: any) => { calls.push(String(url)); return new Response(null, { status: 200 }) }) as any,
    }
    await dispatchWebhookEvent(deps, 'hotel-1', 'reservation.created', { id: 'r1' })
    expect(calls).toHaveLength(1)
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0].success).toBe(1)
  })

  it('firma el body con HMAC-SHA256 del secret de ESA subscription', async () => {
    const deliveries: WebhookDeliveryDTO[] = []
    let capturedSignature = ''
    let capturedBody = ''
    const deps: DispatchDeps = {
      subscriptionRepo: makeSubRepo([sub]),
      deliveryRepo: makeDeliveryRepo(deliveries),
      logger: log,
      lookupImpl: publicLookup,
      sleepImpl: noSleep,
      fetchImpl: (async (_url: any, init: any) => {
        capturedSignature = init.headers['x-solmios-signature']
        capturedBody = init.body
        return new Response(null, { status: 200 })
      }) as any,
    }
    await dispatchWebhookEvent(deps, 'hotel-1', 'reservation.created', { id: 'r1' })
    const expected = createHmac('sha256', sub.secret as string).update(capturedBody).digest('hex')
    expect(capturedSignature).toBe(expected)
  })

  it('reintenta 3 veces con backoff si la respuesta no es 2xx, y registra el resultado final', async () => {
    const deliveries: WebhookDeliveryDTO[] = []
    let attempts = 0
    const sleeps: number[] = []
    const deps: DispatchDeps = {
      subscriptionRepo: makeSubRepo([sub]),
      deliveryRepo: makeDeliveryRepo(deliveries),
      logger: log,
      lookupImpl: publicLookup,
      sleepImpl: async (ms: number) => { sleeps.push(ms) },
      fetchImpl: (async () => { attempts++; return new Response(null, { status: 500 }) }) as any,
    }
    await dispatchWebhookEvent(deps, 'hotel-1', 'reservation.created', { id: 'r1' })
    expect(attempts).toBe(4) // 1 intento inicial + 3 reintentos
    expect(sleeps).toEqual([1000, 3000, 9000])
    expect(deliveries).toHaveLength(1) // UN solo registro (el resultado final), no uno por intento
    expect(deliveries[0].success).toBe(0)
    expect(deliveries[0].statusCode).toBe(500)
  })

  it('deja de reintentar apenas hay un 2xx', async () => {
    const deliveries: WebhookDeliveryDTO[] = []
    let attempts = 0
    const deps: DispatchDeps = {
      subscriptionRepo: makeSubRepo([sub]),
      deliveryRepo: makeDeliveryRepo(deliveries),
      logger: log,
      lookupImpl: publicLookup,
      sleepImpl: noSleep,
      fetchImpl: (async () => { attempts++; return new Response(null, { status: attempts < 2 ? 503 : 200 }) }) as any,
    }
    await dispatchWebhookEvent(deps, 'hotel-1', 'reservation.created', { id: 'r1' })
    expect(attempts).toBe(2)
    expect(deliveries[0].success).toBe(1)
  })

  it('trata errores de red como fallo y también reintenta', async () => {
    const deliveries: WebhookDeliveryDTO[] = []
    let attempts = 0
    const deps: DispatchDeps = {
      subscriptionRepo: makeSubRepo([sub]),
      deliveryRepo: makeDeliveryRepo(deliveries),
      logger: log,
      lookupImpl: publicLookup,
      sleepImpl: noSleep,
      fetchImpl: (async () => { attempts++; throw new Error('ECONNREFUSED') }) as any,
    }
    await dispatchWebhookEvent(deps, 'hotel-1', 'reservation.created', { id: 'r1' })
    expect(attempts).toBe(4)
    expect(deliveries[0].success).toBe(0)
    expect(deliveries[0].statusCode).toBeUndefined()
  })

  it('bloquea la entrega si la URL resuelve a una IP privada (SSRF) y la registra como fallo', async () => {
    const internalSub: WebhookSubscriptionDTO = { ...sub, id: 'wh-internal', url: 'http://internal.attacker.test/hook' }
    const deliveries: WebhookDeliveryDTO[] = []
    let calls = 0
    const deps: DispatchDeps = {
      subscriptionRepo: makeSubRepo([internalSub]),
      deliveryRepo: makeDeliveryRepo(deliveries),
      logger: log,
      sleepImpl: noSleep,
      lookupImpl: async () => ['10.0.0.5'], // IP privada — DNS rebinding simulado
      fetchImpl: (async () => { calls++; return new Response(null, { status: 200 }) }) as any,
    }
    await dispatchWebhookEvent(deps, 'hotel-1', 'reservation.created', { id: 'r1' })
    expect(calls).toBe(0) // nunca llega a hacer fetch
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0].success).toBe(0)
  })

  it('no entrega a subscriptions inactivas ni de otro hotel', async () => {
    const inactive: WebhookSubscriptionDTO = { ...sub, id: 'wh-inactive', active: 0 }
    const otherHotel: WebhookSubscriptionDTO = { ...sub, id: 'wh-other-hotel', hotelId: 'hotel-2' }
    const deliveries: WebhookDeliveryDTO[] = []
    let calls = 0
    const deps: DispatchDeps = {
      subscriptionRepo: makeSubRepo([sub, inactive, otherHotel]),
      deliveryRepo: makeDeliveryRepo(deliveries),
      logger: log,
      lookupImpl: publicLookup,
      sleepImpl: noSleep,
      fetchImpl: (async () => { calls++; return new Response(null, { status: 200 }) }) as any,
    }
    await dispatchWebhookEvent(deps, 'hotel-1', 'reservation.created', { id: 'r1' })
    expect(calls).toBe(1)
  })
})

describe('testWebhookSubscription', () => {
  it('entrega un evento "ping" a la subscription puntual SIN filtrar por su lista de events', async () => {
    const subWithoutPing: WebhookSubscriptionDTO = { ...sub, events: ['reservation.created'] } // no incluye "ping"
    const deliveries: WebhookDeliveryDTO[] = []
    let called = false
    const deps: DispatchDeps = {
      subscriptionRepo: makeSubRepo([subWithoutPing]),
      deliveryRepo: makeDeliveryRepo(deliveries),
      logger: log,
      lookupImpl: publicLookup,
      sleepImpl: noSleep,
      fetchImpl: (async () => { called = true; return new Response(null, { status: 200 }) }) as any,
    }
    await testWebhookSubscription(deps, subWithoutPing)
    expect(called).toBe(true)
    expect(deliveries[0].event).toBe('ping')
  })
})
