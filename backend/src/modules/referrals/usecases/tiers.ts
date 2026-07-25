// referrals/usecases/tiers.ts — CRUD de tramos escalonados (PLAN-REFERIDOS.md §3).
// Sin CAS ni concurrencia especial (a diferencia de special_category_config): son filas de
// config editadas por un super admin a la vez, un RepositoryAdapter normal alcanza.
import type { RepositoryAdapter } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { ReferralTierDTO } from '../types'

/** Los tramos son un recurso de la PLATAFORMA (no de un hotel) — mismo centinela y criterio
 *  que admin/service.ts (`PLATFORM_RESOURCE`): nunca coincide con un `user.id`, así que
 *  `assertOwnership` solo pasa por la puerta del rol `super_admin`. */
const PLATFORM_RESOURCE = '__platform__'

export class ReferralTiersUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<ReferralTierDTO>,
    private readonly auth?: any,
  ) {}

  async list(): Promise<{ data: ReferralTierDTO[]; total: number }> {
    const data = (await this.repo.findMany({})) as ReferralTierDTO[]
    data.sort((a, b) => a.fromCount - b.fromCount)
    return { data, total: data.length }
  }

  async create(body: any): Promise<ReferralTierDTO> {
    this.validate(body)
    return this.repo.create({
      id: crypto.randomUUID(), fromCount: body.fromCount, monthsGranted: body.monthsGranted, sortOrder: body.sortOrder ?? body.fromCount,
    } as any) as unknown as ReferralTierDTO
  }

  async update(id: string, body: any, user?: any): Promise<ReferralTierDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tramo no encontrado')
    if (this.auth) this.auth.assertOwnership(PLATFORM_RESOURCE, user?.id ?? '', user?.role, 'super_admin')
    this.validate({ ...existing, ...body })
    const patch: Record<string, any> = {}
    for (const k of ['fromCount', 'monthsGranted', 'sortOrder']) if (body[k] !== undefined) patch[k] = body[k]
    return this.repo.update(id, patch) as unknown as ReferralTierDTO
  }

  async remove(id: string, user?: any): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tramo no encontrado')
    if (this.auth) this.auth.assertOwnership(PLATFORM_RESOURCE, user?.id ?? '', user?.role, 'super_admin')
    await this.repo.delete(id)
  }

  private validate(body: any): void {
    if (body.fromCount == null || Number(body.fromCount) < 1) throw new ValidationError('fromCount debe ser >= 1')
    if (body.monthsGranted == null || Number(body.monthsGranted) < 0) throw new ValidationError('monthsGranted debe ser >= 0')
  }

  /** Meses que corresponden al referido nº `count` según los tramos vigentes — el tramo con
   *  `fromCount` más alto que sea <= count. Sin tramos configurados, no otorga nada (0), nunca
   *  inventa un default en código: si el admin no cargó tramos, el programa no premia. */
  static tierMonths(count: number, tiers: ReferralTierDTO[]): number {
    const applicable = tiers.filter((t) => t.fromCount <= count).sort((a, b) => b.fromCount - a.fromCount)
    return applicable[0]?.monthsGranted ?? 0
  }
}
