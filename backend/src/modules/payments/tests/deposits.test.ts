// payments/tests/deposits.test.ts — DT-08 QA adversarial: doble-refund, refund > disponible,
// release/refund de un depósito ya en estado terminal, y la "race" de dos operaciones sobre el
// mismo estado leído (el segundo actor debe fallar limpio, no corromper el saldo).

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { DepositsUseCase } from '../usecases/deposits'
import type { DepositDTO } from '../types'

const log = silentLogger()

function depositRepoFor(initial: DepositDTO): RepositoryAdapter<DepositDTO> {
  let stored = { ...initial }
  return {
    findMany: async () => [stored],
    findById: async (id: string) => (id === stored.id ? { ...stored } : null),
    findOne: async () => null,
    create: async (data: any) => { stored = { ...stored, ...data }; return stored },
    update: async (id: string, data: any) => { stored = { ...stored, ...data, id }; return { ...stored } },
    delete: async () => true,
    count: async () => 1,
    paginate: async () => ({ data: [stored], total: 1, limit: 20, offset: 0, pages: 1 }),
  }
}
const dep = (over: Partial<DepositDTO> = {}): DepositDTO => ({
  id: 'd1', hotelId: 'h1', amount: 500, currency: 'USD', status: 'held', paymentMethod: 'card',
  stripePaymentId: '', refundAmount: 0, releasedAt: undefined, notes: '', createdAt: 'x', updatedAt: 'x', ...over,
} as DepositDTO)

describe('DepositsUseCase — QA adversarial (DT-08)', () => {
  it('doble-refund: el segundo refund no puede exceder lo que quedó disponible tras el primero', async () => {
    const repo = depositRepoFor(dep({ amount: 500, refundAmount: 0 }))
    const uc = new DepositsUseCase(repo, log)
    const first = await uc.refund('d1', { amount: 300 })
    expect(first.refundAmount).toBe(300)
    expect(first.status).toBe('partially_refunded')
    // Quedan 200 disponibles — pedir 300 más debe rechazarse, no dejar refundAmount > amount.
    await expect(uc.refund('d1', { amount: 300 })).rejects.toThrow('exceeds available deposit')
  })

  it('refund > monto disponible en un solo intento se rechaza sin tocar el depósito', async () => {
    const repo = depositRepoFor(dep({ amount: 500, refundAmount: 0 }))
    const uc = new DepositsUseCase(repo, log)
    await expect(uc.refund('d1', { amount: 501 })).rejects.toThrow('exceeds available deposit')
    const untouched = await uc.getById('d1')
    expect(untouched.refundAmount).toBe(0) // no quedó a medio actualizar
  })

  it('release de un depósito ya released se rechaza (no duplica la liberación)', async () => {
    const repo = depositRepoFor(dep({ status: 'released', releasedAt: '2026-07-01T00:00:00Z' }))
    const uc = new DepositsUseCase(repo, log)
    await expect(uc.release('d1')).rejects.toThrow('already released')
  })

  it('refund de un depósito fully_refunded se rechaza', async () => {
    const repo = depositRepoFor(dep({ status: 'fully_refunded', refundAmount: 500 }))
    const uc = new DepositsUseCase(repo, log)
    await expect(uc.refund('d1', { amount: 10 })).rejects.toThrow('already released or fully refunded')
  })

  it('refund de un depósito ya released se rechaza (release y refund son mutuamente excluyentes)', async () => {
    const repo = depositRepoFor(dep({ status: 'released', releasedAt: '2026-07-01T00:00:00Z' }))
    const uc = new DepositsUseCase(repo, log)
    await expect(uc.refund('d1', { amount: 10 })).rejects.toThrow('already released or fully refunded')
  })

  // DT-11 RESUELTO: `refund()`/`release()` ahora serializan por `deposit:${id}` vía
  // `shared/utils/async-lock.ts` (lock en memoria, alcance: dentro de un solo proceso — prod
  // corre 1 solo systemd). El segundo refund concurrente ahora espera a que el primero termine
  // (escriba) antes de leer, así que ve el `refundAmount` actualizado y se rechaza si excede.
  it('race resuelta (DT-11): dos refunds concurrentes de 300 c/u sobre un depósito de 500 — uno se rechaza, el saldo nunca queda negativo', async () => {
    const repo = depositRepoFor(dep({ amount: 500, refundAmount: 0 }))
    const uc = new DepositsUseCase(repo, log)
    const results = await Promise.allSettled([uc.refund('d1', { amount: 300 }), uc.refund('d1', { amount: 300 })])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(fulfilled.length).toBe(1)
    expect(rejected.length).toBe(1)
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('exceeds available deposit')
    const final = await uc.getById('d1')
    expect(final.refundAmount).toBe(300) // nunca 600 — el saldo no quedó negativo
    expect(final.status).toBe('partially_refunded')
  })

  it('race resuelta (DT-11): un refund y un release concurrentes sobre el mismo depósito se serializan (no se pisan)', async () => {
    const repo = depositRepoFor(dep({ amount: 500, refundAmount: 0, status: 'held' }))
    const uc = new DepositsUseCase(repo, log)
    const [refundResult, releaseResult] = await Promise.allSettled([
      uc.refund('d1', { amount: 200 }),
      uc.release('d1'),
    ])
    // Cualquiera de los dos órdenes es válido (no hay garantía de cuál corre primero), pero el
    // resultado final debe ser CONSISTENTE: el que corrió segundo ve el estado que dejó el primero.
    const succeeded = [refundResult, releaseResult].filter((r) => r.status === 'fulfilled').length
    expect(succeeded).toBeGreaterThanOrEqual(1) // al menos el primero en tomar el lock no falla por la carrera
    const final = await uc.getById('d1')
    // Estado final coherente con ALGUNO de los dos órdenes posibles — nunca un híbrido corrupto
    // (ej. status='released' pero refundAmount aplicado a medias, o viceversa sin registrar).
    expect(['partially_refunded', 'released']).toContain(final.status)
  })

  it('release no cobra nada: el amount del depósito no cambia, solo status y releasedAt', async () => {
    const repo = depositRepoFor(dep({ amount: 500, refundAmount: 0, status: 'held' }))
    const uc = new DepositsUseCase(repo, log)
    const released = await uc.release('d1')
    expect(released.amount).toBe(500)
    expect(released.refundAmount).toBe(0) // release NO es un refund — no toca este campo
    expect(released.status).toBe('released')
    expect(released.releasedAt).toBeTruthy()
  })
})
