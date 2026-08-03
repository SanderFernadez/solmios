// aliados/usecases/commission-tiers.ts — Tramos de comisión del Aliado normal (CRUD, mismo
// patrón que referrals/usecases/tiers.ts) + resolución del % vigente. El Aliado Certificado
// NO escala por tramos: siempre 20% fijo desde el primer hotel, cualquiera sea el conteo.
import type { RepositoryAdapter } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { PartnerCommissionTierDTO, PartnerType } from '../types'

/** % fijo del Aliado Certificado — no viene de la tabla de tramos, es una constante de negocio. */
export const CERTIFIED_PARTNER_PERCENT = 20

/** Mismo centinela que referrals/usecases/tiers.ts (PLATFORM_RESOURCE): los tramos son un
 *  recurso de la PLATAFORMA, nunca coincide con un `user.id`, así que assertOwnership solo
 *  deja pasar al rol super_admin. */
const PLATFORM_RESOURCE = '__platform__'

/** Tramos por defecto de arranque (issue #549 — el dueño autorizó valores razonables,
 *  editables después vía admin). Seedeados una sola vez desde index.ts si la tabla está vacía. */
export const DEFAULT_COMMISSION_TIERS: Array<{ fromCount: number; percent: number }> = [
  { fromCount: 0, percent: 10 },
  { fromCount: 5, percent: 12 },
  { fromCount: 10, percent: 15 },
  { fromCount: 20, percent: 18 },
  { fromCount: 40, percent: 20 },
]

/** Tramo con mayor `fromCount <= count` aplica — mismo criterio que
 *  ReferralTiersUseCase.tierMonths / tierMonths() del cron de referidos. Sin tramos
 *  configurados, no inventa un default (0). Aliado Certificado ignora los tramos: fijo 20%. */
export function resolvePercentFromTiers(
  validatedCount: number,
  partnerType: PartnerType,
  tiers: PartnerCommissionTierDTO[],
): number {
  if (partnerType === 'aliado_certificado') return CERTIFIED_PARTNER_PERCENT
  const applicable = tiers.filter((t) => t.fromCount <= validatedCount).sort((a, b) => b.fromCount - a.fromCount)
  return Number(applicable[0]?.percent ?? 0)
}

export class PartnerCommissionTiersUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<PartnerCommissionTierDTO>,
    private readonly auth?: any,
  ) {}

  async list(): Promise<{ data: PartnerCommissionTierDTO[]; total: number }> {
    const data = (await this.repo.findMany({})) as PartnerCommissionTierDTO[]
    data.sort((a, b) => a.fromCount - b.fromCount)
    return { data, total: data.length }
  }

  async create(body: any): Promise<PartnerCommissionTierDTO> {
    this.validate(body)
    return this.repo.create({
      id: crypto.randomUUID(), fromCount: body.fromCount, percent: body.percent, sortOrder: body.sortOrder ?? body.fromCount,
    } as any) as unknown as Promise<PartnerCommissionTierDTO>
  }

  async update(id: string, body: any, user?: any): Promise<PartnerCommissionTierDTO> {
    const existing = (await this.repo.findMany({ id }))[0]
    if (!existing) throw new NotFoundError('Tramo no encontrado')
    if (this.auth) this.auth.assertOwnership(PLATFORM_RESOURCE, user?.id ?? '', user?.role, 'super_admin')
    this.validate({ ...existing, ...body })
    const patch: Record<string, any> = {}
    for (const k of ['fromCount', 'percent', 'sortOrder']) if (body[k] !== undefined) patch[k] = body[k]
    return this.repo.update(id, patch) as unknown as Promise<PartnerCommissionTierDTO>
  }

  async remove(id: string, user?: any): Promise<void> {
    const existing = (await this.repo.findMany({ id }))[0]
    if (!existing) throw new NotFoundError('Tramo no encontrado')
    if (this.auth) this.auth.assertOwnership(PLATFORM_RESOURCE, user?.id ?? '', user?.role, 'super_admin')
    await this.repo.delete(id)
  }

  /** PUT /tiers — reemplaza el set completo (usado por el admin para editar todos los tramos
   *  de una sola vez). Borra los existentes y crea los nuevos; no hay CAS porque es un recurso
   *  de config editado por un super_admin a la vez (mismo criterio que el resto del programa). */
  async replaceAll(items: any[], user?: any): Promise<PartnerCommissionTierDTO[]> {
    if (this.auth) this.auth.assertOwnership(PLATFORM_RESOURCE, user?.id ?? '', user?.role, 'super_admin')
    for (const item of items) this.validate(item)

    const existing = (await this.repo.findMany({})) as PartnerCommissionTierDTO[]
    for (const row of existing) await this.repo.delete(row.id)

    const created: PartnerCommissionTierDTO[] = []
    for (const item of items) {
      created.push(
        (await this.repo.create({
          id: crypto.randomUUID(), fromCount: item.fromCount, percent: item.percent, sortOrder: item.sortOrder ?? item.fromCount,
        } as any)) as unknown as PartnerCommissionTierDTO,
      )
    }
    created.sort((a, b) => a.fromCount - b.fromCount)
    return created
  }

  private validate(body: any): void {
    if (body.fromCount == null || Number(body.fromCount) < 0) throw new ValidationError('fromCount debe ser >= 0')
    if (body.percent == null || Number(body.percent) < 0 || Number(body.percent) > 100) throw new ValidationError('percent debe estar entre 0 y 100')
  }

  static resolvePercent(validatedCount: number, partnerType: PartnerType, tiers: PartnerCommissionTierDTO[]): number {
    return resolvePercentFromTiers(validatedCount, partnerType, tiers)
  }
}

/** Resuelve el % vigente para un partner leyendo los tramos desde el repo — usado por el
 *  service para /aliados/me. El cron de referidos NO usa esta función (no puede importar de
 *  `modules/aliados/`, ver referral-credits-cron.ts): reimplementa el mismo criterio inline. */
export async function resolvePercent(
  tiersRepo: RepositoryAdapter<PartnerCommissionTierDTO>,
  validatedCount: number,
  partnerType: PartnerType,
): Promise<number> {
  if (partnerType === 'aliado_certificado') return CERTIFIED_PARTNER_PERCENT
  const tiers = (await tiersRepo.findMany({})) as PartnerCommissionTierDTO[]
  return resolvePercentFromTiers(validatedCount, partnerType, tiers)
}
