// mantenimiento/usecases/audit.ts — Audit trail: registro de cambios
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { MaintenanceAuditDTO, MaintenanceAuditAction, MantenimientoDTO } from '../types'

export class AuditUseCase {
  constructor(
    private readonly auditRepo: RepositoryAdapter<MaintenanceAuditDTO>,
    private readonly orderRepo: RepositoryAdapter<MantenimientoDTO>,
    private readonly logger: Logger,
  ) {}

  async log(
    orderId: string, hotelId: string, userId: string,
    action: MaintenanceAuditAction, oldValue?: string | null, newValue?: string | null,
  ): Promise<void> {
    try {
      await this.auditRepo.create({
        id: crypto.randomUUID(),
        orderId, hotelId, userId, action,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null,
        timestamp: new Date().toISOString(),
      } as any)
    } catch (e) {
      this.logger.warn('Audit log failed', { orderId, action, error: String(e) })
    }
  }

  async getHistory(orderId: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<MaintenanceAuditDTO[]> {
    const order = await this.orderRepo.findById(orderId)
    if (!order) return []
    if (currentUser.role !== 'super_admin' && order.hotelId !== currentUser.hotelId) return []
    const all = await this.auditRepo.findMany({ orderId }) as MaintenanceAuditDTO[]
    return all.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
  }
}
