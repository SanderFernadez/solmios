// types/landing.ts — Tipos del dominio LANDING PÚBLICA (F1, solmi-direct-booking / Pieza B).
//
// Espejo del backend `landing/types.ts` + `landing/usecases/blocks-crud.ts` (endpoint público
// GET /api/public/hotels/:slug/landing). El backend devuelve solo bloques `active=1` ordenados
// por `sortOrder`; el config JSON depende del `type` (catálogo FIJO de 9 valores, no admin).
//
// Convención misma que `ALLERGEN_TAGS`: el catálogo de tipos es en código, no en DB. Si el
// backend suma un type nuevo, agregarlo acá Y en el componente orquestador.

// ─── Catálogo FIJO de tipos de bloque (9 valores) ──────────────────────────
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

// ─── Config JSON por type (spec landing-builder/spec.md "Config JSON por bloque") ──────────
// Todos los campos son OPTIONAL desde el punto de vista del frontend: si el admin no los
// configuró todavía, el bloque cae a defaults razonables o se omite (decisiones en cada Block).

export interface HeroBlockConfig {
  title?: string | null
  subtitle?: string | null
  ctaText?: string | null
  /** Id del media asignado como fondo (el frontend usa `media.hero[]` si no hay). */
  backgroundMediaId?: string | null
}

export interface GalleryBlockConfig {
  title?: string | null
}

export interface AmenitiesBlockConfig {
  title?: string | null
}

export interface LocationBlockConfig {
  title?: string | null
  description?: string | null
}

export interface ReviewsBlockConfig {
  title?: string | null
  /** Limita cuántas reviews se muestran (default 6, fallback del componente). */
  maxItems?: number | null
}

export interface RoomsBlockConfig {
  title?: string | null
  ctaText?: string | null
}

export interface FaqItem {
  question: string
  answer: string
}

export interface FaqBlockConfig {
  title?: string | null
  items?: FaqItem[] | null
}

export interface CtaBlockConfig {
  title?: string | null
  subtitle?: string | null
  buttonText?: string | null
}

export interface FooterLink {
  label: string
  url: string
}

export interface FooterBlockConfig {
  copyright?: string | null
  links?: FooterLink[] | null
}

/** Unión discriminada por `type` — útil para `switch (block.type)` con narrow. */
export type LandingBlockConfig =
  | ({ type: 'hero' } & HeroBlockConfig)
  | ({ type: 'gallery' } & GalleryBlockConfig)
  | ({ type: 'amenities' } & AmenitiesBlockConfig)
  | ({ type: 'location' } & LocationBlockConfig)
  | ({ type: 'reviews' } & ReviewsBlockConfig)
  | ({ type: 'rooms' } & RoomsBlockConfig)
  | ({ type: 'faq' } & FaqBlockConfig)
  | ({ type: 'cta' } & CtaBlockConfig)
  | ({ type: 'footer' } & FooterBlockConfig)

// ─── LandingBlock (respuesta del endpoint público) ─────────────────────────
// El endpoint público NO devuelve `id`, `hotelId`, `active`, ni timestamps — solo lo mínimo
// para renderizar. `config` es `unknown` acá porque el runtime shape depende del `type`; cada
// BlockComponent lo castea a su config específica después de mirar `type`.
export interface LandingBlock {
  type: LandingBlockType
  config: Record<string, unknown> | null
  sortOrder: number
}

// ─── RoomsBlock: contrato esperado del endpoint F2 (no construido todavía) ────────────────
// El orquestador hace el fetch tolerante: si F2 devuelve 404, pasa `rooms=null` y el bloque
// NO renderiza. Cuando F2 exista, su response debería mapear a este shape (o ampliarlo).
// Mientras tanto, el tipo vive acá para que el componente compile sin spec definitivo.
export interface PublicLandingRoom {
  roomId: string
  roomName: string
  description?: string | null
  photoUrl?: string | null
  fromPrice?: number | null
}

// ─── Admin Landing (F1 1.9 — builder admin) ───────────────────────────────────────────────
// Espejo del backend `landing/types.ts` (Pieza A, commit d16a9e1). El endpoint admin devuelve
// los 9 bloques del hotel del JWT (seeder lazy la primera vez), con `id` + `hotelId` + `active`
// + timestamps — a diferencia del endpoint público que solo expone `{id, type, config, sortOrder}`.
//
// El upsert del backend (`PUT /api/landing`) regenera IDs (delete-all + create-many): después
// de un save hay que re-fetchear para que un `toggle` posterior no use un id ya inexistente.
// El builder por eso usa bulk-save (PUT) para TODO cambio y refresca el state local tras el 200.
export interface AdminLandingBlock {
  id: string
  hotelId: string
  type: LandingBlockType
  config: Record<string, unknown> | null
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

/** Item del body de `PUT /api/landing` (bulk upsert atómico). `id` opcional — el backend
 *  lo acepta pero lo ignora (genera nuevos UUIDs en cada upsert). */
export interface UpsertLandingBlockInput {
  id?: string
  type: LandingBlockType
  config?: Record<string, unknown> | null
  sortOrder?: number
  active?: boolean
}

/** Result de `GET /api/landing` y `PUT /api/landing` — envelope `{data, total}`. */
export interface AdminLandingListResult {
  data: AdminLandingBlock[]
  total: number
}

