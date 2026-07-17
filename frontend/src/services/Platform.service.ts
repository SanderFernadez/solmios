import { http } from './http'

interface List { data: any[]; total: number }

export const PlatformService = {
  subscriptions: () => http.get<any>('/admin/subscriptions'),
  // Auditoría extraída a AuditLogService (services/AuditLog.service.ts) — M45 #313
  monitoring: () => http.get<any>('/admin/monitoring'),
  announcements: () => http.get<List>('/admin/announcements'),
  apiKeys: (hotelId?: string) => http.get<List>(`/api-keys${hotelId ? `?hotelId=${hotelId}` : ''}`),
  anuncios: () => http.get<List>('/anuncios'),
  users: (hotelId?: string) => http.get<List>(`/users${hotelId ? `?hotelId=${hotelId}` : ''}`),
}

import { http as _http } from './http'
export const ConfigService = {
  get: async (key: string, hotelId?: string): Promise<any> => {
    const q = hotelId ? `?hotelId=${hotelId}` : ''
    const r = await _http.get<{ valor: any }>(`/configuracion/${key}${q}`)
    return r.valor
  },
  set: async (key: string, value: any, hotelId?: string): Promise<void> => {
    await _http.post('/configuracion', { clave: key, valor: value, hotelId: hotelId || 'platform' })
  },
}

// Módulos del producto (activar/desactivar). Admin edita; el panel del hotel lee para filtrar su menú.
// Un módulo puede tener submódulos (entradas hijas del menú) que se togglean por separado.
export interface SubModuleMeta { key: string; label: string; description: string }
export interface ModuleMeta { key: string; label: string; description: string; submodules?: SubModuleMeta[] }
export type ModuleState = Record<string, boolean>
export const ModulesService = {
  adminGet: () => _http.get<{ catalog: ModuleMeta[]; state: ModuleState }>('/admin/modules'),
  adminSave: (state: ModuleState) => _http.put<{ state: ModuleState }>('/admin/modules', { state }),
  enabled: () => _http.get<{ state: ModuleState }>('/modules'),
}

// Gestión de hoteles a nivel PLATAFORMA (super_admin). Asignar plan, estado y datos de cualquier hotel.
// El `plan` se valida contra la tabla de planes en el backend.
export const HotelAdminService = {
  update: (id: string, patch: { plan?: string; status?: string; name?: string; email?: string; phone?: string; location?: string }) =>
    _http.put<any>(`/admin/hoteles/${id}`, patch),
}

// Cuenta Channex a nivel PLATAFORMA (white-label). Solo super_admin. La API key nunca vuelve cruda.
export interface ChannexStatus { environment: string; hasKey: boolean; keyMasked: string }
export const ChannexAdminService = {
  status: () => _http.get<ChannexStatus>('/admin/channex-config'),
  save: (patch: { apiKey?: string; environment?: string }) => _http.put<ChannexStatus>('/admin/channex-config', patch),
  test: () => _http.post<{ success: boolean; message: string; environment: string }>('/admin/channex-config/test'),
}
