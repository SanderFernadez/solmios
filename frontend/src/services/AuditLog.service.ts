import { http } from './http'
import type { AuditLogRecord, AuditLogQuery, AuditLogListResponse } from '@/types'

/**
 * Espeja backend/src/modules/auditlog/index.ts (GET /api/auditlog, GET /api/auditlog/:id).
 * Módulo append-only: sin update ni delete expuestos.
 *
 * Service dedicado de auditoría. Reemplazó a PlatformService.audit() (ya eliminado, M45 #313);
 * consumidores actuales: super-admin/audit.vue y super-admin/index.vue.
 */
export const AuditLogService = {
  list: (params?: AuditLogQuery) => {
    const qs = new URLSearchParams()
    if (params?.hotelId) qs.set('hotelId', params.hotelId)
    if (params?.status) qs.set('status', params.status)
    if (params?.type) qs.set('type', params.type)
    if (params?.category) qs.set('category', params.category)
    if (params?.search) qs.set('search', params.search)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    const query = qs.toString()
    return http.get<AuditLogListResponse>(`/auditlog${query ? `?${query}` : ''}`)
  },

  getById: (id: string) => http.get<AuditLogRecord>(`/auditlog/${id}`),
}
