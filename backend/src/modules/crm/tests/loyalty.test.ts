// crm/tests/loyalty.test.ts — Puntos y niveles de fidelidad.
//
// Regresión: el service sumaba puntos con `{ increment: n }`, que el ORM del framework no entiende:
// su `update()` copia el valor tal cual. El saldo del huésped quedaba en 0 para siempre, el canje
// respondía "Insufficient points: 0", y el nivel nunca subía porque `totalStays`/`totalSpent`
// se actualizaban igual de mal — dentro de un `try {} catch {}` vacío que lo ocultaba todo.

import { describe, it, expect } from 'bun:test'
import {
  applyPoints, calculateTier, nextTier, tierOrder, pointsForStay, POINTS_PER_CURRENCY_UNIT,
} from '../usecases/loyalty'

describe('applyPoints', () => {
  it('acredita', () => {
    expect(applyPoints(0, 100)).toBe(100)
    expect(applyPoints(250, 50)).toBe(300)
  })

  it('descuenta al canjear', () => {
    expect(applyPoints(300, -50)).toBe(250)
  })

  it('nunca deja el saldo negativo', () => {
    expect(applyPoints(10, -100)).toBe(0)
  })

  it('tolera un saldo ausente o corrupto', () => {
    expect(applyPoints(undefined, 100)).toBe(100)
    expect(applyPoints(NaN, 100)).toBe(100)
  })
})

describe('pointsForStay', () => {
  it('da puntos por unidad de moneda', () => {
    expect(pointsForStay(124)).toBe(124 * POINTS_PER_CURRENCY_UNIT)
  })

  it('redondea hacia abajo: no se regalan fracciones', () => {
    expect(pointsForStay(10.09)).toBe(100)
  })

  it('un importe ausente o negativo no da puntos', () => {
    expect(pointsForStay(0)).toBe(0)
    expect(pointsForStay(-50)).toBe(0)
    expect(pointsForStay(undefined as any)).toBe(0)
  })
})

describe('calculateTier', () => {
  it('arranca en bronze', () => {
    expect(calculateTier(0, 0)).toBe('bronze')
  })

  // Se alcanza un nivel por estadías O por gasto: lo que ocurra primero.
  it('sube por estadías', () => {
    expect(calculateTier(2, 0)).toBe('silver')
    expect(calculateTier(5, 0)).toBe('gold')
    expect(calculateTier(10, 0)).toBe('platinum')
    expect(calculateTier(20, 0)).toBe('diamond')
  })

  it('sube por gasto', () => {
    expect(calculateTier(0, 3000)).toBe('silver')
    expect(calculateTier(0, 50000)).toBe('diamond')
  })

  it('toma el nivel más alto de los dos criterios', () => {
    expect(calculateTier(2, 50000)).toBe('diamond')
  })
})

describe('nextTier — un nivel nunca baja', () => {
  it('sube cuando corresponde', () => {
    expect(nextTier('bronze', 5, 0)).toBe('gold')
  })

  // Si le anulan una estadía, el huésped no pierde el nivel que ya alcanzó.
  it('no degrada a quien ya subió', () => {
    expect(nextTier('platinum', 1, 0)).toBe('platinum')
    expect(nextTier('diamond', 0, 0)).toBe('diamond')
  })

  it('no se mueve si ya está donde le toca', () => {
    expect(nextTier('gold', 5, 0)).toBe('gold')
  })

  it('trata un nivel ausente como bronze', () => {
    expect(nextTier(undefined, 0, 0)).toBe('bronze')
    expect(nextTier(undefined, 20, 0)).toBe('diamond')
  })

  it('un nivel desconocido no bloquea el ascenso', () => {
    expect(nextTier('inventado', 10, 0)).toBe('platinum')
  })
})

describe('tierOrder', () => {
  it('ordena de menor a mayor', () => {
    expect(tierOrder('bronze')).toBeLessThan(tierOrder('silver'))
    expect(tierOrder('platinum')).toBeLessThan(tierOrder('diamond'))
  })

  it('un nivel desconocido vale como el más bajo', () => {
    expect(tierOrder('inventado')).toBe(0)
  })
})
