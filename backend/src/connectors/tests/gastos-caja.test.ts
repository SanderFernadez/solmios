// connectors/tests/gastos-caja.test.ts — Cableado gastos→caja.
//
// El conector reacciona a create Y update, así que la decisión "¿mueve el cajón?" se reevalúa en
// cada edición. Editar un gasto de efectivo a transferencia tiene que REVERTIR el egreso.

import { describe, it, expect } from 'bun:test'
import type { ConnectorContext } from 'arckode-framework'
import { gastosCajaConnector, movesCash } from '../gastos-caja'
import type { GastosDTO } from '../../modules/gastos'

const gasto = (over: Partial<GastosDTO> = {}): GastosDTO => ({
  id: 'e1', hotelId: 'h1', concept: 'Nafta', amount: 250,
  paid: 1, paymentMethod: 'cash', createdAt: '', updatedAt: '',
  ...over,
})

/** Monta el conector y devuelve los sockets que registró + lo que le pidió a caja. */
function mount(cajaAvailable = true) {
  const registered: any[] = []
  const removed: string[] = []
  let sockets: any = {}

  const caja = {
    registerExpenseOutflow: async (i: any) => { registered.push(i); return {} },
    removeExpenseOutflow: async (id: string) => { removed.push(id); return true },
  }

  const ctx = {
    resolveModule: (name: string) => {
      if (name === 'gastos') return { setSockets: (s: any) => { sockets = s } }
      if (name === 'caja') {
        if (!cajaAvailable) throw new Error('caja no disponible')
        return caja
      }
      throw new Error(`módulo desconocido: ${name}`)
    },
  } as unknown as ConnectorContext

  gastosCajaConnector(ctx)
  return { sockets, registered, removed }
}

describe('movesCash', () => {
  it('solo un gasto pagado en efectivo mueve el cajón', () => {
    expect(movesCash(gasto())).toBe(true)
    expect(movesCash(gasto({ paid: 0 }))).toBe(false)
    expect(movesCash(gasto({ paymentMethod: 'transfer' }))).toBe(false)
    expect(movesCash(gasto({ paymentMethod: 'card' }))).toBe(false)
  })

  it('un gasto viejo sin método (columna nueva, fila vieja) no mueve el cajón', () => {
    expect(movesCash(gasto({ paymentMethod: undefined }))).toBe(false)
  })
})

describe('gastos-caja', () => {
  it('un gasto en efectivo crea el egreso con los datos del gasto', async () => {
    const { sockets, registered } = mount()

    await sockets.onGastosCreated(gasto({ invoiceNumber: 'F-99', category: 'supplies' }))

    expect(registered).toHaveLength(1)
    expect(registered[0]).toMatchObject({
      hotelId: 'h1', expenseId: 'e1', amount: 250, concept: 'Nafta',
      category: 'supplies', reference: 'F-99',
    })
  })

  it('un gasto por transferencia no toca la caja', async () => {
    const { sockets, registered } = mount()

    await sockets.onGastosCreated(gasto({ paymentMethod: 'transfer' }))

    expect(registered).toHaveLength(0)
  })

  it('editar de efectivo a transferencia revierte el egreso', async () => {
    const { sockets, removed } = mount()

    await sockets.onGastosUpdated(gasto({ paymentMethod: 'transfer' }))

    expect(removed).toEqual(['e1'])
  })

  it('marcar un gasto como impago revierte el egreso', async () => {
    const { sockets, removed } = mount()

    await sockets.onGastosUpdated(gasto({ paid: 0 }))

    expect(removed).toEqual(['e1'])
  })

  it('borrar el gasto revierte el egreso', async () => {
    const { sockets, removed } = mount()

    await sockets.onGastosDeleted('e1')

    expect(removed).toEqual(['e1'])
  })

  // Best-effort: la caja es un registro derivado. La fuente de verdad del gasto es `expenses`.
  it('si caja no resuelve, el gasto no falla', async () => {
    const { sockets } = mount(false)

    await sockets.onGastosCreated(gasto())
    await sockets.onGastosDeleted('e1')
  })
})
