// bookingengine/usecases/public-hotel-info.ts — Info pública del hotel por slug (F0 0.4
// spec public-hotel-info). Allow-list ESTRICTA: nunca spread del objeto hotel — solo se
// copian explícitamente los campos públicos. Mismo patrón que restaurant/usecases/public-menu.ts.
//
// i18n: el helper compartido `resolveForLang` (shared/i18n.ts) NO aplica acá — está pensado
// para entidades con `translations: Record<lang, Partial<Record<field, string>>>` (un mapa
// por campo). El hotel guarda `descriptionTranslations: Record<lang, {title?, description?}>`
// (un solo objeto con ambos campos) y el español base vive en `descriptionJson` (string JSON,
// D7). Resolvemos inline: si `lang` matchea una key de `descriptionTranslations` se usa esa
// traducción; si no, se parsea `descriptionJson` (español base); si no hay nada, null/null.
// Ver openspec/changes/solmi-direct-booking/specs/public-hotel-info/spec.md (D2, D7).
import { NotFoundError } from 'arckode-framework'
import type { RepositoryAdapter } from 'arckode-framework'
import type { PublicHotelInfoDTO } from '../types'

export interface PublicHotelInfoDeps {
  hotels: RepositoryAdapter<any>
}

// Anti-enumeración: MISMO mensaje para "no existe" y "no activo" (no filtrar hoteles inactivos).
const NOT_FOUND_MSG = 'Hotel not found'

export async function getPublicHotelInfo(
  deps: PublicHotelInfoDeps,
  slug: string,
  lang: string | undefined,
): Promise<PublicHotelInfoDTO> {
  if (!slug) throw new NotFoundError(NOT_FOUND_MSG)

  const hotel = await deps.hotels.findOne({ slug })
  if (!hotel) throw new NotFoundError(NOT_FOUND_MSG)
  // onlineBookingStatus !== 'active' MISMO 404 — un hotel pausado no se enumera desde la ruta pública.
  if (hotel.onlineBookingStatus !== 'active') throw new NotFoundError(NOT_FOUND_MSG)

  const { title, description } = resolveI18n(hotel, lang)

  // Allow-list ESTRICTA: copia campo por campo. NUNCA `...hotel` — arrastraría ownerName,
  // taxId, wifiPassword, etc. al JSON de respuesta (ver spec, "Anti-patrón allow-list").
  return {
    id: hotel.id,
    slug: hotel.slug,
    name: hotel.name,
    title,
    description,
    descriptionTranslations: hotel.descriptionTranslations ?? null,
    accommodationType: hotel.accommodationType ?? 'hotel',
    starRating: hotel.starRating ?? null,
    latitude: hotel.latitude ?? 0,
    longitude: hotel.longitude ?? 0,
    address: hotel.address ?? null,
    province: hotel.province ?? null,
    municipality: hotel.municipality ?? null,
    locality: hotel.locality ?? null,
    postalCode: hotel.postalCode ?? null,
    phone: hotel.phone ?? null,
    email: hotel.email ?? null,
    website: hotel.website ?? null,
    checkIn: hotel.checkIn ?? '15:00',
    checkOut: hotel.checkOut ?? '12:00',
    currency: hotel.currency ?? 'USD',
    taxName: hotel.taxName ?? 'ITBIS',
    taxRate: hotel.taxRate ?? 18.0,
    cancellationType: hotel.cancellationType ?? 'flexible',
    freeCancellation: hotel.freeCancellation ?? true,
    depositRequired: hotel.depositRequired ?? true,
    depositPercent: hotel.depositPercent ?? 30,
    releaseHours: hotel.releaseHours ?? 0,
    logo: hotel.logo ?? null,
    amenities: hotel.amenities ?? null,
    onlineBookingStatus: hotel.onlineBookingStatus,
  }
}

/** Resuelve title/description para `lang` (D2, D7). Fallback final SIEMPRE español base
 *  (`descriptionJson`), nunca null si hay dato base. `descriptionTranslations` NUNCA incluye
 *  'es' — el español base vive en `descriptionJson` (dos fuentes de verdad, D7). */
function resolveI18n(
  hotel: any,
  lang: string | undefined,
): { title: string | null; description: string | null } {
  // 1. Traducción declarada para `lang` (distinto de español base).
  if (lang && lang !== 'es') {
    const t = hotel.descriptionTranslations?.[lang]
    if (t && typeof t === 'object') {
      return {
        title: typeof t.title === 'string' && t.title !== '' ? t.title : null,
        description: typeof t.description === 'string' && t.description !== '' ? t.description : null,
      }
    }
  }
  // 2. Español base desde `descriptionJson` (string JSON con shape {title?, description?}).
  //    Defensivo: si es string vacío/null, o si ya es un objeto (algunas seeds), lo maneja.
  const base = parseDescriptionJson(hotel.descriptionJson)
  return {
    title: base?.title ?? null,
    description: base?.description ?? null,
  }
}

function parseDescriptionJson(raw: unknown): { title?: string; description?: string } | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'object') return raw as { title?: string; description?: string }
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as { title?: string; description?: string }
    return null
  } catch {
    return null
  }
}
