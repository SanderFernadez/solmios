// bookingengine/usecases/sitemap.ts — Sitemap dinámico (F1 1.11, solmi-direct-booking / Pieza D).
//
// Genera el `sitemap.xml` con una `<url>` por cada hotel con `onlineBookingStatus='active'`.
// Vive en bookingengine porque es el módulo dueño de las rutas públicas (`/api/public/hotel/:slug`,
// `/sitemap.xml`) y ya tiene inyectado el `hotelsRepo`. No crea módulo nuevo: 50 líneas alcanzan
// y evitan registrations extra en composition-root.
//
// Diseño:
//   - `listActiveHotelSlugs(deps)`: lee el repo. Devuelve pares `{ slug, updatedAt }`. Puro datos.
//   - `buildSitemapXml(baseUrl, urls, now?)`: arma el XML. Puro, testeable sin DB.
//   - `resolveBaseUrl(req)`: decide el origin. Env `PUBLIC_BASE_URL` > `x-forwarded-proto`+host >
//     `host`. NUNCA hardcodea `hotel.zx89.site` (anti-hardcode + multi-tenant).
//
// No SQL crudo: usa `OrmRepository.findMany({ onlineBookingStatus: 'active' })` (regla backend).

import type { RepositoryAdapter } from 'arckode-framework'

export interface SitemapDeps {
  hotels: RepositoryAdapter<any>
}

export interface SitemapUrl {
  slug: string
  updatedAt?: string | null
}

/**
 * Lista los slugs de hoteles con `onlineBookingStatus='active'`. Ignora hoteles sin slug
 * (algunos seeds antiguos pueden tenerlo vacío hasta que se corra `seed-hotel-slugs.ts`).
 */
export async function listActiveHotelSlugs(deps: SitemapDeps): Promise<SitemapUrl[]> {
  const hotels = (await deps.hotels.findMany({ onlineBookingStatus: 'active' })) as Array<Record<string, unknown>>
  return hotels
    .filter((h) => typeof h.slug === 'string' && (h.slug as string).trim() !== '')
    .map((h) => ({
      slug: String(h.slug),
      updatedAt: typeof h.updatedAt === 'string' ? (h.updatedAt as string) : null,
    }))
}

/**
 * Construye el XML del sitemap. Puro: no toca req/resp/DB — recibe `baseUrl` ya resuelto.
 * `now` inyectable para tests deterministas.
 */
export function buildSitemapXml(baseUrl: string, urls: SitemapUrl[], now: Date = new Date()): string {
  const base = baseUrl.replace(/\/+$/, '') // sin trailing slash
  const entries = urls.map((u) => {
    const loc = `${base}/h/${escapeXml(u.slug)}`
    const lastmod = u.updatedAt ? `\n    <lastmod>${escapeXml(u.updatedAt)}</lastmod>` : ''
    return `  <url>\n    <loc>${loc}</loc>${lastmod}\n  </url>`
  })
  // Sin <lastmod> global: el sitemap queda válido aunque ningún hotel tenga updatedAt.
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join('\n') +
    `\n</urlset>\n`
  )
}

/**
 * Resuelve el base URL del sitemap. Orden:
 *   1. `process.env.PUBLIC_BASE_URL` (deploy con dominio conocido, ej. producción).
 *   2. `x-forwarded-proto` + `host` (detrás de nginx/CDN, el caso del prod).
 *   3. `host` a secas con default `https`.
 * Nunca hardcodea un dominio: el sitemap sirve para cualquier despliegue del SaaS.
 */
export function resolveBaseUrl(req: { headers?: Record<string, string | string[] | undefined> }): string {
  const env = process.env.PUBLIC_BASE_URL
  if (env && env.trim() !== '') return env.trim()

  const headers = req.headers ?? {}
  const host = Array.isArray(headers.host) ? headers.host[0] : headers.host
  const protoHeader = Array.isArray(headers['x-forwarded-proto']) ? headers['x-forwarded-proto'][0] : headers['x-forwarded-proto']
  const proto = (protoHeader && protoHeader.includes('https')) ? 'https' : 'https' // default https en prod
  if (host && host.trim() !== '') return `${proto}://${host.trim()}`

  // Sin host ni env: fallback neutro. El sitemap queda con URLs relativas-absolutas que el
  // crawler resuelve contra el origin del request; en la práctica esta rama no se alcanza
  // porque todo request HTTP trae `host`.
  return 'https://localhost'
}

/** Escapa los 5 caracteres reservados de XML. Defensive contra slugs/nombres maliciosos. */
function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
      default: return c
    }
  })
}
