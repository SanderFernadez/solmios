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

  async complete(id: string, currentUser: HousekeepingUser): Promise<HousekeepingDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Tarea de housekeeping no encontrada')
    if (currentUser.role !== 'super_admin' && existing.hotelId !== currentUser.hotelId) throw new AuthError('No autorizado')
    this.assertAssignedStaff(existing, currentUser)
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
