// cancellation/usecases/policies-crud.ts — CRUD admin de políticas (F3 plan #627).
// Extracción del service para mantener CancellationService < 200 líneas (molde:
// admin/usecases/module-overrides.ts, facturas/usecases/policy-text.ts).
//
// Invariante de unicidad: existe UNA sola fila scope='base' por hotel. Si se llama
// upsertBase y ya existe → update; si no → create. Los overrides (scope='channel') se
// identifican por (hotelId, scope, scopeId) → upsert.
//
// Regla de borrado de la base: NO se permite borrar la base mientras queden overrides
// activos. La base es el fallback obligatorio de resolvePolicy (cancellation-math.ts);
// borrarla con overrides huérfanos dejaría al hotel sin política default efectiva. El
// merchant debe borrar primero los overrides. Documentado en F3.

import { ValidationError, type RepositoryAdapter, type Logger } from 'arckode-framework'
import type { CancellationPolicyDTO, Tier, PolicyScope } from '../types'

/** Orden de listado: base primero, luego overrides por scope y priority DESC. */
const SCOPE_RANK: Record<string, number> = { base: 0, channel: 1, rate: 2, season: 3 }

/**
 * Valida un array de tiers. Lanza ValidationError si:
 * - no es array o está vacío (la base necesita al menos 1 tier),
 * - algún tier tiene deadlineHours < 0 o no numérico,
 * - algún tier tiene penaltyPercent fuera de [0, 100] o no numérico,
 * - algún tier no tiene `refundable` booleano.
 *
 * `deadlineHours` puede ser muy grande (ej: 99_999 en flexible = "siempre reembolsable").
 */
export function validateTiers(tiers: unknown, opts: { allowEmpty?: boolean } = {}): asserts tiers is Tier[] {
  if (!Array.isArray(tiers)) throw new ValidationError('tiers debe ser un array')
  if (tiers.length === 0 && !opts.allowEmpty) {
    throw new ValidationError('tiers no puede estar vacío (agregá al menos un nivel de penalidad)')
  }
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i] as any
    const where = `tiers[${i}]`
    if (t == null || typeof t !== 'object') throw new ValidationError(`${where} debe ser un objeto`)
    if (typeof t.deadlineHours !== 'number' || Number.isNaN(t.deadlineHours)) {
      throw new ValidationError(`${where}.deadlineHours debe ser numérico`)
    }
    if (t.deadlineHours < 0) throw new ValidationError(`${where}.deadlineHours no puede ser negativo`)
    if (typeof t.penaltyPercent !== 'number' || Number.isNaN(t.penaltyPercent)) {
      throw new ValidationError(`${where}.penaltyPercent debe ser numérico`)
    }
    if (t.penaltyPercent < 0 || t.penaltyPercent > 100) {
      throw new ValidationError(`${where}.penaltyPercent debe estar entre 0 y 100`)
    }
    if (typeof t.refundable !== 'boolean') {
      throw new ValidationError(`${where}.refundable debe ser booleano (true/false)`)
    }
  }
}

/** Sanitiza tiers: copia solo los campos del contrato Tier (descarta extras del body). */
export function sanitizeTiers(tiers: Tier[]): Tier[] {
  return tiers.map((t) => {
    const out: Tier = {
      deadlineHours: Math.round(t.deadlineHours),
      penaltyPercent: Math.round(t.penaltyPercent),
      refundable: t.refundable,
    }
    if (typeof t.label === 'string' && t.label.trim()) out.label = t.label.trim()
    return out
  })
}

