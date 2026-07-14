// ai-recepcionista/usecases/audit-deletes.ts — SC-05: borrado + auditoría de intents y plantillas.
//
// El borrado lee la entidad ANTES de borrarla (necesitamos el nombre para el detalle legible) y
// recién audita si el borrado salió bien. `auditSafely` absorbe cualquier fallo del audit log:
// auditar no puede tumbar la operación. Vive acá y no en el service para no pasar las 200 líneas.

import type { CacheAdapter, Logger } from 'arckode-framework'
import { auditSafely, type AuditPort } from '../../../shared/usecases/audit'
import { getIntent, deleteIntent } from './intents'
import { deleteTemplate } from './templates'

export interface AuditActor { id?: string; hotelId?: string; role?: string }

export interface IntentDeleteDeps {
  repo: any
  cache: CacheAdapter
  logger: Logger
  auditPort: AuditPort | null
}

export async function deleteIntentAudited(
  deps: IntentDeleteDeps, id: string, actor: AuditActor, userHotelId: string, userRole: string,
): Promise<void> {
  const intent = await getIntent(deps.repo, id, userHotelId, userRole)   // ownership + datos para el detalle
  await deleteIntent(deps.repo, deps.cache, id, userHotelId, userRole)
  await auditSafely(deps.auditPort, deps.logger, {
    hotelId: intent.hotelId, userId: actor?.id, action: 'ai_intent.delete',
    entity: 'ai_intent', entityId: id, detail: `Intención "${intent.name}" eliminada`,
  })
}

export interface TemplateDeleteDeps {
  repo: any
  logger: Logger
  auditPort: AuditPort | null
}

export async function deleteTemplateAudited(
  deps: TemplateDeleteDeps, id: string, actor: AuditActor, userHotelId: string, userRole: string,
): Promise<void> {
  // @ignore IDOR_RISK — `deleteTemplate` valida ownership; esta lectura solo arma el detalle del audit.
  const template = await deps.repo.findById(id)
  await deleteTemplate(deps.repo, id, userHotelId, userRole)
  await auditSafely(deps.auditPort, deps.logger, {
    hotelId: template?.hotelId, userId: actor?.id, action: 'ai_template.delete',
    entity: 'ai_template', entityId: id, detail: `Plantilla de IA "${template?.name ?? ''}" eliminada`,
  })
}
