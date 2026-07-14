// pricing/usecases/audit.ts — Puerto de auditoría del tarifario (SC-05).
//
// El módulo NO importa auditlog: declara el puerto y el connector `pricing-auditlog` inyecta la
// implementación (regla del framework, sin imports cross-módulo).
//
// Un cambio de tarifa es plata: baja el precio de una suite un 40% y nadie se entera hasta el cierre
// del mes. Lo mismo el borrado de un bloqueo (libera una habitación que estaba fuera de venta) y las
// restricciones (cerrar/abrir la venta de un tipo de habitación). Se audita QUIÉN y QUÉ cambió, con
// el precio anterior. Auditar nunca puede tumbar la operación (`auditSafely`).

import type { AuditEntry, AuditPort } from '../../../shared/usecases/audit'

export type { AuditEntry, AuditPort }
export { auditSafely } from '../../../shared/usecases/audit'

export type Actor = { id?: string; role?: string } | undefined

export interface RateChange {
  roomType: string
  season: string
  occupancy: number
  /** Precio anterior. `null` = la tarifa no existía (alta). */
  from: number | null
  to: number
  closed: number
}

/** Cuántos cambios se listan en el detalle antes de resumir. Un grid entero son cientos de celdas. */
const MAX_DETAIL = 8

function describe(c: RateChange): string {
  const where = `${c.roomType}/${c.season}/${c.occupancy}p`
  const price = c.from === null ? `alta ${c.to}` : `${c.from} → ${c.to}`
  return `${where}: ${price}${c.closed ? ' (cerrada)' : ''}`
}

export function rateChangeEntry(hotelId: string, changes: RateChange[], actor: Actor): AuditEntry {
  const listed = changes.slice(0, MAX_DETAIL).map(describe).join(' · ')
  const rest = changes.length > MAX_DETAIL ? ` · +${changes.length - MAX_DETAIL} más` : ''
  return {
    hotelId,
    userId: actor?.id,
    action: 'rate.change',
    entity: 'room_rate',
    detail: `Tarifas modificadas (${changes.length}) · ${listed}${rest}`,
  }
}

export function rateCopyEntry(hotelId: string, copied: number, total: number, actor: Actor): AuditEntry {
  return {
    hotelId,
    userId: actor?.id,
    action: 'rate.copy_next_year',
    entity: 'room_rate',
    detail: `Tarifas copiadas al año siguiente · ${copied} nuevas sobre ${total} existentes`,
  }
}

export function seasonsChangeEntry(hotelId: string, count: number, actor: Actor): AuditEntry {
  return {
    hotelId,
    userId: actor?.id,
    action: 'season.change',
    entity: 'season',
    detail: `Temporadas reemplazadas · ${count} definidas (las anteriores se borran)`,
  }
}

export function restrictionsChangeEntry(hotelId: string, count: number, actor: Actor): AuditEntry {
  return {
    hotelId,
    userId: actor?.id,
    action: 'rate_restriction.change',
    entity: 'rate_restriction',
    detail: `Restricciones de venta modificadas · ${count} combinaciones (minStay/maxStay/CTA/CTD)`,
  }
}

export function blockDeleteEntry(block: { id: string; hotelId: string; roomId?: string; reason?: string; startDate?: string; endDate?: string }, actor: Actor): AuditEntry {
  return {
    hotelId: block.hotelId,
    userId: actor?.id,
    action: 'block.delete',
    entity: 'room_block',
    entityId: block.id,
    detail: `Bloqueo de habitación eliminado · hab ${block.roomId ?? '?'}` +
      ` · ${block.startDate ?? '?'} → ${block.endDate ?? '?'}${block.reason ? ` · ${block.reason}` : ''}`,
  }
}
