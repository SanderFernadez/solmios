// approve.ts — Usecase: Supervisor aprueba limpieza
import type { RepositoryAdapter } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { HousekeepingDTO } from '../types'
import { assertTransition } from './timings'

export class ApproveUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<HousekeepingDTO>,
  ) {}

  async approve(taskId: string, userId: string, note?: string): Promise<HousekeepingDTO> {
    const task = await this.repo.findById(taskId)
    if (!task) throw new NotFoundError('Tarea no encontrada')

    // Verificar que esté completada
    if (task.status !== 'completed') {
      throw new AuthError('Solo se pueden aprobar tareas completadas')
    }

    // Verificar que tenga presencia marcada
    if (!(task as any).supOnSiteTime) {
      throw new AuthError('Debes marcar presencia física antes de aprobar')
    }

    // Transición: completed → inspected
    assertTransition(task.status, 'inspected')

    const updated = await this.repo.update(taskId, {
      status: 'inspected',
      supervisorId: userId,
      supervisorNote: note || null,
      completedDate: new Date().toISOString(),
    } as any)

    if (!updated) throw new NotFoundError('Error al actualizar tarea')
    return updated
  }

  async markPresence(taskId: string, userId: string): Promise<void> {
    const task = await this.repo.findById(taskId)
    if (!task) throw new NotFoundError('Tarea no encontrada')

    // Solo supervisor puede marcar presencia
    if (task.status !== 'completed') {
      throw new AuthError('La tarea debe estar completada para marcar presencia')
    }

    await this.repo.update(taskId, {
      supOnSiteTime: new Date().toISOString(),
      supervisorId: userId,
    } as any)
  }

  async reportIssue(taskId: string, description: string, type: string): Promise<void> {
    const task = await this.repo.findById(taskId)
    if (!task) throw new NotFoundError('Tarea no encontrada')

    // Agregar reporte a las notas
    const existingNotes = (task as any).notes || ''
    const reportEntry = `[${type.toUpperCase()}] ${new Date().toISOString()}: ${description}`
    const updatedNotes = existingNotes ? `${existingNotes}\n${reportEntry}` : reportEntry

    await this.repo.update(taskId, {
      notes: updatedNotes,
    } as any)
  }
}
