// facturas/tests/fiscal.test.ts — issueNcf: numeración fiscal + transmisión (mejora 2026-07-29).
// Antes stubFiscalAdapter existía en fiscal.ts pero nada lo llamaba (ni siquiera un test): el
// NCF se generaba y ahí terminaba. issueNcf ahora invoca el adapter y persiste fiscalSent/message.

import { describe, it, expect } from 'bun:test'
import { issueNcf, buildNcf, stubFiscalAdapter } from '../usecases/fiscal'
import type { RepositoryAdapter } from 'arckode-framework'

function fakeConfigRepo(rows: any[]): RepositoryAdapter<any> & { updated: any[] } {
  const updated: any[] = []
  const repo = {
    findOne: async (filter: any) => rows.find((r) =>
      Object.entries(filter).every(([k, v]) => r[k] === v)) ?? null,
    update: async (id: string, data: any) => {
      updated.push({ id, data })
      const row = rows.find((r) => r.id === id)
      if (row) Object.assign(row, data)
      return row
    },
    updated,
  }
  return repo as unknown as RepositoryAdapter<any> & { updated: any[] }
}

const invoiceInput = {
  hotelId: 'h1', invoiceNumber: 'INV-2026-0001', amount: 118, taxes: 18, currency: 'USD', guestId: 'g1',
}

describe('issueNcf', () => {
  it('sin config electronic_invoicing: ncf null, no transmite', async () => {
    const configRepo = fakeConfigRepo([])
    const result = await issueNcf(configRepo, 'h1', invoiceInput)
    expect(result).toEqual({ ncf: null, fiscalSent: false, fiscalMessage: null })
    expect(configRepo.updated).toHaveLength(0)
  })

  it('config con enabled:false: ncf null, no incrementa secuencia ni transmite', async () => {
    const configRepo = fakeConfigRepo([
      { id: 'cfg1', hotelId: 'h1', key: 'electronic_invoicing', value: { enabled: false, sequence: 5 } },
    ])
    const result = await issueNcf(configRepo, 'h1', invoiceInput)
    expect(result.ncf).toBeNull()
    expect(configRepo.updated).toHaveLength(0)
  })

  it('config habilitada: genera NCF, incrementa secuencia, y LLAMA al adapter (antes no se llamaba)', async () => {
    const configRepo = fakeConfigRepo([
      { id: 'cfg1', hotelId: 'h1', key: 'electronic_invoicing', value: { enabled: true, serie: 'E31', authority: 'DGII', sequence: 5 } },
    ])
    let calledWith: any = null
    const spyAdapter = {
      issue: async (invoice: any, cfg: any) => {
        calledWith = { invoice, cfg }
        return { sent: false, message: 'pendiente' }
      },
    }
    const result = await issueNcf(configRepo, 'h1', invoiceInput, spyAdapter)

    expect(result.ncf).toBe(buildNcf({ enabled: true, serie: 'E31', authority: 'DGII' }, 6))
    expect(result.fiscalSent).toBe(false)
    expect(result.fiscalMessage).toBe('pendiente')
    // Secuencia incrementada de forma atómica sobre la misma config row.
    expect(configRepo.updated).toEqual([{ id: 'cfg1', data: { value: { enabled: true, serie: 'E31', authority: 'DGII', sequence: 6 } } }])
    // El adapter recibe el NCF ya construido, no lo recalcula por su cuenta.
    expect(calledWith.invoice.ncf).toBe(result.ncf)
    expect(calledWith.invoice.hotelId).toBe('h1')
  })

  it('stubFiscalAdapter real: siempre sent:false con mensaje de "pendiente de envío"', async () => {
    const configRepo = fakeConfigRepo([
      { id: 'cfg1', hotelId: 'h1', key: 'electronic_invoicing', value: { enabled: true, authority: 'DGII', sequence: 0 } },
    ])
    const result = await issueNcf(configRepo, 'h1', invoiceInput, stubFiscalAdapter)
    expect(result.fiscalSent).toBe(false)
    expect(result.fiscalMessage).toContain('DGII')
    expect(result.fiscalMessage).toContain(result.ncf)
  })

  it('el adapter tira: conserva el NCF ya consumido, marca fiscalSent false con el motivo', async () => {
    const configRepo = fakeConfigRepo([
      { id: 'cfg1', hotelId: 'h1', key: 'electronic_invoicing', value: { enabled: true, sequence: 0 } },
    ])
    const brokenAdapter = { issue: async () => { throw new Error('timeout DGII') } }
    const result = await issueNcf(configRepo, 'h1', invoiceInput, brokenAdapter)

    expect(result.ncf).not.toBeNull()
    expect(result.fiscalSent).toBe(false)
    expect(result.fiscalMessage).toBe('timeout DGII')
    // La secuencia ya se incrementó — no se pierde el número aunque falle la transmisión.
    expect(configRepo.updated).toHaveLength(1)
  })

  it('findOne del configRepo tira: no revienta la creación de la factura', async () => {
    const brokenRepo = { findOne: async () => { throw new Error('db down') } } as unknown as RepositoryAdapter<any>
    const result = await issueNcf(brokenRepo, 'h1', invoiceInput)
    expect(result).toEqual({ ncf: null, fiscalSent: false, fiscalMessage: null })
  })
})
