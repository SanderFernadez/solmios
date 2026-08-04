// OccupancySelector.test.ts — Resumen explícito de ocupación + steppers.
// El panel va teletransportado a <body>, así que se consulta `document`, no el wrapper.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import OccupancySelector from './OccupancySelector.vue'
import type { Occupancy } from '@/types/booking'

function panel(): HTMLElement | null {
  return document.querySelector('[role="dialog"]')
}

/** Botón ± de una fila, buscado por su aria-label (que es lo que lee un lector de pantalla). */
function stepper(label: string): HTMLButtonElement {
  const el = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!el) throw new Error(`No existe el botón "${label}"`)
  return el
}

let wrapper: VueWrapper | null = null

function render(modelValue: Occupancy) {
  wrapper = mount(OccupancySelector, { props: { modelValue } })
  return wrapper
}

describe('OccupancySelector', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  afterEach(() => { wrapper?.unmount(); wrapper = null })

  it('el trigger muestra el resumen explícito, no un número pelado', () => {
    const w = render({ adults: 2, children: 1, rooms: 1 })
    expect(w.text()).toContain('Huéspedes')
    expect(w.text()).toContain('2 adultos, 1 niño')
  })

  it('abre el panel al clickear y lo cierra con "Listo"', async () => {
    const w = render({ adults: 2, children: 0, rooms: 1 })
    expect(panel()).toBeNull()

    await w.get('button').trigger('click')
    await w.vm.$nextTick()
    expect(panel()).not.toBeNull()
    expect(panel()!.textContent).toContain('Adultos')
    expect(panel()!.textContent).toContain('Niños')
    expect(panel()!.textContent).toContain('Habitaciones')
  })

  it('los ± emiten el nuevo objeto completo (no mutan la prop)', async () => {
    const w = render({ adults: 2, children: 0, rooms: 1 })
    await w.get('button').trigger('click')
    await w.vm.$nextTick()

    stepper('Agregar un niño').click()
    await w.vm.$nextTick()
    expect(w.emitted('update:modelValue')![0]).toEqual([{ adults: 2, children: 1, rooms: 1 }])

    stepper('Agregar un adulto').click()
    await w.vm.$nextTick()
    expect(w.emitted('update:modelValue')![1]).toEqual([{ adults: 3, children: 0, rooms: 1 }])
  })

  it('no baja de 1 adulto ni de 0 niños (botones deshabilitados en el piso)', async () => {
    const w = render({ adults: 1, children: 0, rooms: 1 })
    await w.get('button').trigger('click')
    await w.vm.$nextTick()

    expect(stepper('Quitar un adulto').disabled).toBe(true)
    expect(stepper('Quitar un niño').disabled).toBe(true)
    expect(stepper('Quitar una habitación').disabled).toBe(true)

    stepper('Quitar un adulto').click()
    await w.vm.$nextTick()
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('los ± tienen aria-label (accesibilidad: "+" solo no dice nada)', async () => {
    const w = render({ adults: 2, children: 0, rooms: 1 })
    await w.get('button').trigger('click')
    await w.vm.$nextTick()

    const steppers = Array.from(panel()!.querySelectorAll('button')).filter(
      (b) => b.textContent === '−' || b.textContent === '+',
    )
    expect(steppers).toHaveLength(6)
    expect(steppers.every((b) => (b.getAttribute('aria-label') ?? '').length > 3)).toBe(true)
  })
})
