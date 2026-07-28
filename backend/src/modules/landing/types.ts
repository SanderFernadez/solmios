// landing/types.ts — DTOs y tipos del módulo landing_blocks (API contract, F1).
// El schema físico de la tabla vive en ./model.ts — son conceptos distintos (mem
// anti-patrón ORM: TODO campo del DTO está declarado en model.ts case-sensitive).

/** Catálogo FIJO de tipos de bloque (spec lines 20-26). 9 valores, no administrable. */
export type LandingBlockType =
  | 'hero'
  | 'gallery'
  | 'amenities'
  | 'location'
  | 'reviews'
  | 'rooms'
  | 'faq'
  | 'cta'
  | 'footer'

/** Lista canónica de los 9 types — fuente de verdad para seeder y validación. */
export const BLOCK_TYPES: LandingBlockType[] = [
  'hero', 'gallery', 'amenities', 'rooms', 'reviews', 'location', 'faq', 'cta', 'footer',
]

/**
 * sortOrder default por type (spec lines 30-33). Orden canónico de la landing pública
 * cuando el admin nunca reordenó. El seeder lo usa; el upsert NO lo impone si el input
 * trae `sortOrder` (respetar el orden elegido por el admin).
 */
export const DEFAULT_SORT_ORDER: Record<LandingBlockType, number> = {
  hero: 0,
  gallery: 1,
  amenities: 2,
  rooms: 3,
  reviews: 4,
  location: 5,
  faq: 6,
  cta: 7,
  footer: 8,
}

/**
 * DTO de lectura. Espeja los campos persistidos en `landing_blocks` (model.ts).
 * `config` es JSON libre (validado por type en el usecase), `active` viene como boolean
 * (el ORM normaliza 0/1 ↔ false/true automáticamente).
 */
export interface LandingBlockDTO {
  id: string
  hotelId: string
  type: LandingBlockType
  config: Record<string, unknown> | null
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Item del bulk upsert (`PUT /api/landing`). `id` opcional: si viene se conserva la
 * identidad de la fila (caso toggle/reorder desde el admin); si no viene, se crea.
 * `type` es la clave (1 fila por type por hotel); `config`/`sortOrder`/`active` se
 * reescriben atómicamente.
 */
export interface UpsertLandingBlockInput {
  id?: string
  type: LandingBlockType
  config?: Record<string, unknown> | null
  sortOrder?: number
  active?: boolean
}

/** Body de `PATCH /api/landing/:id/toggle` — toggle rápido sin re-PUT todo. */
export interface ToggleLandingBlockDTO {
  active: boolean
}

export interface LandingBlockListResult {
  data: LandingBlockDTO[]
  total: number
}

/**
 * Bloque devuelto por la ruta pública `GET /api/public/hotels/:slug/landing`.
 * Sin `id`, sin `hotelId`, sin `active` (siempre 1) — expone solo lo que la landing
 * pública necesita para renderizar (spec lines 144-147).
 */
export interface PublicLandingBlock {
  id: string
  type: LandingBlockType
  config: Record<string, unknown> | null
  sortOrder: number
}

/** Usuario autenticado (req.user). Para ownership (IDOR) y forzar hotelId. */
export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
  userType?: string
}
