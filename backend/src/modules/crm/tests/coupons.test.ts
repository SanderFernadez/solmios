import { describe, it, expect } from 'bun:test'
import { CouponUseCase } from '../usecases/coupons'
import type { CouponDTO } from '../types'

function makeUc() {
  const created: any[] = []
  const repo = {
    create: async (d: any) => { created.push(d); return d as CouponDTO },
  } as any
  return { uc: new CouponUseCase({ repo }), created }
}

describe('CouponUseCase.create — tope del descuento porcentual (#397)', () => {
  it('rechaza un porcentaje mayor a 100', async () => {
    const { uc, created } = makeUc()
    await expect(uc.create({ code: 'X', type: 'percentage', value: 150 } as any))
      .rejects.toThrow('no puede superar el 100%')
    expect(created).toHaveLength(0)
  })

  it('acepta un porcentaje válido (<=100)', async () => {
    const { uc } = makeUc()
    const r = await uc.create({ code: 'VERANO50', type: 'percentage', value: 50 } as any)
    expect(r.value).toBe(50)
  })

  it('un monto fijo no está topeado por la regla del 100%', async () => {
    const { uc } = makeUc()
    const r = await uc.create({ code: 'FIJO500', type: 'fixed', value: 500 } as any)
    expect(r.value).toBe(500)
  })
})
