// usecases/code-purge.ts — Borrado masivo de los códigos HISTÓRICOS de una cerradura.
// Es un limpiado de BD puro: los 'revoked'/'expired' ya no abren la puerta (su PIN físico
// se borró del hardware al revocar/expirar), solo ensucian el listado. Archivo propio
// (no en service.ts) por el gate de 200 líneas del analyzer.

export interface PurgeDeps {
  lockDevicesRepo: { findById(id: string): Promise<any> }
  lockCodesRepo: { findMany(filter: any): Promise<any[]>; delete(id: string): Promise<boolean> }
  auth?: any
}

/**
 * Borra de `lock_codes` las filas de esa cerradura con status 'revoked' o 'expired' y
 * devuelve cuántas eliminó. NO toca 'active'/'pending' (vigentes) ni 'expire_failed'
 * (ese estado existe porque el PIN físico quedó vivo: borrar la fila escondería un
 * problema de seguridad — ver `expireCodesByReservation` en service.ts).
 */
export async function purgeInactiveCodes(deps: PurgeDeps, hotelId: string, lockDeviceId: string): Promise<number> {
  const lock = await deps.lockDevicesRepo.findById(lockDeviceId)
  if (!lock) throw new Error('Cerradura no encontrada')
  if (deps.auth) deps.auth.assertOwnership(lock.hotelId, hotelId, undefined, 'super_admin')
  const codes = await deps.lockCodesRepo.findMany({ lockId: lockDeviceId }) as any[]
  let deleted = 0
  for (const c of codes) {
    if (c.status !== 'revoked' && c.status !== 'expired') continue
    if (await deps.lockCodesRepo.delete(c.id)) deleted++
  }
  return deleted
}
