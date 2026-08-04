// SearchStep.test.ts — Selector de ocupación del widget embebible.
//
// Bug que se protege: el paso 0 tenía dos steppers apretados (huéspedes + habitaciones) y NINGÚN
// campo para niños, mientras la landing sí los pedía. El huésped que viajaba con chicos no tenía
// dónde declararlos, y las tarifas se consultaban con una ocupación física menor a la real.
//
// Contrato: `store.guests` son ADULTOS (se mapea a `adults` al crear la reserva) y `store.children`
// los niños; la consulta de tarifas usa `store.physicalGuests` (adultos + niños). Meter niños
// dentro de `guests` los grabaría como adultos.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/services/Booking.service', () => ({
  BookingService: { getRates: vi.fn(), getCalendar: vi.fn().mockRejectedValue(new Error('sin red')) },
}))

import SearchStep from './SearchStep.vue'
import { useBookingStore } from '@/composables/useBooking'
import { useBookingI18nStore } from '@/composables/useBookingI18n'

/** Devuelve los botones ± de la fila cuyo label coincide. */
function stepperOf(w: VueWrapper, label: string): { minus: HTMLButtonElement; plus: HTMLButtonElement } {
  const minus = w.element.querySelector(`button[aria-label="− ${label}"]`)
  const plus = w.element.querySelector(`button[aria-label="+ ${label}"]`)
  if (!minus || !plus) throw new Error(`No existe el stepper de "${label}"`)
  return { minus: minus as HTMLButtonElement, plus: plus as HTMLButtonElement }
}

describe('SearchStep — ocupación', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useBookingI18nStore().setLocale('es')
  })

  it('tiene adultos, NIÑOS y habitaciones (paridad con la landing)', async () => {
    const store = useBookingStore()
    store.init('hotel-demo')
    const w = mount(SearchStep)
    await flushPromises()

    expect(w.text()).toContain('Adultos')
    expect(w.text()).toContain('Niños')
    expect(w.text()).toContain('Habitaciones')
    // Tres steppers, uno por fila.
    expect(w.element.querySelectorAll('button[aria-label^="+ "]').length).toBe(3)
    w.unmount()
  })

  it('los niños suman a la ocupación FÍSICA sin ensuciar los adultos', async () => {
    const store = useBookingStore()
    store.init('hotel-demo', { guests: 2, children: 0 })
    const w = mount(SearchStep)
    await flushPromises()

    // Un click por render: el stepper recibe el valor por prop, así que hay que dejar que Vue
    // lo propague antes del segundo toque (igual que un usuario real).
    stepperOf(w, 'Niños').plus.click()
    await flushPromises()
    stepperOf(w, 'Niños').plus.click()
    await flushPromises()

    expect(store.children).toBe(2)
    expect(store.guests).toBe(2) // los adultos NO se tocaron
    expect(store.physicalGuests).toBe(4)
    w.unmount()
  })

  it('no deja bajar de 1 adulto ni de 0 niños', async () => {
    const store = useBookingStore()
    store.init('hotel-demo', { guests: 1, children: 0 })
    const w = mount(SearchStep)
    await flushPromises()

    expect(stepperOf(w, 'Adultos').minus.disabled).toBe(true)
    expect(stepperOf(w, 'Niños').minus.disabled).toBe(true)
    expect(stepperOf(w, 'Habitaciones').minus.disabled).toBe(true)
    w.unmount()
  })

  it('los ± son objetivos táctiles reales (36px), no botones diminutos', async () => {
    const store = useBookingStore()
    store.init('hotel-demo')
    const w = mount(SearchStep)
    await flushPromises()

    const { plus } = stepperOf(w, 'Adultos')
    expect(plus.className).toContain('h-9')
    expect(plus.className).toContain('w-9')
    w.unmount()
  })
})
