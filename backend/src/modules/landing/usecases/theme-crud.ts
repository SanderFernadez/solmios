// landing/usecases/theme-crud.ts — CRUD del theme de la landing pública
// (solmi-direct-booking: templateId + colors custom + fonts).
//
// Reglas de negocio:
//  - Persistencia KV: una sola fila por hotel en `configuration` con
//    `key='landing_theme'` y `value` = JSON del theme. Reusa el modelo
//    `Configuration` de shared/models.ts (mem anti-patrón: NO definirlo acá).
//  - Default lazy: si no hay fila → `{templateId:'classic'}` (look actual).
//    Idempotente: el seeder NO crea la fila; el admin la crea al primer PUT.
//  - Ownership IDOR (solo setTheme): resolve user por `userRepo.findOne({id})`
//    y `auth.assertOwnership(hotelId, me.hotelId, ...)`. Mismo patrón textual
//    que blocks-crud.assertOwnershipOf.
//  - Allow-list estricto: solo las 10 keys de ThemeTokens + heading/body. Cualquier
//    otra key en colors/fonts se descarta (defensa contra mass-assignment). El
//    DTO público (`PublicLandingTheme`) no incluye hotelId (se construye con
//    `toPublicTheme`).
//  - Cache invalidation OBLIGATORIA en setTheme: si no se borra la caché
//    `landing:public:${hotelId}`, el público no refleja el cambio (Riesgo #2
//    del plan). Es bloqueante — lo captura el test "setTheme invalida cache".
//
// Anti-patrón ORM (mem 1805): el modelo `Configuration` (shared/models.ts:13-21)
// declara `value: { type: 'json' }`. Persistimos el theme como string JSON
// (patrón config-kv.ts) y al leer hacemos `safeParse` — funciona tanto si el
// ORM auto-serializa json como si no, sin doble encoding.
import type { RepositoryAdapter, Auth, CacheAdapter } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import type {
  LandingTheme, LandingTemplateId, PublicLandingTheme,
  ThemeTokens, CurrentUser,
} from '../types'
import { LANDING_TEMPLATE_IDS, THEME_COLOR_KEYS } from '../types'

/** Clave KV en `configuration` para el theme del hotel. */
export const LANDING_THEME_KEY = 'landing_theme'

/** Theme default (look actual: classic, sin overrides). */
export const DEFAULT_THEME: LandingTheme = { templateId: 'classic' }

export interface ThemeCrudDeps {
  /** Repo ORM `Configuration` (registrado por shared/models.ts — NO redefinir). */
  config: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  auth: Auth
  /** CacheAdapter para invalidar `landing:public:${hotelId}` en setTheme. */
  cache?: CacheAdapter
}

/** Clave pública de caché — misma que usa blocks-crud/service. */
export const PUBLIC_CACHE_KEY = (hotelId: string) => `landing:public:${hotelId}`

// ─── helpers ───────────────────────────────────────────────────────────────

/** Idempotente: JSON.parse solo si vino string; si ya es objeto, lo pasa. */
function safeParse(v: unknown): any {
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) } catch { return v }
}

/** Valida que `t` esté en el enum cerrado de LandingTemplateId. */
function assertTemplateId(t: unknown): LandingTemplateId {
  if (typeof t !== 'string' || !LANDING_TEMPLATE_IDS.includes(t as LandingTemplateId)) {
    throw new ValidationError(`templateId debe ser uno de: ${LANDING_TEMPLATE_IDS.join('|')}`)
  }
  return t as LandingTemplateId
}

/** Valida un valor de color: hex (#rgb | #rrggbb | #rrggbbaa) o `var(--token)`. */
function isValidColorString(v: unknown): boolean {
  if (typeof v !== 'string' || v.length === 0) return false
  if (v.startsWith('var(')) return true
  return /^#[0-9a-fA-F]{3,8}$/.test(v)
}

