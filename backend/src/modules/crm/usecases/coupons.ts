// crm/usecases/coupons.ts — Cupones de descuento.
//
// `useCoupon` consumía un uso con `{ useCount: { increment: 1 } }`, que el ORM no entiende: copiaba
// el objeto al campo. El contador nunca subía y `maxUses` era decorativo — el cupón valía para
// siempre. Acá se lee, se suma y se escribe.
//
// Ojo: validar un cupón NO lo consume. Y hoy ningún módulo de dinero (facturas, folios, payments)
// conoce los cupones: el descuento no se aplica en ninguna parte.

import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { CouponDTO, CreateCouponDTO } from '../types'

export interface CouponDeps {
  repo: RepositoryAdapter<CouponDTO>
  auth?: Auth
  onUsed?: (couponId: string) => Promise<void>
}

const assertOwned = (deps: CouponDeps, coupon: CouponDTO, hotelId: string, role?: string): void => {
  if (deps.auth) deps.auth.assertOwnership(coupon.hotelId, hotelId, role ?? '', 'super_admin')
}

async function findOrFail(deps: CouponDeps, id: string, hotelId: string, role?: string): Promise<CouponDTO> {
  const coupon = await deps.repo.findById(id)
  if (!coupon) throw new NotFoundError('Coupon not found')
  assertOwned(deps, coupon, hotelId, role)
  return coupon
}

const isExhausted = (coupon: CouponDTO): boolean =>
  !!coupon.maxUses && Number(coupon.useCount ?? 0) >= coupon.maxUses

export class CouponUseCase {
  constructor(private readonly deps: CouponDeps) {}

  async create(dto: CreateCouponDTO): Promise<CouponDTO> {
    // Un descuento porcentual > 100% no tiene sentido (regalaría el cuarto y pagaría de más). El
    // schema valida `value >= 1` pero no puede topear condicionalmente por tipo, así que se hace acá.
    // async: el throw viaja como promesa rechazada, no como excepción síncrona.
    if (dto.type === 'percentage' && Number(dto.value) > 100) {
      throw new ValidationError('Un descuento porcentual no puede superar el 100%')
    }
    return this.deps.repo.create({ ...dto, useCount: 0, active: 1 } as any)
  }

  getById(id: string, hotelId: string, role?: string): Promise<CouponDTO> {
    return findOrFail(this.deps, id, hotelId, role)
  }

  list(hotelId: string): Promise<CouponDTO[]> {
    return this.deps.repo.findMany({ hotelId, active: 1 })
  }

  /** Comprueba que el cupón se pueda usar. NO lo consume: para eso está `use`. */
  async validate(code: string, hotelId: string, purchaseAmount: number): Promise<CouponDTO> {
    const coupons = await this.deps.repo.findMany({ hotelId, code, active: 1 })
    const coupon = coupons[0]
    if (!coupon) throw new NotFoundError('Coupon not found')
    if (isExhausted(coupon)) throw new ValidationError('Coupon limit reached')
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) throw new ValidationError('Coupon expired')
    if (coupon.minPurchase > purchaseAmount) throw new ValidationError(`Minimum purchase: $${coupon.minPurchase}`)
    return coupon
  }

  /** Consume un uso. Sin esto, `maxUses` no limita nada. */
  async use(id: string, hotelId: string, role?: string): Promise<CouponDTO> {
    const coupon = await findOrFail(this.deps, id, hotelId, role)
    if (isExhausted(coupon)) throw new ValidationError('Coupon limit reached')

    const updated = await this.deps.repo.update(id, { useCount: Number(coupon.useCount ?? 0) + 1 } as any)
    await this.deps.onUsed?.(coupon.id)
    return (updated ?? coupon) as CouponDTO
  }

  /**
   * Baja lógica: el cupón queda inactivo, no se borra. Su historial de usos sigue existiendo.
   * Devuelve el cupón tal como estaba: el service lo necesita para el audit log (SC-05).
   */
  async deactivate(id: string, hotelId: string, role?: string): Promise<CouponDTO> {
    const coupon = await findOrFail(this.deps, id, hotelId, role)
    await this.deps.repo.update(id, { active: 0 } as any)
    return coupon
  }
}