export class PoliciesCrudUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<CancellationPolicyDTO>,
    private readonly logger: Logger,
  ) {}

  /**
   * Lista todas las políticas del hotel: base primero, luego overrides ordenados por
   * scope (channel < rate < season) y priority DESC dentro del mismo scope.
   */
  async list(hotelId: string): Promise<CancellationPolicyDTO[]> {
    const all = (await this.repo.findMany({ hotelId } as any)) as CancellationPolicyDTO[]
    return all.sort((a, b) => {
      const ra = SCOPE_RANK[a.scope] ?? 99
      const rb = SCOPE_RANK[b.scope] ?? 99
      if (ra !== rb) return ra - rb
      // Mismo scope: mayor priority primero (más específica).
      return (b.priority ?? 0) - (a.priority ?? 0)
    })
  }

  /**
   * Upsert de la política BASE del hotel (scope='base', scopeId='').
   * Invariante: una sola base por hotel. Si existe → update; si no → create.
   */
  async upsertBase(hotelId: string, tiers: Tier[], name?: string): Promise<CancellationPolicyDTO> {
    validateTiers(tiers)
    const clean = sanitizeTiers(tiers)
    const existing = await this.findBase(hotelId)
    const payload = {
      hotelId,
      scope: 'base' as PolicyScope,
      scopeId: '',
      name: typeof name === 'string' ? name.slice(0, 200) : '',
      tiers: clean,
      priority: 0,
      active: true,
    }
    if (existing) {
      this.logger.info('Actualizando política base', { hotelId, id: existing.id })
      const updated = await this.repo.update(existing.id, payload as any)
      if (!updated) throw new ValidationError('No se pudo actualizar la política base')
      return updated
    }
    this.logger.info('Creando política base', { hotelId })
    return await this.repo.create({ id: crypto.randomUUID(), ...payload } as any)
  }

  /**
   * Upsert de un override (scope='channel', scopeId=canal).
   * Se identifica por (hotelId, scope, scopeId): si existe → update; si no → create.
   * No permite crear un override si NO existe la base (la base es prerequisito).
   */
  async upsertOverride(
    hotelId: string,
    input: { scope: 'channel'; scopeId: string; tiers: Tier[]; name?: string; priority?: number },
  ): Promise<CancellationPolicyDTO> {
    if (input.scope !== 'channel') {
      // F3 soporta solo overrides por canal. rate/season son fases posteriores.
      throw new ValidationError(`scope '${input.scope}' no soportado (usá 'channel')`)
    }
    if (!input.scopeId || typeof input.scopeId !== 'string') {
      throw new ValidationError('scopeId es requerido para un override por canal')
    }
    validateTiers(input.tiers)
    const clean = sanitizeTiers(input.tiers)

    const base = await this.findBase(hotelId)
    if (!base) {
      throw new ValidationError(
        'No existe una política base para este hotel. Guardá primero la política base antes de añadir overrides por canal.',
      )
    }

    const existing = await this.findOverride(hotelId, input.scope, input.scopeId)
    const payload = {
      hotelId,
      scope: input.scope,
      scopeId: input.scopeId,
      name: typeof input.name === 'string' ? input.name.slice(0, 200) : '',
      tiers: clean,
      priority: typeof input.priority === 'number' ? input.priority : 0,
      active: true,
    }
    if (existing) {
      this.logger.info('Actualizando override', { hotelId, scope: input.scope, scopeId: input.scopeId })
      const updated = await this.repo.update(existing.id, payload as any)
      if (!updated) throw new ValidationError('No se pudo actualizar el override')
      return updated
    }
    this.logger.info('Creando override', { hotelId, scope: input.scope, scopeId: input.scopeId })
    return await this.repo.create({ id: crypto.randomUUID(), ...payload } as any)
  }

  /**
   * Borra una política por id. Reglas:
   * - Si es la base (scope='base') y quedan overrides activos → ValidationError (borrar overrides primero).
   * - El caller debe verificar ownership (hotelId match) antes de llamar.
   */
  async delete(id: string, hotelId: string): Promise<void> {
    const item = (await this.repo.findOne({ id } as any)) as CancellationPolicyDTO | null
    if (!item) throw new ValidationError('Política de cancelación no encontrada')
    if (item.hotelId !== hotelId) {
      // Defensa en profundidad: el controller ya filtra por hotelId del token, pero el
      // usecase vuelve a chequear (anti-IDOR cross-tenant).
      throw new ValidationError('Política de cancelación no encontrada')
    }
    if (item.scope === 'base') {
      const all = (await this.repo.findMany({ hotelId } as any)) as CancellationPolicyDTO[]
      const hasOverrides = all.some((p) => p.id !== id && p.scope !== 'base' && p.active !== false)
      if (hasOverrides) {
        throw new ValidationError(
          'No se puede borrar la política base mientras existan overrides por canal. Borralos primero.',
        )
      }
    }
    this.logger.info('Borrando política', { id, scope: item.scope })
    await this.repo.delete(id)
  }

  private async findBase(hotelId: string): Promise<CancellationPolicyDTO | null> {
    const all = (await this.repo.findMany({ hotelId, scope: 'base' } as any)) as CancellationPolicyDTO[]
    return all.find((p) => p.scope === 'base' && (!p.scopeId || p.scopeId === '')) ?? null
  }

  private async findOverride(
    hotelId: string,
    scope: string,
    scopeId: string,
  ): Promise<CancellationPolicyDTO | null> {
    const all = (await this.repo.findMany({ hotelId, scope, scopeId } as any)) as CancellationPolicyDTO[]
    return all[0] ?? null
  }
}
