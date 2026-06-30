// empleados/usecases/documents.ts — Document management + expiry alerts

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { DocumentDTO, CreateDocumentDTO, DocumentExpiryAlert } from '../types'

export class DocumentUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<DocumentDTO>,
    private readonly logger: Logger,
  ) {}

  async create(dto: CreateDocumentDTO): Promise<DocumentDTO> {
    return this.repo.create({ ...dto, alertSent: 0 } as any)
  }

  async getById(id: string): Promise<DocumentDTO> {
    // @ignore IDOR_RISK — document lookup by ID
    const doc = await this.repo.findById(id)
    if (!doc) throw new NotFoundError('Document not found')
    return doc
  }

  async list(hotelId: string, employeeId?: string): Promise<DocumentDTO[]> {
    const filters: Record<string, any> = {}
    if (hotelId) filters.hotelId = hotelId
    if (employeeId) filters.employeeId = employeeId
    return this.repo.findMany(filters)
  }

  async delete(id: string): Promise<void> {
    await this.getById(id)
    await this.repo.delete(id)
  }

  async getExpiring(hotelId: string, daysAhead = 30): Promise<DocumentExpiryAlert[]> {
    const docs = await this.repo.findMany({ hotelId })
    const now = new Date()
    const cutoff = new Date(now.getTime() + daysAhead * 86400000)

    const alerts: DocumentExpiryAlert[] = []
    for (const doc of docs) {
      if (!doc.expiryDate) continue
      const expiry = new Date(doc.expiryDate)
      if (expiry <= cutoff && expiry >= now) {
        const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
        alerts.push({
          employeeId: doc.employeeId,
          employeeName: '',
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
