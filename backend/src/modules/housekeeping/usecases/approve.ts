// approve.ts — Usecase: Supervisor aprueba limpieza
import type { RepositoryAdapter } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type { HousekeepingDTO } from '../types'
import type { IssueReport } from '../sockets'
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

  /**
   * La camarera reporta algo. `type: 'maintenance'` abre además un ticket real.
   *
   * Antes esto solo apendaba una línea a `notes` de la tarea de limpieza: el
   * reporte moría ahí y mantenimiento nunca veía ni la descripción ni las fotos
   * de lo que había que arreglar.
   */
  async reportIssue(
    taskId: string,
    description: string,
    type: string,
    reporter: { id: string; hotelId?: string; role: string },
    onIssueReported?: (issue: IssueReport) => Promise<void>,
  ): Promise<void> {
    // Este usecase no recibe `auth`, así que el ownership se comprueba explícito
    // contra `reporter.hotelId` apenas se carga la tarea.
    // @ignore IDOR_RISK — ownership verificado abajo contra reporter.hotelId
    const task = await this.repo.findById(taskId)
    if (!task) throw new NotFoundError('Tarea no encontrada')

    // Sin esto se podía reportar sobre la tarea de otro hotel, y el ticket
    // resultante nacía en ese hotel ajeno.
    const taskHotelId = (task as any).hotelId
    if (reporter.role !== 'super_admin' && taskHotelId !== reporter.hotelId) {
      throw new AuthError('La tarea no pertenece a tu hotel')
    }

    // Agregar reporte a las notas
    const existingNotes = (task as any).notes || ''
    const reportEntry = `[${type.toUpperCase()}] ${new Date().toISOString()}: ${description}`
    const updatedNotes = existingNotes ? `${existingNotes}\n${reportEntry}` : reportEntry

    await this.repo.update(taskId, {
      notes: updatedNotes,
    } as any)

    if (type !== 'maintenance' || !onIssueReported) return

    // La nota queda igual: si abrir el ticket falla, el reporte no se pierde.
    await onIssueReported({
      hotelId: taskHotelId,
      roomId: (task as any).roomId,
      description,
      photos: Array.isArray((task as any).photos) ? (task as any).photos : [],
      reportedBy: reporter.id,
    })
  }
}
