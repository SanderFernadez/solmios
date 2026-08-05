// folios/tests/close-and-create-invoice.test.ts — Cierre + emisión + vínculo, del lado del servidor.
// Regresión: el frontend cerraba el folio y creaba la factura en dos requests. Si la segunda
// fallaba, el folio quedaba cerrado sin factura; y nunca se llamaba a setInvoice, así que
// `folio.invoiceId` quedaba en null y el badge "✓ Facturado" no aparecía nunca.

import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { closeAndCreateInvoice } from '../usecases/close-and-create-invoice'
import type { CurrentUser, FolioDTO } from '../types'

const log = silentLogger()
const user: CurrentUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }

const invoiceData = {
  hotelId: 'h1', guestId: 'g1', reservationId: 'r1', folioId: 'f1', type: 'invoice',
  amount: 150, status: 'pending', notes: 'Folio abc · 2 cargo(s)',
  items: [{ description: 'Minibar', amount: 50 }, { description: 'Spa', amount: 100 }],
}

function makeDeps(over: Record<string, any> = {}) {
  const calls: Record<string, any[]> = { createInvoice: [], setInvoice: [] }
  return {
    calls,
    deps: {
      logger: log,
      port: {
        createInvoice: async (data: any, u: any) => {
          calls.createInvoice.push([data, u])
          return { id: 'inv-1', invoiceNumber: 'INV-2026-0001', amount: 177 }
        },
      },
      closeAndInvoice: async () => ({ folio: { id: 'f1', hotelId: 'h1' } as FolioDTO, invoiceData }),
      setInvoice: async (folioId: string, invoiceId: string, u: any) => {
        calls.setInvoice.push([folioId, invoiceId, u])
        return { id: folioId, hotelId: 'h1', invoiceId, status: 'closed' } as unknown as FolioDTO
      },
      ...over,
    },
  }
}

describe('closeAndCreateInvoice', () => {
  it('cierra, emite la factura y deja el folio vinculado a ella', async () => {
    const { deps, calls } = makeDeps()
    const result = await closeAndCreateInvoice(deps as any, 'f1', user)

    expect(result.invoice.id).toBe('inv-1')
    expect(result.folio.invoiceId).toBe('inv-1')
    expect(calls.setInvoice[0]).toEqual(['f1', 'inv-1', user])
  })

  it('pasa los items del folio a la factura: el desglose no se pierde', async () => {
    const { deps, calls } = makeDeps()
    await closeAndCreateInvoice(deps as any, 'f1', user)

    const [sent] = calls.createInvoice[0]
    expect(sent.items).toHaveLength(2)
    expect(sent.items[0].description).toBe('Minibar')
  })

  // CTB-4.2 / DT-12 — el folioId debe llegar a `facturas.create()` para que `facturas-accounting`
  // se auto-excluya y no doble-cuente un ingreso que `folios-accounting` ya asentó al postear el cargo.
  it('pasa el folioId a la factura: sin esto, facturas-accounting duplicaría el ingreso ya devengado por folios-accounting', async () => {
    const { deps, calls } = makeDeps()
    await closeAndCreateInvoice(deps as any, 'f1', user)

    const [sent] = calls.createInvoice[0]
    expect(sent.folioId).toBe('f1')
  })

  it('falla si el conector folios-facturas no está registrado', async () => {
    const { deps } = makeDeps({ port: null })
    await expect(closeAndCreateInvoice(deps as any, 'f1', user)).rejects.toThrow(/no está registrado/)
  })

  it('no vincula el folio si la emisión de la factura falla', async () => {
    const { deps, calls } = makeDeps({
      port: { createInvoice: async () => { throw new Error('numerador caído') } },
    })
    await expect(closeAndCreateInvoice(deps as any, 'f1', user)).rejects.toThrow('numerador caído')
    expect(calls.setInvoice).toHaveLength(0)
  })

  // Sin compensación el folio quedaba CERRADO y sin factura. Como cerrar exige `status === 'open'`,
  // no había forma de reintentar: quedaba trabado y había que tocar la base a mano.
  it('reabre el folio si la factura falla, para poder reintentar', async () => {
    const reopened: string[] = []
    const { deps } = makeDeps({
      port: { createInvoice: async () => { throw new Error('numerador caído') } },
      reopenFolio: async (folioId: string) => { reopened.push(folioId); return null },
    })

    await expect(closeAndCreateInvoice(deps as any, 'f1', user)).rejects.toThrow('numerador caído')
    expect(reopened).toEqual(['f1'])
  })

  it('si la reapertura también falla, propaga el error ORIGINAL de la factura', async () => {
    // El usuario tiene que ver por qué no se pudo facturar, no un error de rollback.
    const { deps } = makeDeps({
      port: { createInvoice: async () => { throw new Error('numerador caído') } },
      reopenFolio: async () => { throw new Error('base caída') },
    })

    await expect(closeAndCreateInvoice(deps as any, 'f1', user)).rejects.toThrow('numerador caído')
  })

  it('si falla el VÍNCULO, NO reabre: la factura ya existe y se duplicaría al reintentar', async () => {
    const reopened: string[] = []
    const { deps } = makeDeps({
      setInvoice: async () => { throw new Error('update falló') },
      reopenFolio: async (folioId: string) => { reopened.push(folioId); return null },
    })

    await expect(closeAndCreateInvoice(deps as any, 'f1', user)).rejects.toThrow('update falló')
    expect(reopened).toHaveLength(0)
  })
})
