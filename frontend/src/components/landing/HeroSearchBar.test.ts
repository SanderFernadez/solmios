// HeroSearchBar.test.ts — El contrato de URL del buscador.
// `booking-widget.vue:286-289` lee `?checkIn&checkOut&guests&rooms` para inicializar el wizard:
// si esta query cambia de forma, el deep-link desde la landing se rompe en silencio. Por eso se
// testea el submit end-to-end (calendario real + selector real), no los refs internos.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/services/Booking.service', () => ({ BookingService: { getCalendar: vi.fn() } }))

import HeroSearchBar from './HeroSearchBar.vue'
import { BookingService } from '@/services/Booking.service'
import { LANDING_BOOKING_KEY } from '@/composables/useLandingBooking'
import type { CalendarDay } from '@/types/booking'

const TODAY = new Date(2026, 7, 15, 10, 0, 0)

function agosto(): CalendarDay[] {
  const out: CalendarDay[] = []
  for (let d = 15; d <= 31; d++) {
    out.push({ date: `2026-08-${d}`, fromPrice: 100, available: 4, closed: false })
  }
  return out
}

function dialog(label: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[role="dialog"][aria-label="${label}"]`)
  if (!el) throw new Error(`El panel "${label}" no está abierto`)
  return el
}

function dayCell(root: HTMLElement, day: number): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'))
    .find((c) => c.querySelector('span')?.textContent?.trim() === String(day))
  if (!found) throw new Error(`No existe la celda del día ${day}`)
  return found
}

let wrapper: VueWrapper | null = null

/** `openBooking` presente = el buscador vive DENTRO de la landing (provideLandingBooking). */
async function render(openBooking?: ReturnType<typeof vi.fn>) {
  wrapper = mount(HeroSearchBar, {
    props: { hotelSlug: 'hotel-demo', ctaText: 'Ver disponibilidad' },
    ...(openBooking ? { global: { provide: { [LANDING_BOOKING_KEY as symbol]: openBooking } } } : {}),
  })
  await flushPromises()
  return wrapper
}

/** Abre el calendario y elige un rango. Devuelve el wrapper para encadenar. */
async function pickDates(w: VueWrapper, from: number, to: number) {
  await w.findAllComponents({ name: 'RateCalendar' })[0]!.get('button').trigger('click')
  await flushPromises()
  const cal = dialog('Elegir fechas de la estadía')
  dayCell(cal, from).click()
  await flushPromises()
  dayCell(cal, to).click()
  await flushPromises()
}

describe('HeroSearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY)
    document.body.innerHTML = ''
    push.mockReset()
    vi.mocked(BookingService.getCalendar).mockReset()
    vi.mocked(BookingService.getCalendar).mockResolvedValue({
      currency: 'USD', chargeCurrency: 'USD', from: '2026-08-15', to: '2026-08-31', guests: 2, days: agosto(),
    })
  })
  afterEach(() => { wrapper?.unmount(); wrapper = null; vi.useRealTimers() })

  it('preserva el contrato ?checkIn&checkOut&guests&rooms que lee el widget', async () => {
    const w = await render()
    await pickDates(w, 18, 21)

    await w.get('form').trigger('submit')
    expect(push).toHaveBeenCalledWith(
      '/book/hotel-demo?checkIn=2026-08-18&checkOut=2026-08-21&guests=2&rooms=1',
    )
  })

  it('guests son los ADULTOS (los niños viajan aparte: el widget mapea guests→adults)', async () => {
    const w = await render()
    await pickDates(w, 18, 20)

    await w.findAllComponents({ name: 'OccupancySelector' })[0]!.get('button').trigger('click')
    await flushPromises()
    const occ = dialog('Seleccionar huéspedes y habitaciones')
    // Un flush por click: el stepper es un v-model puro (emite a partir de la prop actual), así
    // que hay que dejar que el padre propague el valor nuevo — igual que entre dos clicks reales.
    occ.querySelector<HTMLButtonElement>('button[aria-label="Agregar un niño"]')!.click()
    await flushPromises()
    occ.querySelector<HTMLButtonElement>('button[aria-label="Agregar una habitación"]')!.click()
    await flushPromises()

    await w.get('form').trigger('submit')
    const url = push.mock.calls[0]![0] as string
    const qs = new URLSearchParams(url.split('?')[1])
    expect(qs.get('guests')).toBe('2')   // adultos, NO adultos+niños
    expect(qs.get('children')).toBe('1')
    expect(qs.get('rooms')).toBe('2')
  })

  it('el calendario recibe la ocupación FÍSICA (adultos + niños) para filtrar por capacidad', async () => {
    const w = await render()
    await w.findAllComponents({ name: 'OccupancySelector' })[0]!.get('button').trigger('click')
    await flushPromises()
    dialog('Seleccionar huéspedes y habitaciones')
      .querySelector<HTMLButtonElement>('button[aria-label="Agregar un niño"]')!.click()
    await flushPromises()

    const last = vi.mocked(BookingService.getCalendar).mock.calls.at(-1)!
    expect(last[1]).toMatchObject({ guests: 3 })
  })

  it('dentro de la landing abre el modal con el contexto ya cargado, sin navegar', async () => {
    // El huésped NO debe abandonar `/h/:slug` para reservar: el submit abre BookingModal encima
    // de la landing y `skipToRooms` evita que el motor le vuelva a pedir "Ver disponibilidad".
    const openBooking = vi.fn()
    const w = await render(openBooking)
    await pickDates(w, 18, 21)

    await w.findAllComponents({ name: 'OccupancySelector' })[0]!.get('button').trigger('click')
    await flushPromises()
    dialog('Seleccionar huéspedes y habitaciones')
      .querySelector<HTMLButtonElement>('button[aria-label="Agregar un niño"]')!.click()
    await flushPromises()

    await w.get('form').trigger('submit')

    expect(push).not.toHaveBeenCalled()
    expect(openBooking).toHaveBeenCalledWith({
      checkIn: '2026-08-18',
      checkOut: '2026-08-21',
      adults: 2,     // los niños NO se suman acá: el motor los manda aparte al backend
      children: 1,
      rooms: 1,
      skipToRooms: true,
    })
  })

  it('no navega sin fechas y lo dice', async () => {
    const w = await render()
    await w.get('form').trigger('submit')

    expect(push).not.toHaveBeenCalled()
    expect(w.text()).toContain('Elegí las fechas de llegada y salida.')
  })

  it('frena el submit si el rango viola la estadía mínima del día de entrada', async () => {
    vi.mocked(BookingService.getCalendar).mockResolvedValue({
      currency: 'USD', chargeCurrency: 'USD', from: '2026-08-15', to: '2026-08-31', guests: 2,
      days: agosto().map((d) => (d.date === '2026-08-18' ? { ...d, minStay: 3 } : d)),
    })
    const w = await render()
    await pickDates(w, 18, 19)

    await w.get('form').trigger('submit')
    expect(push).not.toHaveBeenCalled()
    expect(w.text()).toContain('Estadía mínima de 3 noches')
  })
})
