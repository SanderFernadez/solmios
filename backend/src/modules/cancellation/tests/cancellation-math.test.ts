// cancellation/tests/cancellation-math.test.ts — Tests del cálculo de políticas (F1 plan #627).
// Funciones PURAS: sin SQLite/Postgres, sin red. Mock mínimo de RepositoryAdapter.findMany.
// Cubre computePenalty (todos los presets + edge cases) y resolvePolicy (precedencia completa).

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import type { CancellationPolicyDTO } from '../types'
import {
  computePenalty, resolvePolicy, presetFromEnum, PRESET_TIERS,
  type ResolvedPolicy,
} from '../../../shared/usecases/cancellation-math'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const NOW = '2026-08-02T12:00:00.000Z'

function checkInAt(hoursFromNow: number): string {
  return new Date(Date.parse(NOW) + hoursFromNow * 3_600_000).toISOString()
}

/** Repo mock que devuelve el array dado para cualquier findMany. */
function mockRepo(policies: CancellationPolicyDTO[]): RepositoryAdapter<CancellationPolicyDTO> {
  return {
    findMany: async () => policies,
    findById: async () => null,
    findOne: async () => null,
    create: async () => ({}) as any,
    update: async () => ({}) as any,
    delete: async () => true,
    count: async () => policies.length,
    paginate: async () => ({ data: policies, total: policies.length, limit: 20, offset: 0, pages: 1 }),
  } as RepositoryAdapter<CancellationPolicyDTO>
}

function policy(partial: Partial<CancellationPolicyDTO>): CancellationPolicyDTO {
  return {
    id: 'p-' + Math.random().toString(36).slice(2, 8),
    hotelId: 'h1', scope: 'base', scopeId: '', name: '',
    tiers: [], priority: 0, active: true,
    createdAt: NOW, updatedAt: NOW,
    ...partial,
  }
}

// ─── computePenalty ──────────────────────────────────────────────────────────
describe('computePenalty', () => {
  describe('preset flexible', () => {
    it('7d antes → 0% penalty, refundAmount = depósito completo', () => {
      const res = computePenalty(
        { tiers: presetFromEnum('flexible'), policyId: 'flexible', source: 'preset' },
        { now: NOW, checkIn: checkInAt(24 * 7), depositAmount: 100 },
      )
      expect(res.penaltyPercent).toBe(0)
      expect(res.refundable).toBe(true)
      expect(res.refundAmount).toBe(100)
      expect(res.cancellationFee).toBe(0)
    })

    it('1h antes → sigue 0% (flexible = gratis hasta el checkIn)', () => {
      const res = computePenalty(
        { tiers: presetFromEnum('flexible'), policyId: 'flexible', source: 'preset' },
        { now: NOW, checkIn: checkInAt(1), depositAmount: 100 },
      )
      expect(res.penaltyPercent).toBe(0)
      expect(res.refundAmount).toBe(100)
    })
  })

  describe('preset moderate', () => {
    // moderate = [{72h, 0%}, {0h, 50%}]
    it('>72h antes (ej 96h) → 0% (deadline 72h)', () => {
      const res = computePenalty(
        { tiers: presetFromEnum('moderate'), policyId: 'moderate', source: 'preset' },
        { now: NOW, checkIn: checkInAt(96), depositAmount: 100 },
      )
      expect(res.penaltyPercent).toBe(0)
      expect(res.refundAmount).toBe(100)
    })

    it('24h antes → 50% (dentro de la ventana de 72h)', () => {
      const res = computePenalty(
        { tiers: presetFromEnum('moderate'), policyId: 'moderate', source: 'preset' },
        { now: NOW, checkIn: checkInAt(24), depositAmount: 100 },
      )
      expect(res.penaltyPercent).toBe(50)
      expect(res.refundAmount).toBe(50)
      expect(res.cancellationFee).toBe(50)
      expect(res.refundable).toBe(true)
    })

    it('pasado el checkIn → último tier = 50%', () => {
      const res = computePenalty(
        { tiers: presetFromEnum('moderate'), policyId: 'moderate', source: 'preset' },
        { now: NOW, checkIn: checkInAt(-3), depositAmount: 100 },
      )
      expect(res.penaltyPercent).toBe(50)
      expect(res.cancellationFee).toBe(50)
    })
  })

  describe('preset strict', () => {
    // strict = [{168h (7d), 0%}, {0h, 100%}]
    it('8d antes (>168h) → 0%', () => {
      const res = computePenalty(
        { tiers: presetFromEnum('strict'), policyId: 'strict', source: 'preset' },
        { now: NOW, checkIn: checkInAt(24 * 8), depositAmount: 200 },
      )
      expect(res.penaltyPercent).toBe(0)
      expect(res.refundAmount).toBe(200)
    })

    it('3d antes (<168h) → 100%', () => {
      const res = computePenalty(
        { tiers: presetFromEnum('strict'), policyId: 'strict', source: 'preset' },
        { now: NOW, checkIn: checkInAt(24 * 3), depositAmount: 200 },
      )
      expect(res.penaltyPercent).toBe(100)
      expect(res.refundAmount).toBe(0)
      expect(res.cancellationFee).toBe(200)
    })
  })

  describe('preset non_refundable', () => {
    it('7d antes → 100% penalty, refundable=false, refundAmount=0', () => {
      const res = computePenalty(
        { tiers: presetFromEnum('non_refundable'), policyId: 'non_refundable', source: 'preset' },
        { now: NOW, checkIn: checkInAt(24 * 7), depositAmount: 150 },
      )
      expect(res.refundable).toBe(false)
      expect(res.penaltyPercent).toBe(100)
      expect(res.refundAmount).toBe(0)
      expect(res.cancellationFee).toBe(150)
    })

    it('1h antes → igual 100%, no reembolsable', () => {
      const res = computePenalty(
        { tiers: presetFromEnum('non_refundable'), policyId: 'non_refundable', source: 'preset' },
        { now: NOW, checkIn: checkInAt(1), depositAmount: 150 },
      )
      expect(res.refundAmount).toBe(0)
      expect(res.refundable).toBe(false)
    })
  })

  it('sin política (default flexible) → refundable, 0% penalty', () => {
    const res = computePenalty(
      { tiers: presetFromEnum('flexible'), policyId: 'default', source: 'default' },
      { now: NOW, checkIn: checkInAt(48), depositAmount: 100 },
    )
    expect(res.refundable).toBe(true)
    expect(res.penaltyPercent).toBe(0)
    expect(res.refundAmount).toBe(100)
  })

  it('matchedTier y policyApplied se propagan en el resultado', () => {
    const pol: ResolvedPolicy = { tiers: presetFromEnum('moderate'), policyId: 'moderate', source: 'preset' }
    const res = computePenalty(pol, { now: NOW, checkIn: checkInAt(24), depositAmount: 100 })
    expect(res.policyApplied).toBe(pol)
    expect(res.matchedTier.penaltyPercent).toBe(50)
  })
})

