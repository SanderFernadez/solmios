// ttlock/usecases/ttlock-hardware.ts — Operaciones que leen/actúan sobre el hardware TTLock
// (gateways, códigos activos, registros, apertura remota, borrado de PIN). Extraído del service
// para no volverlo un God Object (>200 líneas). Todas validan ownership sobre la cerradura.

import { listGateways, listLockPasscodes, listLockRecords, unlockLock, deleteKeyboardPassword, listLockGateways, addPermanentPasscode, randomPin } from '../../../services/ttlock-client'

const MS_PER_DAY = 86_400_000

export interface HardwareDeps {
  lockDevicesRepo: any
  lockCodesRepo: any
  queries: { getTtlockConfig: (hotelId: string) => Promise<any> }
  auth?: any
}

function credsFrom(cfg: any) {
  return { clientId: cfg.clientId, accessToken: cfg.accessToken, region: cfg.region, addType: cfg.addType }
}

/** Config conectada del hotel (throw si no está conectado). */
async function connectedConfig(deps: HardwareDeps, hotelId: string) {
  const cfg = await deps.queries.getTtlockConfig(hotelId)
  if (!cfg?.accessToken) throw new Error('TTLock no conectado')
  return cfg
}

/** Resuelve la cerradura (con ownership) + la config conectada. `lockDeviceId` es id de nuestra tabla. */
async function resolveLock(deps: HardwareDeps, hotelId: string, lockDeviceId: string) {
  const lock = await deps.lockDevicesRepo.findById(lockDeviceId)
  if (!lock) throw new Error('Cerradura no encontrada')
  if (deps.auth) deps.auth.assertOwnership(lock.hotelId, hotelId, undefined, 'super_admin')
  if (!lock.ttlockLockId) throw new Error('Cerradura sin ID TTLock')
  const cfg = await connectedConfig(deps, hotelId)
  return { lock, cfg }
}

export async function getGateways(deps: HardwareDeps, hotelId: string): Promise<any[]> {
  const cfg = await connectedConfig(deps, hotelId)
  return listGateways(credsFrom(cfg))
}

export async function getActiveCodes(deps: HardwareDeps, hotelId: string, lockDeviceId: string): Promise<any[]> {
  const { lock, cfg } = await resolveLock(deps, hotelId, lockDeviceId)
  return listLockPasscodes(credsFrom(cfg), Number(lock.ttlockLockId))
}

export async function getRecords(deps: HardwareDeps, hotelId: string, lockDeviceId: string, days = 30): Promise<any[]> {
  const { lock, cfg } = await resolveLock(deps, hotelId, lockDeviceId)
  const end = Date.now()
  const start = end - days * MS_PER_DAY
  return listLockRecords(credsFrom(cfg), Number(lock.ttlockLockId), start, end)
}

export async function openLock(deps: HardwareDeps, hotelId: string, lockDeviceId: string): Promise<void> {
  const { lock, cfg } = await resolveLock(deps, hotelId, lockDeviceId)
  await unlockLock(credsFrom(cfg), Number(lock.ttlockLockId))
}

/** Gateway(s) que alcanzan esta cerradura, con señal — "dónde está conectada". */
export async function getLockGateways(deps: HardwareDeps, hotelId: string, lockDeviceId: string): Promise<any[]> {
  const { lock, cfg } = await resolveLock(deps, hotelId, lockDeviceId)
  return listLockGateways(credsFrom(cfg), Number(lock.ttlockLockId))
}

/** Crea un código fijo (permanente) de staff. Si no se pasa `code`, se genera uno. */
export async function createPermanentCode(deps: HardwareDeps, hotelId: string, lockDeviceId: string, code?: string, name?: string): Promise<{ code: string; keyboardPwdId?: string }> {
  const { lock, cfg } = await resolveLock(deps, hotelId, lockDeviceId)
  const pwd = code && /^\d{4,9}$/.test(code) ? code : randomPin()
  const r = await addPermanentPasscode(credsFrom(cfg), Number(lock.ttlockLockId), pwd, name)
  return { code: pwd, keyboardPwdId: r.keyboardPwdId }
}

/**
 * Borra un PIN directo del hardware y sincroniza: marca revocada la fila de `lock_codes` que apunte
 * a ese keyboardPwdId, para que la BD no muestre como vigente un código que ya no vive en la puerta.
 */
export async function removePasscode(deps: HardwareDeps, hotelId: string, lockDeviceId: string, keyboardPwdId: string): Promise<void> {
  const { lock, cfg } = await resolveLock(deps, hotelId, lockDeviceId)
  await deleteKeyboardPassword(credsFrom(cfg), Number(lock.ttlockLockId), String(keyboardPwdId))
  const dbCodes = await deps.lockCodesRepo.findMany({ ttlockKeyboardPwdId: String(keyboardPwdId) }) as any[]
  for (const c of dbCodes) {
    if (c.status === 'active' || c.status === 'pending') await deps.lockCodesRepo.update(c.id, { status: 'revoked' })
  }
}
