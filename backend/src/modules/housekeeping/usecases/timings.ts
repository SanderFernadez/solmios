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
   * A7 — Ownership por staff asignado. Preparatorio para la app móvil: cuando exista el
   * rol 'staff', solo el empleado asignado (o un admin) podrá iniciar/finalizar la tarea.
   * Hoy no hay rol staff → el check es inerte para los usuarios actuales (los admins pasan).
   * Resuelve el desajuste de IDs: req.user.id es userId, task.staffId es EmployeeProfile.id.
   */
  private async assertAssignedStaff(task: HousekeepingDTO, currentUser: HousekeepingUser): Promise<void> {
    if (ADMIN_ROLES.includes(currentUser.role)) return
    if (!this.employeeRepo) throw new AuthError('No autorizado')
    const profile = await this.employeeRepo.findOne({ userId: currentUser.id } as any).catch(() => null)
    if (!profile || profile.id !== task.staffId) {
      throw new AuthError('No autorizado: no es la tarea asignada a este empleado')
    }
  }

  async start(id: string, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    await this.assertAssignedStaff(existing, currentUser)
    assertTransition(existing.status, 'in_progress')
    const item = await this.repo.update(id, { status: 'in_progress', startTime: new Date().toISOString() } as any)
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    await this.onUpdated(item)
    await this.invalidate(existing.hotelId)
    return item
  }

  async complete(id: string, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    await this.assertAssignedStaff(existing, currentUser)
    assertTransition(existing.status, 'completed')
    if (!existing.startTime) throw new ValidationError('La tarea no fue iniciada (falta startTime)')
    const nowIso = new Date().toISOString()
    const item = await this.repo.update(id, { status: 'completed', endTime: nowIso, completedDate: nowIso } as any)
    if (!item) throw new NotFoundError('Tarea de housekeeping no encontrada')
    await this.onUpdated(item)
    await this.invalidate(existing.hotelId)
    return item
  }
}
