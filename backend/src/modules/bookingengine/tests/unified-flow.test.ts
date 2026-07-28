// bookingengine/tests/unified-flow.test.ts — F0 0.12
// spec: openspec/changes/solmi-direct-booking/specs/booking-unification/spec.md
//
// Cubre el feature flag BOOKING_USE_UNIFIED_FLOW:
// - Explicit true / false se respeta.
// - Default en dev (NODE_ENV !== 'production') → true.
// - Default en prod (NODE_ENV === 'production') → false (rollback seguro).
// - Valores espurios (vacío, 'yes', undefined) → fail-closed al flujo viejo (false),
//   salvo el default dev que sigue activo cuando el flag no está seteado.
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { useUnifiedBookingFlow } from '../usecases/unified-flow'

const FLAG = 'BOOKING_USE_UNIFIED_FLOW'

function snapshot() {
  return {
    flag: process.env[FLAG],
    nodeEnv: process.env.NODE_ENV,
  }
}

function restore(s: { flag: string | undefined; nodeEnv: string | undefined }) {
  if (s.flag === undefined) delete process.env[FLAG]
  else process.env[FLAG] = s.flag
  if (s.nodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = s.nodeEnv
}

describe('useUnifiedBookingFlow — feature flag F0 0.12', () => {
  const prev = snapshot()
  beforeEach(() => { delete process.env[FLAG]; delete process.env.NODE_ENV })
  afterEach(() => restore(prev))

  it('explicit "true" → true (sin importar NODE_ENV)', () => {
    process.env.NODE_ENV = 'production'
    process.env[FLAG] = 'true'
    expect(useUnifiedBookingFlow()).toBe(true)
  })

  it('explicit "false" → false (sin importar NODE_ENV)', () => {
    process.env.NODE_ENV = 'development'
    process.env[FLAG] = 'false'
    expect(useUnifiedBookingFlow()).toBe(false)
  })

  it('default en dev (sin flag, NODE_ENV=development) → true', () => {
    process.env.NODE_ENV = 'development'
    expect(useUnifiedBookingFlow()).toBe(true)
  })

  it('default en prod (sin flag, NODE_ENV=production) → false (rollback seguro)', () => {
    process.env.NODE_ENV = 'production'
    expect(useUnifiedBookingFlow()).toBe(false)
  })

  it('default cuando NODE_ENV no está seteado → true (asume dev)', () => {
    delete process.env.NODE_ENV
    expect(useUnifiedBookingFlow()).toBe(true)
  })

  it('valor espurio (vacío / typo / "1") → fail-closed al flujo viejo (false)', () => {
    process.env[FLAG] = ''
    expect(useUnifiedBookingFlow()).toBe(false)
    process.env[FLAG] = 'yes'
    expect(useUnifiedBookingFlow()).toBe(false)
    process.env[FLAG] = '1'
    expect(useUnifiedBookingFlow()).toBe(false)
  })
})
