// PoliciesBlock.test.ts — Lo que la landing publica como condiciones es lo que el motor aplica.
//
// Bug real que motiva estos tests: `hotel-boutique-palma` tiene política `strict` (sin cargo
// hasta 7 días antes, después hasta 100% de penalización) y su landing anunciaba "Cancelación
// flexible". La regla que se fija acá:
//   · política estricta → NADA que diga flexible/gratis/sin cargo genérico;
//   · sin política resuelta → la cancelación se OMITE, nunca se inventa;
//   · sin ningún dato configurado → el bloque no existe.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

import PoliciesBlock from './PoliciesBlock.vue'
import { LANDING_CANCELLATION_KEY } from '@/composables/useLandingPolicy'
import type { CancellationSummary, LandingBlock, PublicHotelInfo } from '@/types'

const BLOCK = { id: 'b1', type: 'policies', sortOrder: 9, active: true, config: {} } as unknown as LandingBlock

/** Promesas que un hotel que penaliza cancelaciones NO puede hacer. */
const FALSE_PROMISE = /flexible|gratis|gratuit|sin costo|reembolso total/i

/** `hotels.cancellationType='strict'` — exactamente lo que devuelve prod para este hotel. */
const STRICT: CancellationSummary = {
  tiers: [
    { deadlineHours: 168, penaltyPercent: 0, refundable: true },
    { deadlineHours: 0, penaltyPercent: 100, refundable: true },
  ],
  freeUntilHours: 168,
  penaltyDescription: 'Después: hasta 100% de penalización',
  source: 'preset',
}

const FLEXIBLE: CancellationSummary = {
  tiers: [{ deadlineHours: 99_999, penaltyPercent: 0, refundable: true, label: 'Cancelación gratis' }],
  freeUntilHours: 99_999,
  penaltyDescription: 'Cancelación gratuita en cualquier momento',
  source: 'preset',
}

const NON_REFUNDABLE: CancellationSummary = {
  tiers: [{ deadlineHours: 0, penaltyPercent: 100, refundable: false }],
  freeUntilHours: null,
  penaltyDescription: 'No reembolsable',
  source: 'preset',
}

function hotel(extra: Partial<PublicHotelInfo> = {}): PublicHotelInfo {
  return {
    id: 'h1', slug: 'hotel-boutique-palma', name: 'Hotel Boutique Palma',
    checkIn: '15:00', checkOut: '12:00', currency: 'USD',
    ...extra,
  } as unknown as PublicHotelInfo
}

function render(summary: CancellationSummary | null, h: PublicHotelInfo = hotel()) {
  return mount(PoliciesBlock, {
    props: { block: BLOCK, hotel: h, media: null },
    global: { provide: { [LANDING_CANCELLATION_KEY as symbol]: ref(summary) } },
  })
}

describe('PoliciesBlock — condiciones derivadas de la política vigente', () => {
  it('un hotel con política estricta NO promete cancelación flexible ni gratis', () => {
    const w = render(STRICT)
    const text = w.text()

    expect(text).toContain('Cancelación')
    // La ventana real, en la unidad que el huésped entiende (168 h = 7 días).
    expect(text).toContain('Sin cargo hasta 7 días antes del check-in')
    expect(text).toContain('Después: hasta 100% de penalización')
    expect(text).not.toMatch(FALSE_PROMISE)
  })

  it('un hotel no reembolsable lo dice, sin ventana inventada', () => {
    const w = render(NON_REFUNDABLE)

    expect(w.text()).toContain('No reembolsable')
    expect(w.text()).not.toContain('Sin cargo hasta')
    expect(w.text()).not.toMatch(FALSE_PROMISE)
  })

  it('un hotel realmente flexible sí puede decirlo (no se le quita el beneficio)', () => {
    const w = render(FLEXIBLE)

    expect(w.text()).toContain('Cancelación gratuita en cualquier momento')
    // El centinela del preset (99999 h ≈ 11 años) nunca se muestra como plazo.
    expect(w.text()).not.toContain('99999')
    expect(w.text()).not.toContain('Sin cargo hasta')
  })

  it('un hotel que NO configuró política no anuncia el flexible de seguridad del backend', () => {
    // `source: 'default'` = el backend cayó a su fallback defensivo porque el hotel no eligió
    // nada. No es una condición ofrecida por el hotel: no se publica.
    const w = render({ ...FLEXIBLE, source: 'default' })

    expect(w.text()).not.toContain('Cancelación')
    expect(w.text()).not.toMatch(FALSE_PROMISE)
    expect(w.text()).toContain('Desde las 15:00')
  })

  it('sin política resuelta NO inventa: omite la cancelación y muestra solo lo configurado', () => {
    const w = render(null)
    const text = w.text()

    expect(text).not.toContain('Cancelación')
    expect(text).not.toMatch(FALSE_PROMISE)
    // Los horarios sí están: son datos reales del hotel.
    expect(text).toContain('Desde las 15:00')
    expect(text).toContain('Hasta las 12:00')
  })

  it('sin ningún dato configurado, el bloque no se renderiza', () => {
    const w = render(null, hotel({ checkIn: '', checkOut: '', minNights: null, maxNights: null }))

    expect(w.find('section').exists()).toBe(false)
    expect(w.text()).toBe('')
  })

  it('la estadía mínima se muestra solo cuando restringe de verdad', () => {
    expect(render(null, hotel({ minNights: 3 })).text()).toContain('3 noches')
    // "mínimo 1 noche" no es una condición: es la unidad de venta.
    expect(render(null, hotel({ minNights: 1 })).text()).not.toContain('Mínimo')
    expect(render(null, hotel({ minNights: null })).text()).not.toContain('Mínimo')
  })

  it('un plazo que no es múltiplo de 24 h se expresa en horas', () => {
    const w = render({
      tiers: [
        { deadlineHours: 30, penaltyPercent: 0, refundable: true },
        { deadlineHours: 0, penaltyPercent: 50, refundable: true },
      ],
      freeUntilHours: 30,
      penaltyDescription: 'Después: hasta 50% de penalización',
      source: 'custom',
    })

    expect(w.text()).toContain('Sin cargo hasta 30 horas antes del check-in')
  })

  it('respeta el título que el hotelero puso en el builder', () => {
    const w = mount(PoliciesBlock, {
      props: {
        block: { ...BLOCK, config: { title: 'Condiciones de la reserva' } } as unknown as LandingBlock,
        hotel: hotel(),
        media: null,
      },
      global: { provide: { [LANDING_CANCELLATION_KEY as symbol]: ref(STRICT) } },
    })

    expect(w.get('h2').text()).toBe('Condiciones de la reserva')
  })
})
