// payroll/tests/controller-hotelid.test.ts — El hotelId sale del token, no del body.
//
// Regresión (mismo patrón que CRM): createRun/createConcept validaban `req.body` ANTES de inyectarle
// el hotelId del token. El schema lo exige y el frontend no lo manda → 400 `hotelId is required`.
// "Nueva Liquidación" y "Nuevo Concepto" estaban rotos desde la UI.

import { describe, it, expect } from 'bun:test'
import { PayrollController } from '../controller'

const silentLog = { info() {}, warn() {}, error() {}, debug() {} } as any

const service = {
  createRun: async (d: any) => d,
  createConcept: async (d: any) => d,
} as any

const controller = new PayrollController(service, silentLog)
const req = (body: any, user: any) => ({ body, user, params: {}, query: {} }) as any

describe('PayrollController — hotelId del token', () => {
  it('crea una liquidación con el body de la UI (sin hotelId)', async () => {
    const res = await controller.createRun(req({ period: '2026-07', startDate: '2026-07-01', endDate: '2026-07-31', paymentDate: '2026-08-01' }, { hotelId: 'h1' }))
    expect(res.status).toBe(201)
    expect((res.body as any).hotelId).toBe('h1')
  })

  it('crea un concepto con el body de la UI (sin hotelId)', async () => {
    const res = await controller.createConcept(req({ code: 'OT', name: 'Horas extra', type: 'earning', calculationMethod: 'fixed', value: 100 }, { hotelId: 'h1' }))
    expect(res.status).toBe(201)
    expect((res.body as any).hotelId).toBe('h1')
  })

  it('el token pisa el hotelId del body: no se crea en un hotel ajeno', async () => {
    // `period` va con formato válido: desde que el schema exige YYYY-MM, un relleno como 'X'
    // aborta en la validación y el test dejaba de ejercitar lo que realmente comprueba (el hotelId).
    const res = await controller.createRun(req({ hotelId: 'ajeno', period: '2026-08', startDate: '2026-08-01', endDate: '2026-08-31', paymentDate: '2026-09-01' }, { hotelId: 'h1' }))
    expect((res.body as any).hotelId).toBe('h1')
  })

  // En producción hay 2 liquidaciones con período '2026-09-1783750850': un cliente pegó el epoch
  // al mes para esquivar el chequeo de unicidad por período y duplicar el mismo mes.
  it('rechaza un período que no sea YYYY-MM', async () => {
    const invalidos = ['2026-09-1783750850', '2026-9', '2026', 'X', '2026-13']
    for (const period of invalidos) {
      await expect(
        controller.createRun(req({ period, startDate: '2026-09-01', endDate: '2026-09-30', paymentDate: '2026-09-30' }, { hotelId: 'h1' })),
      ).rejects.toThrow()
    }
  })

  it('rechaza fechas que no sean YYYY-MM-DD', async () => {
    await expect(
      controller.createRun(req({ period: '2026-09', startDate: '01/09/2026', endDate: '2026-09-30', paymentDate: '2026-09-30' }, { hotelId: 'h1' })),
    ).rejects.toThrow()
  })
})
