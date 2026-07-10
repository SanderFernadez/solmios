// empleados/usecases/documents.ts — Document management + expiry alerts

import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { DocumentDTO, CreateDocumentDTO, DocumentExpiryAlert } from '../types'
import type { SimpleUser } from './ownership'
import { validateEmployeeBelongsToHotel } from './validate-employee'

export class DocumentUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<DocumentDTO>,
    private readonly profileRepo: RepositoryAdapter<any>,
    private readonly userRepo?: RepositoryAdapter<any>,
    private readonly logger?: Logger,
    private readonly auth?: Auth,
  ) {}

  async create(dto: CreateDocumentDTO): Promise<DocumentDTO> {
    await validateEmployeeBelongsToHotel(this.profileRepo, dto.employeeId, dto.hotelId)
    return this.repo.create({ ...dto, alertSent: 0 } as any)
  }

  async getById(id: string, user?: SimpleUser): Promise<DocumentDTO> {
    const doc = await this.repo.findById(id)
    if (!doc) throw new NotFoundError('Document not found')
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
    await this.getById(id, user)
    await this.repo.delete(id)
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
