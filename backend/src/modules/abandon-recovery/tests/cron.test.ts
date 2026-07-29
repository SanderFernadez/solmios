// abandon-recovery/tests/cron.test.ts — Tests del factory del cron (F3 3.14).
//
// Cubre: cron outer try/catch (no rompe el setInterval), log de resultados, retorno del
// AbandonSweepResult. La lógica de sweep ya está cubierta en service.test.ts.
import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { createAbandonRecoveryCron, ABANDON_RECOVERY_TICK_MS } from '../../../shared/usecases/abandon-recovery-cron'
import type { AbandonRecoveryService } from '../service'
import type { AbandonSweepResult } from '../types'

const log = silentLogger()

function makeFakeService(runSweepImpl: () => Promise<AbandonSweepResult>): AbandonRecoveryService {
  return { runSweep: runSweepImpl } as unknown as AbandonRecoveryService
}

describe('createAbandonRecoveryCron', () => {
  it('ejecuta el sweep y retorna el resultado', async () => {
    const expected: AbandonSweepResult = { scanned: 3, emailed: 2, skipped: 1, errors: [] }
    const svc = makeFakeService(async () => expected)
    const cron = createAbandonRecoveryCron(svc, log)
    const result = await cron()
    expect(result).toEqual(expected)
  })

  it('no rompe si el service tira (cron-level try/catch)', async () => {
    const svc = makeFakeService(async () => { throw new Error('boom') })
    const cron = createAbandonRecoveryCron(svc, log)
    const result = await cron()
    expect(result.scanned).toBe(0)
    expect(result.emailed).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].reason).toContain('cron-level')
    expect(result.errors[0].reason).toContain('boom')
  })

  it('ABANDON_RECOVERY_TICK_MS es 30 minutos', () => {
    expect(ABANDON_RECOVERY_TICK_MS).toBe(30 * 60 * 1000)
  })
})
