// housekeeping/usecases/lock-code.ts — Código de entrada (TTLock) de la habitación
// de una tarea, para que la camarera pueda abrir la puerta al ir a limpiar.
//
// OPCIONAL por diseño: si el hotel/habitación NO tiene TTLock (o no hay código
// activo), devuelve `{ code: null }` y la app no muestra nada — el flujo queda
// igual que antes. La camarera tiene `housekeeping:view` pero NO `ttlock:view`,
// por eso este dato se sirve desde housekeeping (no desde el módulo ttlock).

import type { Auth, RepositoryAdapter } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'

export interface RoomLockCode {
  code: string | null
  lockName?: string | null
  codeType?: string | null
  endDate?: string | null
}

interface HkUser { id: string; hotelId?: string; role: string }

export async function getRoomLockCode(
  taskRepo: RepositoryAdapter<any>,
  auth: Auth,
  lockDeviceRepo: RepositoryAdapter<any> | undefined,
  lockCodeRepo: RepositoryAdapter<any> | undefined,
  taskId: string,
  user: HkUser,
): Promise<RoomLockCode> {
  const task = await taskRepo.findById(taskId)
  if (!task) throw new NotFoundError('Tarea no encontrada')
  auth.assertOwnership((task as any).hotelId, user.hotelId ?? '')

  const hotelId = (task as any).hotelId
  const roomId = (task as any).roomId
  // Sin habitación, o sin repos de cerradura cableados: no hay código que dar.
  if (!roomId || !lockDeviceRepo || !lockCodeRepo) return { code: null }

  // La cerradura de esa habitación (si el hotel tiene TTLock en ella).
  const devices = await lockDeviceRepo.findMany({ hotelId, roomId })
  const device = devices?.[0]
  if (!device) return { code: null }

  // Códigos activos de esa cerradura; se prefiere uno vigente por fecha.
  const codes = await lockCodeRepo.findMany({ hotelId, lockId: device.id, status: 'active' })
  const now = new Date().toISOString()
  const valid = (codes ?? []).find(
    (c: any) => (!c.startDate || c.startDate <= now) && (!c.endDate || c.endDate >= now),
  )
  const pick = valid ?? codes?.[0]
  if (!pick) return { code: null, lockName: device.name ?? null }

  return {
    code: pick.code ?? null,
    lockName: device.name ?? null,
    codeType: pick.codeType ?? null,
    endDate: pick.endDate ?? null,
  }
}
