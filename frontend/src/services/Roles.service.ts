// services/Roles.service.ts — CRUD de roles + catálogo de permisos (module:action)
import { http } from './http'

export interface Role {
  id: string
  name: string
  icon?: string
  color?: string
  system?: number
  hotelId?: string
  /** Permisos planos `modulo:accion` (ej: "reservations:view"). */
  permissions: string[]
  users?: number
}

export interface PermissionCatalog {
  /** Cada módulo trae SUS acciones (checkin/checkout solo en reservas, export solo en reportes).
   *  El catálogo ya no expone un `actions` global: la matriz arma las columnas del superconjunto. */
  modules: { key: string; label: string; actions: { key: string; label: string }[] }[]
}

/** El backend puede devolver permissions como array (ORM json) o string (columna cruda): normalizamos. */
function normalizePermissions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((p): p is string => typeof p === 'string')
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [] }
    catch { return [] }
  }
  return []
}

function toRole(r: Record<string, unknown>): Role {
  return {
    id: String(r.id),
    name: String(r.name),
    icon: (r.icon as string) ?? '👤',
    color: (r.color as string) ?? '',
    system: Number(r.system ?? 0),
    hotelId: r.hotelId as string | undefined,
    permissions: normalizePermissions(r.permissions),
    users: Number(r.users ?? 0),
  }
}

export const RolesService = {
  async list(): Promise<Role[]> {
    const res = await http.get<{ data: Record<string, unknown>[] }>('/api/roles')
    return (res.data ?? []).map(toRole)
  },
  catalog: (): Promise<PermissionCatalog> => http.get('/api/roles/catalog'),
  async create(data: { name: string; icon?: string; color?: string; permissions: string[] }): Promise<Role> {
    return toRole(await http.post('/api/roles', data) as Record<string, unknown>)
  },
  async update(id: string, data: Partial<{ name: string; icon: string; color: string; permissions: string[] }>): Promise<Role> {
    return toRole(await http.put(`/api/roles/${id}`, data) as Record<string, unknown>)
  },
  /** Restaura un rol del sistema a su configuración original (POST /api/roles/:id/restore). */
  restore: async (id: string): Promise<Role> => toRole(await http.post(`/api/roles/${id}/restore`) as Record<string, unknown>),
  remove: (id: string): Promise<void> => http.delete(`/api/roles/${id}`),
}
