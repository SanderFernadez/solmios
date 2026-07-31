// landing/types.ts — DTOs y tipos del módulo landing_blocks (API contract, F1).
// El schema físico de la tabla vive en ./model.ts — son conceptos distintos (mem
// anti-patrón ORM: TODO campo del DTO está declarado en model.ts case-sensitive).

/** Catálogo FIJO de tipos de bloque (spec lines 20-26). 10 valores, no administrable. */
export type LandingBlockType =
  | 'hero'
  | 'trust-badges'
  | 'gallery'
  | 'amenities'
  | 'location'
  | 'reviews'
  | 'rooms'
  | 'faq'
  | 'cta'
  | 'footer'

/** Lista canónica de los 10 types — fuente de verdad para seeder y validación. */
export const BLOCK_TYPES: LandingBlockType[] = [
  'hero', 'trust-badges', 'gallery', 'amenities', 'rooms', 'reviews', 'location', 'faq', 'cta', 'footer',
]

/**
 * sortOrder default por type (spec lines 30-33). Orden canónico de la landing pública
 * cuando el admin nunca reordenó. El seeder lo usa; el upsert NO lo impone si el input
 * trae `sortOrder` (respetar el orden elegido por el admin).
 */
export const DEFAULT_SORT_ORDER: Record<LandingBlockType, number> = {
  hero: 0,
  'trust-badges': 1,
  gallery: 2,
  amenities: 3,
  rooms: 4,
  reviews: 5,
  location: 6,
  faq: 7,
  cta: 8,
  footer: 9,
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

// ─── Theme (solmi-direct-booking) ───────────────────────────────────────────
/**
 * Catálogo FIJO de plantillas visuales de la landing pública. Cada templateId
 * determina la paleta base + diffs estructurales (hero/gallery) que el frontend
 * aplica por variantes. El backend NO conoce la paleta: solo persiste el choice.
 */
export type LandingTemplateId = 'classic' | 'modern' | 'boutique'

/** Lista canónica de templateIds — fuente de verdad para validación. */
export const LANDING_TEMPLATE_IDS: LandingTemplateId[] = ['classic', 'modern', 'boutique']

/**
 * Los 10 tokens de color overrideables por el merchant. Las keys matchean las
 * CSS vars de `@theme` en `frontend/src/styles/main.css` (`--color-navy` etc.).
 * El backend no valida contraste ni acceso (MVP: el editor advierte).
 */
export interface ThemeTokens {
  navy: string
  navyLight: string
  blue: string
  cyan: string
  cyanLight: string
  teal: string
  gold: string
  goldLight: string
  surface: string
  surfaceDark: string
}

/** Allow-list de las 10 keys de ThemeTokens — para sanitización. */
export const THEME_COLOR_KEYS: (keyof ThemeTokens)[] = [
  'navy', 'navyLight', 'blue', 'cyan', 'cyanLight',
  'teal', 'gold', 'goldLight', 'surface', 'surfaceDark',
]

/**
 * Theme completo del hotel. `colors`/`fonts` son overrides optativos que pisan
 * la paleta/preset del templateId. Se persiste en `configuration.value` (json)
 * bajo la key `'landing_theme'`.
 */
export interface LandingTheme {
  templateId: LandingTemplateId
  colors?: Partial<ThemeTokens>
  fonts?: { heading?: string; body?: string }
}

/**
 * Allow-list pública: mismo shape que LandingTheme (sin hotelId). El frontend
 * público lo recibe junto con los bloques en `listPublicBySlug`. Mantener
 * separado del tipo admin para marcar la intención de no exponer metadata
 * interna (futuro: audit timestamps, etc.).
 */
export interface PublicLandingTheme {
  templateId: LandingTemplateId
  colors?: Partial<ThemeTokens>
  fonts?: { heading?: string; body?: string }
}
