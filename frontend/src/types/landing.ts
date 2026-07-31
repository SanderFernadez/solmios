// types/landing.ts — Tipos del dominio LANDING PÚBLICA (F1, solmi-direct-booking / Pieza B).
//
// Espejo del backend `landing/types.ts` + `landing/usecases/blocks-crud.ts` (endpoint público
// GET /api/public/hotels/:slug/landing). El backend devuelve solo bloques `active=1` ordenados
// por `sortOrder`; el config JSON depende del `type` (catálogo FIJO de 9 valores, no admin).
//
// Convención misma que `ALLERGEN_TAGS`: el catálogo de tipos es en código, no en DB. Si el
// backend suma un type nuevo, agregarlo acá Y en el componente orquestador.

// ─── Catálogo FIJO de tipos de bloque (10 valores — trust-badges sumado en
// hero-search-rooms-content, espejo de backend `landing/types.ts`) ─────────
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

// ─── Config JSON por type (spec landing-builder/spec.md "Config JSON por bloque") ──────────
// Todos los campos son OPTIONAL desde el punto de vista del frontend: si el admin no los
// configuró todavía, el bloque cae a defaults razonables o se omite (decisiones en cada Block).

/** Config del buscador inline opcional en el hero. Default backend: `{enabled:false,
 *  ctaText:'Buscar disponibilidad'}` — hoteles ya seedeados NO tienen esta key en su config
 *  persistido hasta que el admin la prende, leer siempre con optional chaining. */
export interface HeroSearchBarConfig {
  enabled: boolean
  ctaText: string
}

export interface HeroBlockConfig {
  title?: string | null
  subtitle?: string | null
  ctaText?: string | null
  /** Id del media asignado como fondo (el frontend usa `media.hero[]` si no hay).
   *  Forma SINGLE (legacy): una sola imagen, sin carrusel. */
  backgroundMediaId?: string | null
  /** Lista ordenada de ids de media para el fondo. Si tiene items → carrusel (slider)
   *  en orden. Backward-compat: si está vacío cae a `backgroundMediaId` (single) o a
   *  `media.hero[]` (primera disponible). */
  backgroundMediaIds?: string[] | null
  searchBar?: HeroSearchBarConfig | null
}

/** Item de un sello de confianza (icon = key del ICONS map en TrustBadgesBlock.vue). */
export interface TrustBadgeItem {
  icon: string
  text: string
}

export interface TrustBadgesBlockConfig {
  title?: string | null
  items?: TrustBadgeItem[] | null
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
  /** Muestra adultos + m² debajo del nombre. Default true. */
  showSpecs?: boolean | null
  /** En la práctica es un `roomType` string (matchea `RoomTypeRate.id`) — el PMS no tiene
   *  entidad RoomType física, así que "habitación destacada" es un tipo, no un UUID físico.
   *  El nombre de la key quedó de la primera pasada (backend ya commiteado, no se renombra). */
  featuredRoomId?: string | null
  featuredBadgeText?: string | null
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
  | ({ type: 'trust-badges' } & TrustBadgesBlockConfig)
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

// ─── RoomsBlock: mapeo del orquestador desde GET /api/public/hotels/:slug/rates ───────────
// El orquestador (hotel-landing.vue) pide tarifas indicativas (mañana + 2 noches, 2 adultos)
// y mapea cada `RoomTypeRate` (types/booking.ts) a este shape. Fetch tolerante: si el hotel
// tiene el booking engine desactivado (400/404), `rooms=null` y RoomsBlock no renderiza.
// `id`/`name` son el mismo `roomType` string (no hay entidad RoomType propia en este PMS).
export interface PublicLandingRoom {
  id: string
  name: string
  fromPrice: number
  availableCount: number
  capacity: number
  surfaceArea: number
  /** Siempre null por ahora — sin fotos por tipo de habitación (decisión tomada,
   *  fuera de alcance de F1 hero-search-rooms-content). RoomsBlock ya maneja el placeholder. */
  photoUrl?: string | null
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

// ─── Themes (Task B — landing pública con templates) ──────────────────────
// Espejo del backend `landing/types.ts` (Task A, commit 5df115a). El endpoint público
// GET /api/public/hotels/:slug/landing ahora devuelve `{ data: LandingBlock[], theme: LandingTheme | null }`.
//
// `templateId` selecciona una paleta preset (ver PRESET_MAP). `colors` (optional) sobreescribe
// tokens individuales del preset — el frontend mergea preset + custom en `themeCssVars`.
// `fonts` (optional) permite heading/body families; hoy solo applies para boutique (Playfair).
//
// Convención camelCase en TS → kebab-case en CSS custom properties:
//   `navyLight` → `--color-navy-light`. Los nombres matchean los tokens `@theme` de main.css.
export type LandingTemplateId = 'classic' | 'modern' | 'boutique'

/** Tokens de color overrideables. Cada key mapea a `--color-<kebab>` en main.css @theme. */
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

/** Theme completo enviado por el backend (todos los campos opcionales salvo templateId). */
export interface LandingTheme {
  templateId: LandingTemplateId
  colors?: Partial<ThemeTokens>
  fonts?: {
    heading?: string
    body?: string
  }
}

/**
 * PRESET_MAP — paletas por defecto de cada template (look&feel de cada variante).
 * - classic: el look actual (azul navy + cyan). Sin overrides → usa exactamente estos tokens.
 * - modern: teal + coral (vibrante, "boutique urbano").
 * - boutique: bordó + gold (cálido, editorial).
 *
 * El orquestador mergea `PRESET_MAP[templateId]` con `theme.colors` (custom overrides del
 * hoteliero) → gana el override puntual. Si el backend manda `colors` pero no `templateId`,
 * cae a classic + overrides.
 */
export const PRESET_MAP: Record<LandingTemplateId, ThemeTokens> = {
  classic: {
    navy: '#0D2B4E',
    navyLight: '#1A3A5C',
    blue: '#1D67E3',
    cyan: '#00B4D8',
    cyanLight: '#48CAE4',
    teal: '#117A65',
    gold: '#B7950B',
    goldLight: '#D4AC0D',
    surface: '#F8FAFC',
    surfaceDark: '#F1F5F9',
  },
  modern: {
    navy: '#0F766E',
    navyLight: '#115E59',
    blue: '#0891B2',
    cyan: '#F97316',
    cyanLight: '#FB923C',
    teal: '#0D9488',
    gold: '#F59E0B',
    goldLight: '#FBBF24',
    surface: '#F0FDFA',
    surfaceDark: '#CCFBF1',
  },
  boutique: {
    navy: '#4A1D1D',
    navyLight: '#6B2828',
    blue: '#7C2D12',
    cyan: '#B7950B',
    cyanLight: '#D4AC0D',
    teal: '#92400E',
    gold: '#92400E',
    goldLight: '#B45309',
    surface: '#FAF6F0',
    surfaceDark: '#F2EBE0',
  },
}

/** Shape del response del endpoint público `GET /api/public/hotels/:slug/landing` (post-Task A). */
export interface PublicLandingResponse {
  data: LandingBlock[]
  theme: LandingTheme | null
}

