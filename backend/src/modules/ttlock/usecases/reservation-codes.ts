// usecases/reservation-codes.ts — Generación AUTOMÁTICA del código de acceso (flujo de la seña).
// Extraído de service.ts para no volverlo un God Object (>200 líneas, gate del analyzer).

export interface GenerateIfAbsentDeps {
  listCodesByHotel(hotelId: string): Promise<any[]>
  findReservationById(id: string): Promise<any>
  findLocksByRoom(roomId: string): Promise<any[]>
  generate(hotelId: string, reservationId: string): Promise<any>
}

/**
 * Genera el código solo si la reserva no tiene ya uno ACTIVO. Es el punto de entrada de la
 * generación automática (al pagarse la seña): `generateCode` siempre inserta, así que el reintento
 * del webhook de Stripe o varios Links de Pago para la misma reserva duplicarían PINs. El botón
 * manual ("Regenerar") sigue usando `generateCode` directo, porque ahí regenerar es intencional.
 */
export async function generateCodeIfAbsent(
  deps: GenerateIfAbsentDeps,
  hotelId: string,
  reservationId: string,
): Promise<any> {
  const codes = await deps.listCodesByHotel(hotelId)
  // 'pending' cuenta como existente: es el código emitido cuando la cerradura estaba offline.
  // Sin esto, cada reintento del webhook duplicaría la fila pendiente para la misma reserva.
  const existing = codes.find((c: any) => c.reservationId === reservationId && (c.status === 'active' || c.status === 'pending'))
  if (existing) return { skipped: true, reason: `already-${existing.status}` }
  // Toggle por cerradura: si la cerradura de la habitación tiene los auto-códigos apagados, NO generar
  // en el flujo automático (el botón manual sí, porque `generateCode` no pasa por acá). Filas viejas
  // sin el campo (undefined/NULL) cuentan como habilitado — solo `=== false` apaga.
  const res = await deps.findReservationById(reservationId)
  if (res?.roomId) {
    const lock = (await deps.findLocksByRoom(res.roomId))[0] as any
    if (lock && lock.autoCodesEnabled === false) return { skipped: true, reason: 'auto-disabled' }
  }
  return deps.generate(hotelId, reservationId)
}

/**
 * Regla de negocio: una reserva tiene UN solo código vigente. Al generar/regenerar (automático o
 * manual), los códigos ANTERIORES de esa reserva se revocan — pero recién DESPUÉS de que el nuevo
 * existió (si el nuevo falló, el viejo sigue: nunca se queda sin código). Best-effort por código:
 * si un revoke falla (ej. hardware inalcanzable) se loguea y se continúa con el resto; el PIN
 * físico viejo queda vivo hasta el próximo revoke manual (visible en el tab Códigos).
 */
export interface KeepSingleCodeDeps {
  listByReservation(reservationId: string): Promise<any[]>
  revoke(codeId: string): Promise<void>
  log?: { warn(msg: string, meta?: unknown): unknown }
}
export async function keepSingleCode(
  deps: KeepSingleCodeDeps,
  reservationId: string,
  keepId: string,
): Promise<void> {
  const codes = await deps.listByReservation(reservationId)
  for (const c of codes) {
    if (c.id === keepId || (c.status !== 'active' && c.status !== 'pending')) continue
    try {
      await deps.revoke(c.id)
    } catch (e: any) {
      deps.log?.warn?.('keepSingleCode: no se pudo revocar el código anterior', { codeId: c.id, error: e?.message })
    }
  }
}
