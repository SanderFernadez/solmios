// canales/usecases/audit.ts — Puerto de auditoría del channel manager (SC-05).
//
// El módulo NO importa auditlog: declara el puerto y el connector `canales-auditlog` inyecta la
// implementación (regla del framework, sin imports cross-módulo).
//
// Acá se audita la DISTRIBUCIÓN: borrar la config de canales del hotel corta la conexión con
// Channex y, con ella, la sincronización de disponibilidad y tarifas hacia las OTAs
// (Booking, Airbnb, Expedia). El hotel se sigue vendiendo en las OTAs con inventario viejo →
// overbooking. Sin esta entrada no queda rastro de QUIÉN cortó la distribución.

import type { AuditEntry, AuditPort } from '../../../shared/usecases/audit'
import type { CanalesDTO, CurrentUser } from '../types'

export type { AuditEntry, AuditPort }
export { auditSafely } from '../../../shared/usecases/audit'

export function channelDeleteEntry(config: CanalesDTO, actor: CurrentUser): AuditEntry {
  return {
    hotelId: config.hotelId,
    userId: actor.id,
    action: 'channel.delete',
    entity: 'channel_config',
    entityId: config.id,
    detail: 'Conexión al channel manager eliminada · ' +
      `property ${config.channexPropertyId ?? 'sin sincronizar'}` +
      `${config.lastSync ? ` · último sync ${config.lastSync}` : ''}`,
  }
}
