// cancellation/types.ts — DTOs y tipos del módulo (API contract, F1 plan #627).
// El schema físico de la tabla vive en ./model.ts — son conceptos distintos (mem
// anti-patrón ORM: TODO campo del DTO está declarado en model.ts case-sensitive).

/** Ámbito de aplicación de la política. Determina qué override es. */
export type PolicyScope = 'base' | 'channel' | 'rate' | 'season'

/**
 * Tier de penalidad. Un threshold temporal + el % a cobrar si se cancela dentro
 * de esa ventana. `deadlineHours` = horas-mínimas-antes-del-checkIn para que este
 * tier aplique. Ordenados DESC por deadlineHours en computePenalty.
 */
export interface Tier {
  /** Horas antes del checkIn. Cancelar con >= esta anticipación cae en este tier. */
  deadlineHours: number
  /** % del depósito a retener (0-100). */
  penaltyPercent: number
  /** Si el huésped puede reclamar reembolso (non_refundable = false siempre). */
  refundable: boolean
  /** Etiqueta opcional para mostrar en UI (ej: "Cancelación gratis"). */
  label?: string
}

/**
 * DTO de lectura. Espeja los campos persistidos en `cancellation_policies` (model.ts).
 * El ORM normaliza `active` 0/1 ↔ false/true y `tiers` JSON ↔ array automáticamente.
 */
export interface CancellationPolicyDTO {
  id: string
  hotelId: string
  scope: PolicyScope
  scopeId: string
  name: string
  tiers: Tier[]
  priority: number
  active: boolean
  createdAt: string
  updatedAt: string
}

/** Body del POST /api/cancellation-policies (F3). hotelId sale del token en el controller. */
export interface CreateCancellationPolicyDTO {
  hotelId: string
  scope: PolicyScope
  scopeId?: string
  name?: string
  tiers: Tier[]
  priority?: number
  active?: boolean
}

/** Body del PUT /api/cancellation-policies/:id (F3). Todos opcionales (partial). */
export interface UpdateCancellationPolicyDTO {
  scope?: PolicyScope
  scopeId?: string
  name?: string
  tiers?: Tier[]
  priority?: number
  active?: boolean
}

/** Filtros de listado (multi-tenant por hotelId). */
export interface CancellationQuery {
  hotelId?: string
  scope?: PolicyScope
  scopeId?: string
  active?: boolean
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
}

export interface CancellationPaginated {
  data: CancellationPolicyDTO[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
