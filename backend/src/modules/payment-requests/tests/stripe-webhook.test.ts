// payment-requests/tests/stripe-webhook.test.ts — Guardian de saldo del folio en el webhook.
//
// Regresión: `applyPaymentBridge` escribía el cargo `kind:'payment'` directo al repo, sin pasar
// por el guardián de `folio-entries.ts`. Un PaymentRequest de $100 sobre un folio con $20 de saldo
// (porque el huésped ya había pagado $80 en efectivo, p.ej.) dejaba el folio en negativo. Acá se
// prueba tanto el caso bloqueado (no escribe) como el happy path (escribe normalmente).

import { describe, it, expect, mock, beforeEach, afterAll } from 'bun:test'
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'

// ─── Mock de StripeService (antes del import del usecase) ────────────────────
// El webhook valida la firma con `StripeService.verifyWebhook` y chequea `isConfigured`. Como es
// un modulo importado directamente, se intercepta con mock.module para controlar ambos. El mock
// devuelve una sesión `checkout.session.completed` con metadata estándar (paymentRequestId 'pr1',
// reservationId 'r1', hotelId 'h1'); cada test puedeoverridear el amount_total o el metadata.
let nextSession: any = {
  id: 'cs_test_123',
  amount_total: 10000,
  payment_intent: 'pi_test_456',
  metadata: { paymentRequestId: 'pr1', reservationId: 'r1', hotelId: 'h1' },
}
const verifyWebhookMock = mock(async () => ({
  type: 'checkout.session.completed',
  data: { object: nextSession },
}))
// `mock.module` es GLOBAL al proceso de bun test: el módulo queda reemplazado
// para todos los archivos que corran después, no solo para este. Reemplazarlo
// entero dejaba a `StripeService` sin el resto de sus métodos y los tests de
// `service.test.ts` reventaban con "getConfig is not a function" según el orden
// de ejecución. Se parte del módulo real y solo se pisa lo que este test simula.
const actualStripe = await import('../../../services/stripe-service')
const realStripeService = { ...actualStripe.StripeService }
mock.module('../../../services/stripe-service', () => ({
  ...actualStripe,
  StripeService: {
    ...realStripeService,
    isConfigured: async () => true,
    verifyWebhook: verifyWebhookMock,
  },
}))

// Devolver el módulo a su estado real al terminar. Sin esto, el `isConfigured`
// simulado acá sobrevive al archivo y los tests que corran después creen que
// Stripe está configurado cuando no lo está.
afterAll(() => {
  mock.module('../../../services/stripe-service', () => ({
    ...actualStripe,
    StripeService: realStripeService,
  }))
})

import { processStripeWebhook } from '../usecases/stripe-webhook'
import type { WebhookDeps } from '../usecases/stripe-webhook'
import type { PaymentRequestDTO } from '../types'

const log = silentLogger()

function makeRepo<T extends object>(ov: Partial<RepositoryAdapter<T>> = {}): RepositoryAdapter<T> {
  return {
    findMany: async () => [], findById: async () => null, findOne: async () => null,
    create: async (d: any) => ({ id: 'x1', ...d } as T),
    update: async (id: any, d: any) => ({ id, ...d } as T),
    delete: async () => true, count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...ov,
  } as RepositoryAdapter<T>
}

/**
 * Construye los deps del webhook con repos que capturan lo que se escribe.
 * `opts.prStatus` controla si el PR está pendiente (para que el handler entre al flujo).
 * `opts.folioCharges` precarga las líneas que ya tiene el folio (para armar el saldo).
 * `opts.paymentPort` permite inyectar el puerto (por defecto: ya asentado => alreadyRecorded=false).
 */
function makeDeps(opts: {
  pr?: Partial<PaymentRequestDTO>
  folioCharges?: any[]
  paymentPort?: any
  logger?: Logger
} = {}): { deps: WebhookDeps; folioChargeCreates: any[]; reservationUpdates: any[] } {
  const folioChargeCreates: any[] = []
  const reservationUpdates: any[] = []

  const pr: PaymentRequestDTO = {
    id: 'pr1', hotelId: 'h1', reservationId: 'r1', amount: 100,
    currency: 'USD', status: 'pending', sentTo: 'guest@x.com', sentVia: 'email',
    ...opts.pr,
  }
  const repo = makeRepo<PaymentRequestDTO>({ findById: async () => pr })
  const reservationRepo = makeRepo<any>({
    findMany: async (f: any) => f?.id === 'r1' ? [{ id: 'r1', hotelId: 'h1', deposit: 0, totalAmount: 100, status: 'pending' }] : [],
    update: async (id: any, d: any) => { reservationUpdates.push({ id, ...d }); return { id, ...d } },
  })
  const folioRepo = makeRepo<any>({
    findMany: async (f: any) => f?.reservationId === 'r1' ? [{ id: 'f1', hotelId: 'h1', reservationId: 'r1', status: 'open' }] : [],
  })
  const folioChargeRepo = makeRepo<any>({
    findMany: async (f: any) => f?.folioId === 'f1' ? (opts.folioCharges ?? []) : [],
    create: async (d: any) => { folioChargeCreates.push(d); return { id: 'fc-new', ...d } },
  })

  const paymentPort = opts.paymentPort ?? {
    findBySession: async () => null, // aún no asentado → el webhook entra al bridge
    recordPayment: async () => ({ id: 'pay1', status: 'completed' }),
  }

  return {
    deps: {
      repo, reservationRepo, folioRepo, folioChargeRepo,
      logger: opts.logger ?? log, sockets: {}, paymentPort,
    },
    folioChargeCreates,
    reservationUpdates,
  }
}

