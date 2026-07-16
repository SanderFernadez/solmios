import { describe, it, expect } from 'bun:test'
import { ValidationError } from 'arckode-framework'
import {
  validateRateItems, validateSeasonItems, validateRestrictionItems, validateBlockRange,
} from '../validators/schema'

describe('pricing validators — rate items', () => {
  it('acepta una tarifa válida', () => {
    expect(() => validateRateItems([{ roomType: 'standard', season: 'Summer', occupancy: 2, basePrice: 100, percentage: 20 }])).not.toThrow()
  })

  it('rechaza basePrice negativo', () => {
    expect(() => validateRateItems([{ roomType: 'standard', season: 'Summer', occupancy: 2, basePrice: -50, percentage: 0 }])).toThrow(ValidationError)
  })

  it('rechaza basePrice absurdo (fuera de tope)', () => {
    expect(() => validateRateItems([{ roomType: 'standard', season: 'Summer', occupancy: 2, basePrice: 9_999_999, percentage: 0 }])).toThrow(ValidationError)
  })

  it('rechaza percentage que produce tarifa negativa (< -100)', () => {
    expect(() => validateRateItems([{ roomType: 'standard', season: 'Summer', occupancy: 2, basePrice: 100, percentage: -150 }])).toThrow(ValidationError)
  })

  it('rechaza item sin roomType/season/occupancy', () => {
    expect(() => validateRateItems([{ basePrice: 100 }])).toThrow(ValidationError)
  })

  it('rechaza cuando no es array', () => {
    expect(() => validateRateItems({ roomType: 'x' } as any)).toThrow(ValidationError)
  })
})

describe('pricing validators — season / restriction / block', () => {
  it('rechaza endDate anterior a startDate en temporada', () => {
    expect(() => validateSeasonItems([{ name: 'S', startDate: '2026-08-01', endDate: '2026-06-01' }])).toThrow(ValidationError)
  })

  it('acepta temporada con fechas válidas', () => {
    expect(() => validateSeasonItems([{ name: 'S', startDate: '2026-06-01', endDate: '2026-08-31' }])).not.toThrow()
  })

  it('rechaza minStay negativo en restricción', () => {
    expect(() => validateRestrictionItems([{ roomType: 'std', season: 'S', minStay: -1 }])).toThrow(ValidationError)
  })

  it('rechaza maxStay < minStay', () => {
    expect(() => validateRestrictionItems([{ roomType: 'std', season: 'S', minStay: 5, maxStay: 2 }])).toThrow(ValidationError)
  })

  it('acepta maxStay 0 (sin tope)', () => {
    expect(() => validateRestrictionItems([{ roomType: 'std', season: 'S', minStay: 5, maxStay: 0 }])).not.toThrow()
  })

  it('rechaza bloqueo con endDate anterior a startDate', () => {
    expect(() => validateBlockRange('2026-06-10', '2026-06-01')).toThrow(ValidationError)
  })
})
