// payments/tests/webhook-signature.test.ts
//
// La firma de un webhook es lo ÚNICO que separa "el huésped pagó" de "alguien mandó un POST
// diciendo que pagó". Este test levanta un servidor real y verifica las dos mitades:
// el evento legítimo entra, el falsificado no.
//
// Dos cosas tuvieron que arreglarse para que esto sea posible:
//   1. `req.rawBody` (arckode-framework 1.6.3): la firma se calcula sobre los bytes exactos y
//      el framework los descartaba al parsear el JSON — y el Router además no los propagaba.
//   2. `constructEventAsync`: bajo Bun, el `constructEvent` sincrónico lanza
//      "SubtleCryptoProvider cannot be used in a synchronous context" y rechaza TODO evento.
import { describe, it, expect, afterEach } from 'bun:test'
import { createHmac } from 'node:crypto'
import { NodeServer, Router, Logger } from 'arckode-framework'

const logger = new Logger('e2e', 'error')
let server: any = null
afterEach(async () => { await server?.stop(); server = null })

/** Firma un payload como lo hace Stripe: t=<ts>,v1=HMAC_SHA256(`${ts}.${payload}`, secret) */
function stripeSignature(payload: string, secret: string, ts: number): string {
  const sig = createHmac('sha256', secret).update(`${ts}.${payload}`, 'utf8').digest('hex')
  return `t=${ts},v1=${sig}`
}

describe('E2E: webhook Stripe con firma real', () => {
  it('constructEvent ACEPTA el evento firmado (esto era imposible antes del rawBody)', async () => {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe('sk_test_dummy', { apiVersion: '2025-08-27.basil' as any })
    const secret = 'whsec_test_secret'

    let verified: any = null
    let error: string | null = null

    const router = new Router()
    router.post('/api/webhooks/stripe/:hotelId', async (req: any) => {
      try {
        // Exactamente lo que hace el StripeGateway del proyecto:
        const event = await stripe.webhooks.constructEventAsync(req.rawBody, req.headers['stripe-signature'], secret)
        verified = { id: event.id, type: event.type, hotelId: req.params.hotelId }
      } catch (e: any) {
        error = e.message
      }
      return { status: 200, body: { ok: true } }
    })

    server = new NodeServer(0, logger)
    await server.start((req: any) => router.resolve(req.method, req.path, req))
    const base = `http://127.0.0.1:${server.getPort()}`

    const payload = JSON.stringify({
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', payment_status: 'paid', amount_total: 15000 } },
    })
    const ts = Math.floor(Date.now() / 1000)

    await fetch(`${base}/api/webhooks/stripe/hotel-abc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': stripeSignature(payload, secret, ts) },
      body: payload,
    })

    expect(error).toBeNull()
    expect(verified).not.toBeNull()
    expect(verified.id).toBe('evt_test_123')
    expect(verified.type).toBe('checkout.session.completed')
    expect(verified.hotelId).toBe('hotel-abc') // el hotel sale de la ruta
  })

  it('RECHAZA un webhook falsificado (alguien dice "ya pagué" sin pagar)', async () => {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe('sk_test_dummy', { apiVersion: '2025-08-27.basil' as any })
    const secret = 'whsec_test_secret'

    let accepted = false
    const router = new Router()
    router.post('/api/webhooks/stripe/:hotelId', async (req: any) => {
      try {
        await stripe.webhooks.constructEventAsync(req.rawBody, req.headers['stripe-signature'] || '', secret)
        accepted = true
      } catch { accepted = false }
      return { status: 200, body: { ok: true } }
    })

    server = new NodeServer(0, logger)
    await server.start((req: any) => router.resolve(req.method, req.path, req))
    const base = `http://127.0.0.1:${server.getPort()}`

    // Un impostor arma el evento a mano, sin el secreto.
    await fetch(`${base}/api/webhooks/stripe/hotel-abc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=firma_inventada' },
      body: JSON.stringify({ type: 'checkout.session.completed', data: { object: { payment_status: 'paid' } } }),
    })

    expect(accepted).toBe(false)
  })
})