describe('processStripeWebhook — guardián de saldo del folio', () => {
  beforeEach(() => {
    verifyWebhookMock.mockClear()
    // Reset al session default entre tests (algunos tests lo mutan).
    nextSession = {
      id: 'cs_test_123',
      amount_total: 10000,
      payment_intent: 'pi_test_456',
      metadata: { paymentRequestId: 'pr1', reservationId: 'r1', hotelId: 'h1' },
    }
  })

  it('happy path: monto <= saldo → escribe el cargo normalmente', async () => {
    // PR.amount = 100 (amount_total en centavos = 10000). Folio tiene $100 de cargo y $0 pagos
    // → balance = 100. El pago de $100 entra justo.
    const { deps, folioChargeCreates, reservationUpdates } = makeDeps({
      folioCharges: [
        { id: 'c1', folioId: 'f1', kind: 'charge', total: 100 },
      ],
    })

    const result = await processStripeWebhook(deps, 'h1', 'raw-body', 'sig')

    expect(result.received).toBe(true)
    expect(folioChargeCreates).toHaveLength(1)
    expect(folioChargeCreates[0].kind).toBe('payment')
    expect(Number(folioChargeCreates[0].total)).toBe(-100)
    expect(folioChargeCreates[0].source).toBe('stripe')
    // La reserva también recibió el patch de depósito.
    expect(reservationUpdates).toHaveLength(1)
    expect(Number(reservationUpdates[0].deposit)).toBe(100)
  })

  it('regresión: monto > saldo → NO escribe cargo (foliar negativo evitado)', async () => {
    // PR.amount = 100. Folio tiene $100 de cargos y $80 de pagos previos → balance = 20.
    // Un cargo de -$100 dejaría el folio en -$80. El guardián debe bloquearlo.
    const { deps, folioChargeCreates, reservationUpdates } = makeDeps({
      folioCharges: [
        { id: 'c1', folioId: 'f1', kind: 'charge', total: 100 },
        { id: 'p1', folioId: 'f1', kind: 'payment', total: -80 },
      ],
    })

    const result = await processStripeWebhook(deps, 'h1', 'raw-body', 'sig')

    // El webhook NO rompe: devuelve received=true (Stripe no reintenta un evento que técnicamente
    // procesó — el dinero ya está asentado en `payments`; el over-payment queda para reconciliación
    // manual).
    expect(result.received).toBe(true)
    // Clave: NO se creó ningún cargo foliar con amount > saldo.
    expect(folioChargeCreates).toHaveLength(0)
    // La reserva igual recibe el depósito (tiene su propio Math.max(0,…)) — no se rompe el puente.
    expect(reservationUpdates).toHaveLength(1)
    expect(Number(reservationUpdates[0].deposit)).toBe(100)
  })

  it('regresión: monto levemente mayor al saldo dentro de epsilon → acepta (tolerancia centavos)', async () => {
    // PR.amount = 100. Folio tiene charge +100 y pago previo -0.01 → balance = 99.99.
    // amountPaid (100) > balance (99.99) por 0.01, que es <= BALANCE_EPSILON → el guardián acepta
    // (no bloquea por diferencias de redondeo de centavos).
    const { deps, folioChargeCreates } = makeDeps({
      folioCharges: [
        { id: 'c1', folioId: 'f1', kind: 'charge', total: 100 },
        { id: 'p1', folioId: 'f1', kind: 'payment', total: -0.01 },
      ],
    })

    const result = await processStripeWebhook(deps, 'h1', 'raw-body', 'sig')

    expect(result.received).toBe(true)
    expect(folioChargeCreates).toHaveLength(1)
    expect(Number(folioChargeCreates[0].total)).toBe(-100)
  })

  it('idempotencia: cobro ya asentado → no llama al bridge (no duplica cargos)', async () => {
    // paymentPort.findBySession devuelve un payment existente → alreadyRecorded=true → el bridge
    // no se ejecuta. Asegura que el guardián no rompa la barrera de idempotencia previa.
    const { deps, folioChargeCreates, reservationUpdates } = makeDeps({
      paymentPort: {
        findBySession: async () => ({ id: 'pay-existente', status: 'completed' }),
        recordPayment: async () => ({ id: 'pay2', status: 'completed' }),
      },
      folioCharges: [{ id: 'c1', folioId: 'f1', kind: 'charge', total: 100 }],
    })

    const result = await processStripeWebhook(deps, 'h1', 'raw-body', 'sig')

    expect(result.received).toBe(true)
    expect(folioChargeCreates).toHaveLength(0)
    expect(reservationUpdates).toHaveLength(0)
  })

  it('sin folio abierto → no escribe cargo foliar (comportamiento previo preservado)', async () => {
    // Ni el session.metadata ni el PR tienen reservationId → findOpenFolio devuelve null y el
    // bridge hace return temprano. Verifica que el guardián no rompe el flujo sin folio.
    nextSession.metadata = { paymentRequestId: 'pr1', hotelId: 'h1' } // sin reservationId
    const { deps, folioChargeCreates, reservationUpdates } = makeDeps({
      pr: { id: 'pr1', hotelId: 'h1', reservationId: '', amount: 100, currency: 'USD', status: 'pending' },
      folioCharges: [],
    })

    const result = await processStripeWebhook(deps, 'h1', 'raw-body', 'sig')

    expect(result.received).toBe(true)
    expect(folioChargeCreates).toHaveLength(0)
    expect(reservationUpdates).toHaveLength(0)
  })
})
