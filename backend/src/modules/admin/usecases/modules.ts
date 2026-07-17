// admin/usecases/modules.ts — Módulos del producto que el super_admin puede activar/desactivar.
// Son los grupos top-level del panel del hotel. Los core (Dashboard, Configuración, Soporte) NO se
// listan: siempre activos. Estado global en configuration(hotelId='platform', key='modules').
// Default: todo activado (un módulo sin entrada se considera ON).

import type { RepositoryAdapter } from 'arckode-framework'

export interface ModuleMeta { key: string; label: string; description: string }

export const MODULE_CATALOG: ModuleMeta[] = [
  { key: 'planning', label: 'Planning', description: 'Calendario de reservas' },
  { key: 'channel', label: 'Channel Manager', description: 'Sincronización con OTAs (Channex)' },
  { key: 'reservations', label: 'Reservas', description: 'Reservas y check-in / check-out' },
  { key: 'operations', label: 'Operaciones', description: 'Limpieza, mantenimiento, proveedores' },
  { key: 'guests', label: 'Huéspedes', description: 'Gestión de huéspedes' },
  { key: 'finance', label: 'Finanzas', description: 'Facturación, folios, caja, reportes' },
  { key: 'sales', label: 'Ventas', description: 'Grupos, promociones, reseñas' },
  { key: 'ai', label: 'IA', description: 'Recepcionista y gerente con IA' },
  { key: 'crm', label: 'CRM', description: 'Fidelización de huéspedes' },
  { key: 'hr', label: 'RRHH', description: 'Empleados, nómina, asistencia' },
]

export type ModuleState = Record<string, boolean>

const CONFIG_KEY = 'modules'
const PLATFORM = 'platform'

async function readRaw(configRepo: RepositoryAdapter<any>): Promise<{ row: any; value: Record<string, boolean> }> {
  const rows = await configRepo.findMany({ hotelId: PLATFORM, key: CONFIG_KEY })
  const row = (rows as any[])?.[0]
  const value = row ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) : {}
  return { row, value: value && typeof value === 'object' ? value : {} }
}

/** Estado completo: cada módulo del catálogo con su on/off (default ON si no está seteado). */
export async function getModuleState(configRepo: RepositoryAdapter<any>): Promise<ModuleState> {
  const { value } = await readRaw(configRepo)
  const state: ModuleState = {}
  for (const m of MODULE_CATALOG) state[m.key] = value[m.key] !== false
  return state
}

/** Aplica un patch parcial (solo claves del catálogo) y persiste. Devuelve el estado resultante. */
export async function setModuleState(configRepo: RepositoryAdapter<any>, patch: ModuleState): Promise<ModuleState> {
  const { row } = await readRaw(configRepo)
  const current = await getModuleState(configRepo)
  const next: ModuleState = { ...current }
  for (const m of MODULE_CATALOG) if (patch && m.key in patch) next[m.key] = !!patch[m.key]
  if (row) await configRepo.update(row.id, { value: next })
  else await configRepo.create({ id: crypto.randomUUID(), hotelId: PLATFORM, key: CONFIG_KEY, value: next })
  return next
}
