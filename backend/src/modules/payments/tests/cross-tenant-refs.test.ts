// cross-tenant-refs.test.ts — Un pago no puede apuntar al folio/factura/huésped de OTRO hotel.
//
// El `hotelId` del pago ya lo fuerza el controller desde el token, pero los campos de relación
// (`folioId`, `invoiceId`, `guestId`) viajaban en el body sin verificar: se podía crear un pago
// propio colgado de un folio ajeno, dejando filas cruzadas entre hoteles.
//
// Es el mismo patrón del IDOR de reservas (`guestId`, commit a135c15). Por eso el guard es
// FAIL-CLOSED: si falta el repo para comprobar, rechaza. Aquel agujero sobrevivió al primer fix
// justamente por ser opt-in — bastaba no inyectar la dependencia para que el control desapareciera.
import { describe, it, expect } from 'bun:test'
import { PaymentCrudUseCase } from '../usecases/payment-crud'
import { silentLogger } from 'arckode-framework/testing'

const MY_HOTEL = 'hotel-a'
const OTHER_HOTEL = 'hotel-b'

function makeRepo() {
  const rows: any[] = []
  return {
    rows,
    repo: {
      create: async (data: any) => { const row = { id: 'pay-1', ...data }; rows.push(row); return row },
      findMany: async () => [],
      findOne: async () => null,
      findById: async () => null,
      update: async () => null,
    } as any,
  }
}

/** Repo de referencias donde TODO pertenece a `hotelId`. */
const refsOf = (hotelId: string) => ({ findOne: async ({ id }: any) => ({ id, hotelId }) }) as any

const basePayment = {
  hotelId: MY_HOTEL, type: 'charge', method: 'cash', amount: 100, currency: 'USD',
} as any

describe('PaymentCrudUseCase.create — referencias cruzadas entre hoteles', () => {
  it('rechaza un folio de otro hotel y no crea el pago', async () => {
    const { repo, rows } = makeRepo()
    const crud = new PaymentCrudUseCase(repo, silentLogger(), undefined, undefined, refsOf(OTHER_HOTEL))

    await expect(crud.create({ ...basePayment, folioId: 'folio-ajeno' }))
      .rejects.toThrow('El folio no pertenece a este hotel')
    expect(rows).toHaveLength(0)
  })

  it('rechaza un huésped de otro hotel', async () => {
    const { repo } = makeRepo()
    const crud = new PaymentCrudUseCase(repo, silentLogger(), undefined, undefined, undefined, undefined, refsOf(OTHER_HOTEL))

    await expect(crud.create({ ...basePayment, guestId: 'guest-ajeno' }))
      .rejects.toThrow('El huésped no pertenece a este hotel')
  })

  it('rechaza una factura de otro hotel', async () => {
    const { repo } = makeRepo()
    const crud = new PaymentCrudUseCase(repo, silentLogger(), undefined, undefined, undefined, refsOf(OTHER_HOTEL))

    await expect(crud.create({ ...basePayment, invoiceId: 'inv-ajena' }))
      .rejects.toThrow('La factura no pertenece a este hotel')
  })

  it('FAIL-CLOSED: sin repo para verificar, rechaza en vez de dejar pasar', async () => {
    const { repo, rows } = makeRepo()
    const crud = new PaymentCrudUseCase(repo, silentLogger())   // sin repos de referencia

    await expect(crud.create({ ...basePayment, folioId: 'folio-x' }))
      .rejects.toThrow(/No se puede verificar/)
    expect(rows).toHaveLength(0)
  })

  it('acepta las referencias del PROPIO hotel (el guard no molesta al caso normal)', async () => {
    const { repo, rows } = makeRepo()
    const mine = refsOf(MY_HOTEL)
    const crud = new PaymentCrudUseCase(repo, silentLogger(), undefined, undefined, mine, mine, mine)

    const payment = await crud.create({
      ...basePayment, folioId: 'folio-mio', invoiceId: 'inv-mia', guestId: 'guest-mio',
    })

    expect(payment.hotelId).toBe(MY_HOTEL)
    expect(rows).toHaveLength(1)
  })

  it('un pago sin referencias no necesita ningún repo', async () => {
    const { repo, rows } = makeRepo()
    const crud = new PaymentCrudUseCase(repo, silentLogger())

    const payment = await crud.create({ ...basePayment })

    expect(payment.amount).toBe(100)
    expect(rows).toHaveLength(1)
  })
})
