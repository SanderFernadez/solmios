// empleados/usecases/documents.ts — Document management + expiry alerts

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { NotFoundError, ConflictError } from 'arckode-framework'
import type { DocumentDTO, CreateDocumentDTO, DocumentExpiryAlert } from '../types'
import type { SimpleUser } from './ownership'
import { validateEmployeeBelongsToHotel } from './validate-employee'
import { auditSafely, type AuditPort } from '../../../shared/usecases/audit'

export class DocumentUseCase {
  private auditPort: AuditPort | null = null

  constructor(
    private readonly repo: RepositoryAdapter<DocumentDTO>,
    private readonly profileRepo: RepositoryAdapter<any>,
    private readonly userRepo?: RepositoryAdapter<any>,
    private readonly logger?: Logger,
    private readonly auth?: Auth,
  ) {}

  /** Conecta el audit log. Lo inyecta el connector `empleados-auditlog` vía el service. */
  setAuditPort(port: AuditPort): void {
    this.auditPort = port
  }

  async create(dto: CreateDocumentDTO): Promise<DocumentDTO> {
    await validateEmployeeBelongsToHotel(this.profileRepo, dto.employeeId, dto.hotelId)
    // #181: dos documentos del mismo empleado no pueden tener el mismo nombre (case-insensitive).
    const existing = await this.repo.findMany({ hotelId: dto.hotelId, employeeId: dto.employeeId })
    const wanted = String(dto.name ?? '').trim().toLowerCase()
    if (existing.some((d) => String(d.name ?? '').trim().toLowerCase() === wanted)) {
      throw new ConflictError('Ya existe un documento con ese nombre para este empleado')
    }
    return this.repo.create({ ...dto, alertSent: 0 } as any)
  }

  async getById(id: string, user?: SimpleUser): Promise<DocumentDTO> {
    const doc = await this.repo.findById(id)
    if (!doc) throw new NotFoundError('Documento no encontrado')
    if (this.auth && user) this.auth.assertOwnership(doc.hotelId, user.hotelId ?? '', user.role, 'super_admin')
    return doc
  }

  async list(hotelId: string, employeeId?: string): Promise<DocumentDTO[]> {
    const filters: Record<string, any> = {}
    if (hotelId) filters.hotelId = hotelId
    if (employeeId) filters.employeeId = employeeId
    return this.repo.findMany(filters)
  }

  async delete(id: string, user?: SimpleUser): Promise<void> {
    const doc = await this.getById(id, user)
    await this.repo.delete(id)
    // SC-05: borrar documentación de un legajo (contratos, IDs, permisos) deja rastro.
    // `logger` es opcional en este usecase → fallback no-op: auditar nunca puede tumbar el borrado.
    await auditSafely(this.auditPort, this.logger ?? ({ error: () => {} } as unknown as Logger), {
      hotelId: doc.hotelId, userId: user?.id, action: 'employee-document.delete',
      entity: 'employee-document', entityId: id,
      detail: `Documento "${doc.name}" (${doc.type || 'sin tipo'}) del empleado ${doc.employeeId} eliminado`,
    })
  }

  async getExpiring(hotelId: string, daysAhead = 30): Promise<DocumentExpiryAlert[]> {
    const docs = await this.repo.findMany({ hotelId })
    const now = new Date()
    const cutoff = new Date(now.getTime() + daysAhead * 86400000)

    // Batch-fetch employee names to avoid N+1
    const employeeIds = [...new Set(docs.map(d => d.employeeId).filter(Boolean))]
    const namesMap = new Map<string, string>()
    if (employeeIds.length && this.userRepo) {
      try {
        const profiles = await this.profileRepo.findMany({ hotelId, userId: employeeIds })
        const userIds = profiles.map((p: any) => p.userId).filter(Boolean)
        if (userIds.length) {
          const users = await this.userRepo.findMany({ id: userIds })
          for (const u of users) namesMap.set(u.id, u.name ?? u.email ?? '')
        }
      } catch { /* fallback to empty names */ }
    }

    const alerts: DocumentExpiryAlert[] = []
    for (const doc of docs) {
      if (!doc.expiryDate) continue
      const expiry = new Date(doc.expiryDate)
      if (expiry <= cutoff && expiry >= now) {
        const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
        alerts.push({
          employeeId: doc.employeeId,
          employeeName: namesMap.get(doc.employeeId) ?? '',
          documentId: doc.id,
          documentName: doc.name,
          type: doc.type,
          expiryDate: doc.expiryDate,
          daysUntilExpiry,
        })
      }
    }
    return alerts
  }
}
