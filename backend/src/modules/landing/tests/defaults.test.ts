// landing/tests/defaults.test.ts — El config sembrado no puede afirmar una política del hotel.
//
// Contexto (bug real en producción): el seeder plantaba `{icon:'refund', text:'Cancelación
// flexible'}` en `trust-badges` sin mirar `hotels.cancellationType`. El hotel
// `hotel-boutique-palma` tiene política `strict` (sin cargo hasta 7 días antes, después hasta
// 100% de penalización) y su landing prometía cancelación flexible bajo el buscador.
//
// Estos tests fijan la regla: NINGÚN default sembrado afirma nada sobre la cancelación. La
// política real se publica en el bloque `policies`, derivada en el render de
// `cancellationSummary` (misma fuente que el cálculo del reembolso).
import { describe, it, expect } from 'bun:test'
import { defaultConfigFor } from '../usecases/defaults'
import { BLOCK_TYPES, DEFAULT_SORT_ORDER } from '../types'

/** Promesas de cancelación (gratis/flexible/sin cargo/reembolso) en cualquier variante. */
const CANCELLATION_CLAIM = /cancelaci|flexible|gratis|gratuit|sin cargo|reembols|refund/i

describe('defaults — el sembrado no afirma políticas del hotel', () => {
  it('los sellos de confianza sembrados no dicen nada sobre cancelación', () => {
    const cfg = defaultConfigFor('trust-badges') as { items: Array<{ icon: string; text: string }> }

    expect(Array.isArray(cfg.items)).toBe(true)
    expect(cfg.items.length).toBeGreaterThan(0)
    for (const item of cfg.items) {
      expect(item.text).not.toMatch(CANCELLATION_CLAIM)
    }
    // El sello que mentía, explícitamente ausente.
    expect(cfg.items.some((i) => i.icon === 'refund')).toBe(false)
    expect(JSON.stringify(cfg)).not.toContain('Cancelación flexible')
  })

  it('NINGÚN type siembra copy que prometa cancelación', () => {
    for (const type of BLOCK_TYPES) {
      // El FAQ siembra horarios de check-in/check-out (dato del hotel, no una promesa);
      // el resto no debe traer ni una palabra sobre cancelaciones.
      expect(JSON.stringify(defaultConfigFor(type))).not.toMatch(CANCELLATION_CLAIM)
    }
  })

  it('el bloque de políticas siembra SOLO el título (el contenido se deriva en el render)', () => {
    const cfg = defaultConfigFor('policies')
    expect(cfg).toEqual({ title: 'Políticas y condiciones' })
  })

  it('`policies` está en el catálogo y tiene sortOrder propio entre FAQ y CTA', () => {
    expect(BLOCK_TYPES).toContain('policies')
    for (const type of BLOCK_TYPES) {
      expect(typeof DEFAULT_SORT_ORDER[type]).toBe('number')
    }
    expect(DEFAULT_SORT_ORDER.policies).toBeGreaterThan(DEFAULT_SORT_ORDER.faq)
    expect(DEFAULT_SORT_ORDER.policies).toBeLessThan(DEFAULT_SORT_ORDER.cta)
  })
})
