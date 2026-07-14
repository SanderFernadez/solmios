// admin/usecases/audit.ts — Puerto de auditoría de la plataforma (SC-05).
//
// Lo que se borra acá no es de un hotel: es de la plataforma entera. Borrar un plan de
// suscripción o una amenity del catálogo impacta a TODOS los tenants, y solo lo puede hacer un
// super_admin. Por eso las entries van sin `hotelId` (no pertenecen a ninguno) y con el `userId`
// del super_admin que las ejecutó.

import type { AuditEntry, AuditPort } from '../../../shared/usecases/audit'

export type { AuditEntry, AuditPort }
export { auditSafely } from '../../../shared/usecases/audit'

export type Actor = { id?: string; role?: string } | undefined

export function planDeleteEntry(plan: { id: string; name?: string; price?: number }, actor: Actor): AuditEntry {
  return {
    userId: actor?.id,
    action: 'plan.delete',
    entity: 'plan',
    entityId: plan.id,
    detail: `Plan de suscripción "${plan.name ?? plan.id}" eliminado${plan.price != null ? ` · ${plan.price}` : ''}`,
  }
}

export function amenityCatalogDeleteEntry(amenity: { id: string; name?: string }, actor: Actor): AuditEntry {
  return {
    userId: actor?.id,
    action: 'amenity_catalog.delete',
    entity: 'amenity_catalog',
    entityId: amenity.id,
    detail: `Amenity del catálogo "${amenity.name ?? amenity.id}" eliminada`,
  }
}
