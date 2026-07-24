// cash/usecases/shifts.ts — Lógica de turnos de caja (abrir/cerrar/arqueo/actual).
// Recibe dependencias (no conoce el service). Best-effort coherente con el resto del módulo.

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type {
  CashMovementDTO, CashShiftDTO, CashRegister, OpenShiftDTO, CloseShiftDTO,
  ReconcileResult, CurrentUser,
} from '../types'
import type { CashSockets } from '../sockets'
import { reconcileShift } from './reconcile'

export interface ShiftDeps {
  shiftRepo: RepositoryAdapter<CashShiftDTO>
  repo: RepositoryAdapter<CashMovementDTO>
  userRepo: RepositoryAdapter<any>
  auth: Auth
  logger: Logger
  sockets: CashSockets
  hotelOfUser: (user: CurrentUser, dtoHotelId?: string) => string
  bumpVersion: () => void
}

const DEFAULT_REGISTER: CashRegister = 'reception'

/** Turno abierto del hotel para ESE punto de venta (o null). Reception y restaurant nunca comparten turno. */
export async function resolveOpenShift(deps: ShiftDeps, hotelId: string, register: CashRegister = DEFAULT_REGISTER): Promise<string | null> {
  if (!hotelId) return null
  const open = await deps.shiftRepo.findMany({ hotelId, status: 'open', register } as any)
  return open[0]?.id ?? null
}

export async function listShifts(deps: ShiftDeps, hotelId: string | undefined, user: CurrentUser, register: CashRegister = DEFAULT_REGISTER): Promise<CashShiftDTO[]> {
  const hid = deps.hotelOfUser(user, hotelId)
  const shifts = await deps.shiftRepo.findMany({ hotelId: hid || '__none__', register } as any)
  return shifts.sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || ''))
}

export async function getCurrentShift(deps: ShiftDeps, user: CurrentUser, register: CashRegister = DEFAULT_REGISTER): Promise<CashShiftDTO | null> {
  const hotelId = deps.hotelOfUser(user)
  const open = await deps.shiftRepo.findMany({ hotelId: hotelId || '__none__', status: 'open', register } as any)
  return open[0] ?? null
}

export async function openShift(deps: ShiftDeps, dto: OpenShiftDTO, user: CurrentUser, register: CashRegister = DEFAULT_REGISTER): Promise<CashShiftDTO> {
  const hotelId = deps.hotelOfUser(user)
  const current = await getCurrentShift(deps, user, register)
  if (current) throw new ValidationError(`Ya hay un turno de ${register === 'restaurant' ? 'restaurante' : 'recepción'} abierto. Cerralo antes de abrir uno nuevo.`)
  const now = new Date().toISOString()
  const opening = dto.openingAmount || 0
  const shift = await deps.shiftRepo.create({
    hotelId, status: 'open', register, openingAmount: opening, openedBy: user.id, openedAt: now,
    notes: dto.notes, denominations: '{}', difference: 0, expectedAmount: opening,
  } as Omit<CashShiftDTO, 'id'>)
  await deps.sockets.onShiftOpened?.(shift)
  deps.bumpVersion()
  return shift
}

/** Default 'reception': la ruta de recepción no pasa expectedRegister explícito, así que SIN este
 * default cualquiera con permiso `billing` podía cerrar/arquear el turno del restaurante pasando su
 * id a mano (mismo bug de fondo que en list/stats — "sin filtro" quedó leyendo como "todo vale"). */
function assertRegister(shift: CashShiftDTO, expectedRegister: CashRegister = DEFAULT_REGISTER): void {
  const actual = shift.register || DEFAULT_REGISTER
  if (actual !== expectedRegister) {
    throw new ValidationError('Ese turno pertenece a otro punto de venta')
  }
}

export async function closeShift(deps: ShiftDeps, id: string, dto: CloseShiftDTO, user: CurrentUser, expectedRegister?: CashRegister): Promise<CashShiftDTO> {
  const shift = await deps.shiftRepo.findById(id)
  if (!shift) throw new NotFoundError('Turno no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(shift.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  assertRegister(shift, expectedRegister)
  if (shift.status === 'closed') throw new Error('El turno ya está cerrado')
  const movs = shift.id ? await deps.repo.findMany({ shiftId: shift.id } as any) : []
  const rec = reconcileShift(shift, movs)
  const now = new Date().toISOString()
  const updated = await deps.shiftRepo.update(id, {
    status: 'closed', countedAmount: dto.countedAmount, expectedAmount: rec.expected,
    difference: dto.countedAmount - rec.expected, denominations: dto.denominations || '{}',
    closedBy: user.id, closedAt: now, notes: dto.notes,
  } as Partial<Omit<CashShiftDTO, 'id'>>)
  if (!updated) throw new NotFoundError('Turno no encontrado')
  await deps.sockets.onShiftClosed?.(updated)
  deps.bumpVersion()
  return updated
}

export async function reconcile(deps: ShiftDeps, id: string, user: CurrentUser, expectedRegister?: CashRegister): Promise<ReconcileResult> {
  const shift = await deps.shiftRepo.findById(id)
  if (!shift) throw new NotFoundError('Turno no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(shift.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  assertRegister(shift, expectedRegister)
  const movs = shift.id ? await deps.repo.findMany({ shiftId: shift.id } as any) : []
  return reconcileShift(shift, movs)
}
