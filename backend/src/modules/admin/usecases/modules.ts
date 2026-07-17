// admin/usecases/modules.ts — Módulos del producto que el super_admin puede activar/desactivar.
// Son los grupos top-level del panel del hotel. Los core (Dashboard, Configuración, Soporte) NO se
// listan: siempre activos. Un módulo puede tener SUBMÓDULOS (las entradas hijas del menú) que también
// se activan/desactivan de forma granular. Estado global en configuration(hotelId='platform', key='modules').
// Default: todo activado (una clave sin entrada se considera ON). Submódulos: clave punteada `modulo.sub`.
// INDEPENDIENTE del sistema de planes: los planes solo eligen módulos top-level; los submódulos son
// un toggle global de plataforma. Un submódulo se ve si su módulo padre entra en el plan Y está ON global.

import type { RepositoryAdapter } from 'arckode-framework'

export interface SubModuleMeta { key: string; label: string; description: string }
export interface ModuleMeta { key: string; label: string; description: string; submodules?: SubModuleMeta[] }

export const MODULE_CATALOG: ModuleMeta[] = [
  { key: 'planning', label: 'Planning', description: 'Calendario de reservas, tarifas y temporadas' },
  { key: 'channel', label: 'Channel Manager', description: 'Sincronización con OTAs (Channex)' },
  {
    key: 'reservations', label: 'Reservas', description: 'Reservas y check-in / check-out',
    submodules: [
      { key: 'reservations.list', label: 'Reservas', description: 'Listado y alta de reservas' },
      { key: 'reservations.checkin', label: 'Check-in / Check-out', description: 'Proceso de entrada y salida' },
    ],
  },
  {
    key: 'operations', label: 'Operaciones', description: 'Limpieza, mantenimiento y proveedores',
    submodules: [
      { key: 'operations.housekeeping', label: 'Limpieza', description: 'Tareas de housekeeping' },
      { key: 'operations.maintenance', label: 'Mantenimiento', description: 'Tickets de mantenimiento' },
      { key: 'operations.providers', label: 'Proveedores de servicios', description: 'Catálogo de proveedores externos' },
      { key: 'operations.team-chat', label: 'Chats del equipo', description: 'Monitor de conversaciones del equipo' },
    ],
  },
  { key: 'guests', label: 'Huéspedes', description: 'Gestión de huéspedes' },
  {
    key: 'finance', label: 'Finanzas', description: 'Facturación, folios, caja y reportes',
    submodules: [
      { key: 'finance.billing', label: 'Facturación', description: 'Facturas y notas de crédito' },
      { key: 'finance.folios', label: 'Folios In-House', description: 'Cargos y folios de huéspedes' },
      { key: 'finance.payments', label: 'Links de Pago', description: 'Cobros por link' },
      { key: 'finance.caja', label: 'Caja', description: 'Turnos y arqueo de caja' },
      { key: 'finance.gastos', label: 'Gastos', description: 'Registro de gastos' },
      { key: 'finance.reports', label: 'Reportes', description: 'Reportes financieros' },
      { key: 'finance.night-audit', label: 'Night Audit', description: 'Cierre nocturno' },
    ],
  },
  {
    key: 'sales', label: 'Ventas', description: 'Grupos, promociones y reseñas',
    submodules: [
      { key: 'sales.groups', label: 'Grupos', description: 'Reservas de grupo' },
      { key: 'sales.packages', label: 'Promociones', description: 'Paquetes y ofertas' },
      { key: 'sales.reviews', label: 'Reseñas', description: 'Opiniones de huéspedes' },
    ],
  },
  {
    key: 'ai', label: 'IA', description: 'Recepcionista y gerente con IA',
    submodules: [
      { key: 'ai.receptionist', label: 'Recepcionista IA', description: 'Asistente de recepción con IA' },
      { key: 'ai.manager', label: 'Gerente IA', description: 'Analítica y gestión con IA' },
    ],
  },
  { key: 'crm', label: 'CRM', description: 'Fidelización de huéspedes' },
  {
    key: 'hr', label: 'RRHH', description: 'Empleados, nómina y asistencia',
    submodules: [
      { key: 'hr.dashboard', label: 'Panel RRHH', description: 'Resumen de recursos humanos' },
      { key: 'hr.employees', label: 'Empleados', description: 'Gestión de empleados' },
      { key: 'hr.attendance', label: 'Asistencia', description: 'Control de asistencia' },
      { key: 'hr.payroll', label: 'Nómina', description: 'Liquidación de sueldos' },
    ],
  },
]

