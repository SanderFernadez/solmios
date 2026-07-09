// payments/tests/stripe-session.test.ts — Identidad Stripe del asiento.
//
// `create()` hardcodeaba `stripeSessionId: ''`, así que el dato nunca se persistía y los reintentos
// del webhook de Stripe no se podían deduplicar. Sin este campo, `findByStripeSession` es inútil.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { PaymentCrudUseCase } from '../usecases/payment-crud'
import type { PaymentDTO } from '../types'

const log = silentLogger()

function makeRepo(rows: PaymentDTO[] = []) {
  const created: Record<string, unknown>[] = []
  const repo = {
    create: async (d: any) => { created.push(d); return { id: 'pay1', ...d } },
    findMany: async (f: any) => rows.filter(r => Object.entries(f ?? {}).every(([k, v]) => (r as any)[k] === v)),
  } as unknown as RepositoryAdapter<PaymentDTO>
  return { repo, created }
}

const base = { hotelId: 'h1', type: 'charge' as const, method: 'link' as const, amount: 150 }

describe('PaymentCrudUseCase — identidad Stripe', () => {
  it('persiste stripeSessionId y stripePaymentId cuando llegan en el DTO', async () => {
    const { repo, created } = makeRepo()
    const crud = new PaymentCrudUseCase(repo, log)

    await crud.create({ ...base, status: 'completed', stripeSessionId: 'cs_1', stripePaymentId: 'pi_1' })

    expect(created[0].stripeSessionId).toBe('cs_1')
    expect(created[0].stripePaymentId).toBe('pi_1')
  })

  it('deja los campos Stripe vacíos en un cobro que no viene de Stripe', async () => {
    const { repo, created } = makeRepo()
    const crud = new PaymentCrudUseCase(repo, log)

    await crud.create({ ...base, method: 'cash' })

    expect(created[0].stripeSessionId).toBe('')
    expect(created[0].stripePaymentId).toBe('')
  })

  it('un cobro de Stripe entra completed y dispara el asiento', async () => {
    const { repo, created } = makeRepo()
    const crud = new PaymentCrudUseCase(repo, log)

    await crud.create({ ...base, status: 'completed', stripeSessionId: 'cs_1' })

    expect(created[0].status).toBe('completed')
    expect(created[0].processedAt).toBeTruthy()
  })
})

describe('PaymentCrudUseCase.findByStripeSession', () => {
  const row = { id: 'pay1', hotelId: 'h1', stripeSessionId: 'cs_1' } as PaymentDTO

  it('encuentra el asiento de una sesión ya cobrada', async () => {
    const { repo } = makeRepo([row])
    const crud = new PaymentCrudUseCase(repo, log)

    expect((await crud.findByStripeSession('h1', 'cs_1'))?.id).toBe('pay1')
  })

  it('no cruza hoteles: la sesión de otro hotel no es tuya', async () => {
    const { repo } = makeRepo([row])
    const crud = new PaymentCrudUseCase(repo, log)

    expect(await crud.findByStripeSession('h2', 'cs_1')).toBeNull()
  })

  it('sin sessionId no consulta y devuelve null', async () => {
    const { repo } = makeRepo([row])
    const crud = new PaymentCrudUseCase(repo, log)

    expect(await crud.findByStripeSession('h1', '')).toBeNull()
  })
})