// ─── resolvePolicy ───────────────────────────────────────────────────────────
describe('resolvePolicy', () => {
  it('base sola → source=custom, usa los tiers de la fila base', async () => {
    const base = policy({ scope: 'base', scopeId: '', tiers: presetFromEnum('strict') })
    const resolved = await resolvePolicy(mockRepo([base]), 'h1')
    expect(resolved.source).toBe('custom')
    expect(resolved.policyId).toBe(base.id)
    expect(resolved.tiers).toEqual(base.tiers)
  })

  it('override por canal gana sobre base (scope=channel, scopeId=canal)', async () => {
    const base = policy({ scope: 'base', tiers: presetFromEnum('strict') })
    const channelPolicy = policy({ scope: 'channel', scopeId: 'airbnb', tiers: presetFromEnum('flexible') })
    const resolved = await resolvePolicy(mockRepo([base, channelPolicy]), 'h1', 'airbnb')
    expect(resolved.policyId).toBe(channelPolicy.id)
    expect(resolved.tiers).toEqual(channelPolicy.tiers)
  })

  it('canal sin su override → cae a base', async () => {
    const base = policy({ scope: 'base', tiers: presetFromEnum('strict') })
    const otherChannel = policy({ scope: 'channel', scopeId: 'booking', tiers: presetFromEnum('flexible') })
    const resolved = await resolvePolicy(mockRepo([base, otherChannel]), 'h1', 'airbnb')
    expect(resolved.policyId).toBe(base.id)
  })

  it('sin filas + hotelCancellationType → preset fallback', async () => {
    const resolved = await resolvePolicy(mockRepo([]), 'h1', undefined, 'moderate')
    expect(resolved.source).toBe('preset')
    expect(resolved.policyId).toBe('moderate')
    expect(resolved.tiers).toHaveLength(2)
  })

  it('sin filas y sin cancellationType → default flexible (refundable)', async () => {
    const resolved = await resolvePolicy(mockRepo([]), 'h1')
    expect(resolved.source).toBe('default')
    expect(resolved.policyId).toBe('default')
    expect(resolved.tiers[0].refundable).toBe(true)
    expect(resolved.tiers[0].penaltyPercent).toBe(0)
  })

  it('políticas inactivas se ignoran (active=false/0)', async () => {
    const inactiveBase = policy({ scope: 'base', active: false, tiers: presetFromEnum('strict') })
    const resolved = await resolvePolicy(mockRepo([inactiveBase]), 'h1', undefined, 'moderate')
    // base inactiva → cae a preset
    expect(resolved.source).toBe('preset')
    expect(resolved.policyId).toBe('moderate')
  })

  it('tipo desconocido → flexible (no rompe)', async () => {
    const resolved = await resolvePolicy(mockRepo([]), 'h1', undefined, 'misterplan-ultra')
    expect(resolved.tiers[0].penaltyPercent).toBe(0)
    expect(resolved.tiers[0].refundable).toBe(true)
  })
})

// ─── presetFromEnum ──────────────────────────────────────────────────────────
describe('presetFromEnum', () => {
  it('devuelve copia profunda (mutar no afecta PRESET_TIERS)', () => {
    const a = presetFromEnum('moderate')
    a[0].penaltyPercent = 999
    const b = presetFromEnum('moderate')
    expect(b[0].penaltyPercent).toBe(0)
  })

  it('los 4 presets existen en PRESET_TIERS', () => {
    expect(PRESET_TIERS.flexible).toBeDefined()
    expect(PRESET_TIERS.moderate).toBeDefined()
    expect(PRESET_TIERS.strict).toBeDefined()
    expect(PRESET_TIERS.non_refundable).toBeDefined()
  })
})