export type ModuleState = Record<string, boolean>

const CONFIG_KEY = 'modules'
const PLATFORM = 'platform'

/** Todas las claves configurables: módulos top-level + submódulos. */
function allKeys(): string[] {
  const keys: string[] = []
  for (const m of MODULE_CATALOG) {
    keys.push(m.key)
    for (const s of m.submodules ?? []) keys.push(s.key)
  }
  return keys
}

async function readRaw(configRepo: RepositoryAdapter<any>): Promise<{ row: any; value: Record<string, boolean> }> {
  const rows = await configRepo.findMany({ hotelId: PLATFORM, key: CONFIG_KEY })
  const row = (rows as any[])?.[0]
  const value = row ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) : {}
  return { row, value: value && typeof value === 'object' ? value : {} }
}

/** Estado completo: cada módulo/submódulo del catálogo con su on/off (default ON si no está seteado). */
export async function getModuleState(configRepo: RepositoryAdapter<any>): Promise<ModuleState> {
  const { value } = await readRaw(configRepo)
  const state: ModuleState = {}
  for (const k of allKeys()) state[k] = value[k] !== false
  return state
}

/**
 * Estado EFECTIVO para un hotel: global-ON ∩ (módulos y submódulos del plan). El plan.modules es una lista
 * plana de claves top-level Y submódulos punteados (`finance.night-audit`). super_admin / sin plan → solo global.
 * Retrocompat:
 *  - Plan sin módulos definidos (array vacío) → incluye TODO (los planes viejos no pierden nada).
 *  - Plan que lista un módulo top-level pero NINGÚN submódulo suyo → todos sus submódulos incluidos
 *    (los planes viejos guardaban solo claves top-level: no deben quedar sin submódulos).
 *  - Plan que lista al menos un `modulo.sub` → dentro de ese módulo, solo los submódulos listados.
 * El toggle global siempre manda: si un módulo/submódulo está apagado global, se cae para todos.
 */
export async function getModuleStateForPlan(
  configRepo: RepositoryAdapter<any>, plansRepo: RepositoryAdapter<any>, planSlug?: string,
): Promise<ModuleState> {
  const global = await getModuleState(configRepo)
  let planModules: string[] | null = null
  if (planSlug) {
    const plan = ((await plansRepo.findMany({ slug: planSlug })) as any[])?.[0]
    const raw = plan?.modules ? (typeof plan.modules === 'string' ? JSON.parse(plan.modules) : plan.modules) : []
    if (Array.isArray(raw) && raw.length) planModules = raw.map(String)
  }
  const has = (k: string) => !planModules || planModules.includes(k)
  const state: ModuleState = {}
  for (const m of MODULE_CATALOG) {
    const moduleOn = global[m.key] !== false && has(m.key)
    state[m.key] = moduleOn
    const subs = m.submodules ?? []
    // ¿El plan seleccionó submódulos concretos de este módulo? Si no, todos heredan al padre (retrocompat).
    const subSelected = !!planModules && subs.some((s) => planModules!.includes(s.key))
    for (const s of subs) {
      const inPlan = !subSelected || planModules!.includes(s.key)
      state[s.key] = moduleOn && global[s.key] !== false && inPlan
    }
  }
  return state
}

/** Aplica un patch parcial (solo claves del catálogo) y persiste. Devuelve el estado resultante. */
export async function setModuleState(configRepo: RepositoryAdapter<any>, patch: ModuleState): Promise<ModuleState> {
  const { row } = await readRaw(configRepo)
  const current = await getModuleState(configRepo)
  const next: ModuleState = { ...current }
  const valid = new Set(allKeys())
  for (const k of Object.keys(patch || {})) if (valid.has(k)) next[k] = !!patch[k]
  if (row) await configRepo.update(row.id, { value: next })
  else await configRepo.create({ id: crypto.randomUUID(), hotelId: PLATFORM, key: CONFIG_KEY, value: next })
  return next
}