/** Allow-list de colors: solo las 10 keys conocidas, cada una string válido. */
function sanitizeColors(input: unknown): Partial<ThemeTokens> | undefined {
  if (input == null) return undefined
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('colors debe ser un objeto')
  }
  const out: Partial<ThemeTokens> = {}
  for (const k of THEME_COLOR_KEYS) {
    const v = (input as Record<string, unknown>)[k as string]
    if (v === undefined || v === null) continue
    if (!isValidColorString(v)) {
      throw new ValidationError(
        `colors.${k} debe ser hex (#rgb / #rrggbb) o var(--token)`,
      )
    }
    ;(out as Record<string, string>)[k as string] = v as string
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Allow-list de fonts: heading y body, strings no vacíos. */
function sanitizeFonts(input: unknown): { heading?: string; body?: string } | undefined {
  if (input == null) return undefined
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('fonts debe ser un objeto')
  }
  const out: { heading?: string; body?: string } = {}
  const h = (input as Record<string, unknown>).heading
  const b = (input as Record<string, unknown>).body
  if (typeof h === 'string' && h.trim().length > 0) out.heading = h.trim()
  if (typeof b === 'string' && b.trim().length > 0) out.body = b.trim()
  return Object.keys(out).length > 0 ? out : undefined
}

/** Normaliza un input arbitrario a un LandingTheme válido (o lanza). */
function normalizeTheme(input: Record<string, unknown>): LandingTheme {
  if (input.templateId === undefined || input.templateId === null) {
    throw new ValidationError('templateId es requerido')
  }
  const templateId = assertTemplateId(input.templateId)
  const theme: LandingTheme = { templateId }
  const colors = sanitizeColors(input.colors)
  if (colors) theme.colors = colors
  const fonts = sanitizeFonts(input.fonts)
  if (fonts) theme.fonts = fonts
  return theme
}

// ─── getTheme ──────────────────────────────────────────────────────────────
/**
 * Lee el theme del hotel desde la KV Configuration. Si no hay fila → default
 * classic (lazy, idempotente — el seeder NO crea la fila).
 */
export async function getTheme(
  deps: Pick<ThemeCrudDeps, 'config'>,
  hotelId: string,
): Promise<LandingTheme> {
  const rows = (await deps.config.findMany({ hotelId, key: LANDING_THEME_KEY })) as any[]
  const row = rows[0]
  if (!row) return { ...DEFAULT_THEME }
  const parsed = safeParse(row.value)
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_THEME }
  try {
    return normalizeTheme(parsed as Record<string, unknown>)
  } catch {
    // Fila corrupta o con templateId viejo/inválido → default safe.
    return { ...DEFAULT_THEME }
  }
}

// ─── setTheme ──────────────────────────────────────────────────────────────
/**
 * Persiste el theme del hotel. Ownership IDOR: el hotelId del JWT debe matchear
 * el hotelId pasado (resuelto vía userRepo). Invalida caché pública SIEMPRE.
 */
export async function setTheme(
  deps: ThemeCrudDeps,
  hotelId: string,
  input: Record<string, unknown>,
  user: CurrentUser,
): Promise<LandingTheme> {
  // Ownership (mismo patrón textual que blocks-crud.assertOwnershipOf).
  const me = await deps.userRepo.findOne({ id: user.id })
  deps.auth.assertOwnership(hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')

  const theme = normalizeTheme(input)

  // Persistencia KV (patrón config-kv.ts: stringify al escribir → safeParse al leer).
  const val = JSON.stringify(theme)
  const existingRows = (await deps.config.findMany({ hotelId, key: LANDING_THEME_KEY })) as any[]
  const existing = existingRows[0]
  if (existing) {
    await deps.config.update(existing.id, { value: val } as any)
  } else {
    await deps.config.create({
      id: crypto.randomUUID(),
      hotelId,
      key: LANDING_THEME_KEY,
      value: val,
    } as any)
  }

  // Cache invalidation OBLIGATORIA (Riesgo #2 del plan: sin esto, el público no
  // refleja el cambio). `.catch` para no romper el set si el adapter falla.
  if (deps.cache) {
    await deps.cache.delete(PUBLIC_CACHE_KEY(hotelId)).catch(() => {})
  }

  return theme
}

// ─── toPublicTheme ─────────────────────────────────────────────────────────
/** Allow-list pública: solo templateId/colors/fonts (sin hotelId ni metadata). */
export function toPublicTheme(theme: LandingTheme): PublicLandingTheme {
  const out: PublicLandingTheme = { templateId: theme.templateId }
  if (theme.colors) out.colors = theme.colors
  if (theme.fonts) out.fonts = theme.fonts
  return out
}
