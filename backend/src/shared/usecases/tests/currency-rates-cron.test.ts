// shared/usecases/tests/currency-rates-cron.test.ts — F2 2.7 (spec booking-widget, D10).
//
// Cubre el cron de tasas de cambio. Tests a nivel factory + fetcher inyectable (sin red).
//
// Aceptancia (tasks.md 2.7):
//  - tras correr el cron, configuration('currency_rates') tiene {base:'USD', rates:{...}}.
//  - sin OPENEXCHANGERATES_APP_ID → skip silencioso con log (no rompe).
//
// Casos:
//  (1) Happy path — fetch OK → upsert en configuration(key='currency_rates').
//  (2) Sin APP_ID → updated=false, reason='no_app_id'.
//  (3) Fetch falla → updated=false, reason='fetch_failed', no pisa config.
//  (4) Response inválido (sin rates) → updated=false, reason='invalid_response'.
//  (5) Idempotente — 2da corrida hace UPDATE (no CREATE duplicado).
//  (6) Valor guardado tiene shape {base, rates, fetchedAt, source}.
import { describe, it, expect } from 'bun:test'
import { createCurrencyRatesCron } from '../currency-rates-cron'

function makeOrm(existingConfigRow: any | null) {
  const state: { row: any | null } = { row: existingConfigRow }
  const created: any[] = []
  const updated: any[] = []
  const orm: any = {
    findMany: async () => (state.row ? [state.row] : []),
    create: async (_model: string, payload: any) => {
      const row = { id: 'cfg-1', ...payload }
      created.push(row)
      state.row = row
      return row
    },
    update: async (_model: string, id: string, patch: any) => {
      updated.push({ id, patch })
      if (state.row) Object.assign(state.row, patch)
      return null
    },
  }
  return { orm, created, updated, state }
}

const fakeLogger = { info: () => {}, warn: () => {} }

describe('createCurrencyRatesCron — F2 2.7', () => {
  it('happy path: fetch OK → upsert configuration(currency_rates)', async () => {
    const { orm, created, updated } = makeOrm(null)
    const fetcher = async () => ({
      base: 'USD',
      rates: { USD: 1, EUR: 0.92, DOP: 58 },
    })
    const cron = createCurrencyRatesCron(orm, fakeLogger, fetcher, 'test-app-id')
    const result = await cron()

    expect(result.updated).toBe(true)
    expect(result.count).toBe(3)
    expect(result.base).toBe('USD')
    expect(created).toHaveLength(1)
    expect(updated).toHaveLength(0) // no existía → create, no update
    expect(created[0].key).toBe('currency_rates')
    expect(created[0].hotelId).toBe('platform')
    expect(created[0].value.base).toBe('USD')
    expect(created[0].value.rates.EUR).toBe(0.92)
    expect(created[0].value.source).toBe('openexchangerates')
    expect(typeof created[0].value.fetchedAt).toBe('string')
  })

  it('sin APP_ID → updated=false, reason=no_app_id', async () => {
    const { orm, created } = makeOrm(null)
    let fetched = false
    const cron = createCurrencyRatesCron(orm, fakeLogger, async () => { fetched = true; return { base: 'USD', rates: {} } }, undefined)
    const result = await cron()
    expect(result.updated).toBe(false)
    expect(result.reason).toBe('no_app_id')
    expect(fetched).toBe(false) // ni siquiera llamó al fetcher
    expect(created).toHaveLength(0)
  })

  it('fetch falla → updated=false, reason=fetch_failed, no pisa config', async () => {
    const existingRow = { id: 'old-1', value: { base: 'USD', rates: { USD: 1, EUR: 0.9 }, fetchedAt: '2020-01-01' } }
    const { orm, created, updated } = makeOrm(existingRow)
    const cron = createCurrencyRatesCron(orm, fakeLogger, async () => {
      throw new Error('network down')
    }, 'test-app-id')
    const result = await cron()
    expect(result.updated).toBe(false)
    expect(result.reason).toBe('fetch_failed')
    expect(created).toHaveLength(0)
    expect(updated).toHaveLength(0) // no se tocó la config vieja
    // La config vieja sigue igual.
    expect(existingRow.value.fetchedAt).toBe('2020-01-01')
  })

  it('response inválido (sin rates) → updated=false, reason=invalid_response', async () => {
    const { orm, created } = makeOrm(null)
    const cron = createCurrencyRatesCron(orm, fakeLogger, async () => ({
      base: 'USD', rates: { USD: 1 }, // solo 1 moneda → inválido
    }), 'test-app-id')
    const result = await cron()
    expect(result.updated).toBe(false)
    expect(result.reason).toBe('invalid_response')
    expect(created).toHaveLength(0)
  })

  it('idempotente: 2da corrida hace UPDATE (no CREATE duplicado)', async () => {
    const { orm, created, updated } = makeOrm(null)
    const fetcher = async () => ({ base: 'USD', rates: { USD: 1, EUR: 0.92 } })
    const cron = createCurrencyRatesCron(orm, fakeLogger, fetcher, 'test-app-id')

    await cron()
    expect(created).toHaveLength(1)
    expect(updated).toHaveLength(0)

    await cron()
    expect(created).toHaveLength(1) // no se creó otro
    expect(updated).toHaveLength(1) // esta vez hizo update
    expect(updated[0].patch.value.rates.EUR).toBe(0.92)
  })

  it('acepta APP_ID de process.env cuando no se pasa explícito', async () => {
    const oldAppId = process.env.OPENEXCHANGERATES_APP_ID
    process.env.OPENEXCHANGERATES_APP_ID = 'from-env'
    try {
      const { orm, created } = makeOrm(null)
      let receivedAppId = ''
      const fetcher = async (appId: string) => {
        receivedAppId = appId
        return { base: 'USD', rates: { USD: 1, EUR: 0.9 } }
      }
      const cron = createCurrencyRatesCron(orm, fakeLogger, fetcher) // sin 4o arg
      const result = await cron()
      expect(result.updated).toBe(true)
      expect(receivedAppId).toBe('from-env')
      expect(created).toHaveLength(1)
    } finally {
      if (oldAppId === undefined) delete process.env.OPENEXCHANGERATES_APP_ID
      else process.env.OPENEXCHANGERATES_APP_ID = oldAppId
    }
  })
})
