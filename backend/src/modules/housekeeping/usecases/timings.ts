// usecases/timings.ts — Marcaje de inicio/fin de limpieza con máquina de estados (D2).
import type { RepositoryAdapter } from 'arckode-framework'
import { NotFoundError, AuthError, ValidationError } from 'arckode-framework'
import type { HousekeepingDTO, HousekeepingUser } from '../types'

// Transiciones válidas (D2). duration NO se persiste: se calcula endTime - startTime (D1).
const TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress'],
  in_progress: ['completed'],
  completed: ['inspected', 'pending'],
  inspected: ['pending'],
}

export function assertTransition(from: string | undefined, to: string): void {
  const allowed = TRANSITIONS[from ?? 'pending']
  if (!allowed || !allowed.includes(to)) {
    throw new ValidationError(`Transición de estado inválida: ${from ?? '∅'} → ${to}`)
  }
}

const ADMIN_ROLES = ['hotel_admin', 'receptionist', 'super_admin']

export class TimingsUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<HousekeepingDTO>,
    private readonly onUpdated: (item: HousekeepingDTO) => Promise<void>,
    private readonly invalidate: (hotelId?: string) => Promise<void>,
    private readonly employeeRepo?: RepositoryAdapter<any>,
  ) {}

  /**
   * Solo la persona asignada (o un admin) inicia y termina su tarea.
   *
   * `task.staffId` es un `users.id`: así lo escribe `create()`, así lo filtra
   * `list()` (`?staffId=<users.id>`, que es lo que manda la app) y así lo valida
   * `assertStaffExists`. Esto antes lo buscaba en `employee_profiles`, comparando
   * la clave primaria de OTRA tabla: no coincidía nunca. Como los admins salían
   * por el `return` de arriba, el bug solo lo veía la camarera, que quedaba sin
   * poder arrancar el cronómetro de su propia habitación.
   */
  private assertAssignedStaff(task: HousekeepingDTO, currentUser: HousekeepingUser): void {
    if (ADMIN_ROLES.includes(currentUser.role)) return
    if (task.staffId !== currentUser.id) {
      throw new AuthError('No autorizado: no es la tarea asignada a este empleado')
    }
  }

  async start(id: string, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    this.assertAssignedStaff(existing, currentUser)
    if (!existing.staffId) throw new ValidationError('Asigna un empleado antes de iniciar la tarea')
    assertTransition(existing.status, 'in_progress')
    const item = await this.repo.update(id, { status: 'in_progress', startTime: new Date().toISOString() } as any)
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    await this.onUpdated(item)
    await this.invalidate(existing.hotelId)
    return item
  }

  /** Pausa la limpieza: congela el cronómetro. Guarda desde cuándo está pausada. */
  async pause(id: string, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    this.assertAssignedStaff(existing, currentUser)
    if (existing.status !== 'in_progress') throw new ValidationError('Solo se pausa una limpieza en curso')
    if ((existing as any).pausedAt) return existing // ya pausada: idempotente
    const item = await this.repo.update(id, { pausedAt: new Date().toISOString() } as any)
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    await this.onUpdated(item)
    await this.invalidate(existing.hotelId)
    return item
  }

  /** Reanuda: acumula el tiempo pausado y vuelve a correr el cronómetro. */
  async resume(id: string, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    this.assertAssignedStaff(existing, currentUser)
    const pausedAt = (existing as any).pausedAt as string | undefined
    if (!pausedAt) return existing // no estaba pausada: idempotente
    const accumulated = ((existing as any).pausedSeconds ?? 0) + this.secondsSince(pausedAt)
    const item = await this.repo.update(id, { pausedAt: null, pausedSeconds: accumulated } as any)
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    await this.onUpdated(item)
    await this.invalidate(existing.hotelId)
    return item
  }

  private secondsSince(iso: string): number {
    const then = new Date(iso).getTime()
    const now = Date.now()
    return now > then ? Math.floor((now - then) / 1000) : 0
  }

  async complete(id: string, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    this.assertAssignedStaff(existing, currentUser)
    assertTransition(existing.status, 'completed')
    if (!existing.startTime) throw new ValidationError('La tarea no fue iniciada (falta startTime)')
    const nowIso = new Date().toISOString()
    // Si estaba pausada al finalizar, se cierra la pausa acumulándola primero,
    // para que la duración no cuente ese tiempo.
    const pausedAt = (existing as any).pausedAt as string | undefined
    const pausedSeconds = ((existing as any).pausedSeconds ?? 0) + (pausedAt ? this.secondsSince(pausedAt) : 0)
    const item = await this.repo.update(id, {
      status: 'completed', endTime: nowIso, completedDate: nowIso,
      pausedAt: null, pausedSeconds,
    } as any)
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    await this.onUpdated(item)
    await this.invalidate(existing.hotelId)
    return item
  }
}
