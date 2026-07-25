// admin/usecases/subscription-categories.ts — Config de cupos Fundador Uno/Dos/Pionero
// (PLAN-SUSCRIPCIONES.md §2 Grupo A, §6 pantalla de cupos). Cero hardcode: la exclusión de
// fase (Fundador Uno/Dos no pueden estar 'open' a la vez) es genérica por `sequenceGroup`,
// no un `if` especial para esas dos categorías — si mañana se agrega "Fundador Tres" alcanza
// con configurarlo, no reprogramarlo.
import { ValidationError, NotFoundError } from 'arckode-framework'

export class SubscriptionCategoriesUseCase {
  constructor(private readonly orm: any) {}

  async list(): Promise<{ data: any[]; total: number }> {
    const data = await this.orm.findMany('SpecialCategoryConfig', {})
    return { data, total: data.length }
  }

  async update(key: string, patch: any): Promise<any> {
    const target = (await this.orm.findMany('SpecialCategoryConfig', { key }))[0]
    if (!target) throw new NotFoundError('Categoría no encontrada')

    const nextStatus = patch.status ?? target.status
    if (nextStatus === 'open' && target.sequenceGroup) {
      const siblings = ((await this.orm.findMany('SpecialCategoryConfig', {})) as any[])
        .filter((c) => c.sequenceGroup === target.sequenceGroup && c.key !== key)

      const otherOpen = siblings.find((c) => c.status === 'open')
      if (otherOpen) {
        throw new ValidationError(`No se puede abrir "${key}": "${otherOpen.key}" (mismo grupo) sigue abierta`)
      }
      if (target.opensAfter) {
        const prereq = siblings.find((c) => c.key === target.opensAfter)
        if (prereq && prereq.status !== 'full' && prereq.status !== 'closed') {
          throw new ValidationError(`"${key}" solo puede abrir cuando "${target.opensAfter}" esté cerrada o llena`)
        }
      }
    }

    const allowed = ['totalSlots', 'discountPct', 'minPlanSortOrder', 'sequenceGroup', 'opensAfter', 'status']
    const safePatch: Record<string, any> = {}
    for (const k of allowed) if (patch[k] !== undefined) safePatch[k] = patch[k]
    // Bajar totalSlots por debajo de lo ya ocupado dejaría occupiedCount>totalSlots (inconsistente
    // con el CAS de special-conditions.ts, que asume totalSlots como techo real).
    if (safePatch.totalSlots !== undefined && safePatch.totalSlots < target.occupiedCount) {
      throw new ValidationError(`No se puede bajar el cupo a ${safePatch.totalSlots}: ya hay ${target.occupiedCount} ocupados`)
    }

    return this.orm.update('SpecialCategoryConfig', target.id, safePatch)
  }
}
