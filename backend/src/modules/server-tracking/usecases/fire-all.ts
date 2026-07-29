// server-tracking/usecases/fire-all.ts — Orquestación de fires Meta+GA4 para una reserva (F3 3.12).
//
// Extraído del service.ts para evitar God Object >200 líneas (regla analyzer). El service
// delega acá `fireAll(reservationId)` y `loadReservationData(reservationId)`.
//
// Pasos:
//  1. Lee la reserva + guest desde los repos (multi-tenant: hotelId sale de la propia
//     reserva — autenticada por la firma Stripe del webhook, no por sesión de usuario).
//  2. Dispara Meta CAPI + GA4-SS en paralelo (Promise.allSettled — nunca throw).
//  3. Cada fire persiste su propia fila en tracking_events con status sent/failed/skipped.
//
// Best-effort total: si Meta cae, GA4 igual dispara (y viceversa). NUNCA lanza.
import type { Logger, RepositoryAdapter } from 'arckode-framework'
import type { ReservationTrackingData, FireResult } from '../types'
import { fireMetaConversion, type MetaCapiDeps } from './meta-capi'
import { fireGa4Conversion, type Ga4SSDeps } from './ga4-ss'

interface ReservationRow {
  id: string
  hotelId: string
  roomId: string
  totalAmount: number
  currency?: string
  marketingAccepted?: boolean
  guestId?: string | null
}
interface GuestRow {
  id: string
  email?: string | null
  phone?: string | null
}

/** Deps pasadas desde el service al usecase (singleton lifetime). */
export interface FireAllDeps {
  reservationsRepo: RepositoryAdapter<ReservationRow>
  guestsRepo: RepositoryAdapter<GuestRow>
  configRepo: RepositoryAdapter<{ key: string; value: unknown; hotelId: string }>
  fetcher?: MetaCapiDeps['fetcher']
  timeoutMs?: number
}

/**
 * Carga datos de la reserva + guest. Devuelve null si la reserva no existe.
 * El hotelId SALE de la propia reserva (autenticada por firma Stripe del webhook).
 */
export async function loadReservationData(
  reservationId: string,
  deps: FireAllDeps,
): Promise<ReservationTrackingData | null> {
  const reservation = await deps.reservationsRepo.findOne({ id: reservationId })
  if (!reservation) return null
  let guestEmail: string | null = null
  let guestPhone: string | null = null
  if (reservation.guestId) {
    const guest = await deps.guestsRepo.findOne({ id: reservation.guestId })
    if (guest) {
      guestEmail = guest.email ?? null
      guestPhone = guest.phone ?? null
    }
  }
  return {
    reservationId,
    hotelId: reservation.hotelId,
    roomId: reservation.roomId,
    totalAmount: reservation.totalAmount ?? 0,
    currency: reservation.currency ?? 'USD',
    guestEmail,
    guestPhone,
    marketingAccepted: !!reservation.marketingAccepted,
    anonymousId: null, // F2 widget todavía no propaga anonymousId; F3 3.18 lo cablea.
  }
}

/** Versión con ownership check (para el test-fire admin). */
export async function loadReservationDataForUser(
  reservationId: string,
  hotelId: string,
  deps: FireAllDeps,
): Promise<ReservationTrackingData | null> {
  const data = await loadReservationData(reservationId, deps)
  if (!data) return null
  if (data.hotelId !== hotelId) return null
  return data
}

/**
 * Orquesta Meta CAPI + GA4 en paralelo. NUNCA lanza (allSettled + cada fire captura su error).
 * F3 3.12 acceptance: "confirmar reserva con creds configuradas → 2 events fire + persisten".
 */
export async function fireAll(
  reservationId: string,
  trackingRepo: RepositoryAdapter<any>,
  deps: FireAllDeps,
  logger: Logger,
): Promise<{ meta: FireResult; ga4: FireResult; data: ReservationTrackingData | null }> {
  const data = await loadReservationData(reservationId, deps)
  if (!data) {
    logger.warn('server-tracking.fireAll: reservation not found', { reservationId })
    const empty: FireResult = { status: 'skipped', eventId: '', errorMessage: 'reservation not found' }
    return { meta: empty, ga4: empty, data: null }
  }
  const metaDeps: MetaCapiDeps = { configRepo: deps.configRepo, fetcher: deps.fetcher, timeoutMs: deps.timeoutMs }
  const ga4Deps: Ga4SSDeps = { configRepo: deps.configRepo, fetcher: deps.fetcher, timeoutMs: deps.timeoutMs }
  const [metaRes, ga4Res] = await Promise.allSettled([
    fireMetaConversion(data, trackingRepo, metaDeps, logger),
    fireGa4Conversion(data, trackingRepo, ga4Deps, logger),
  ])
  const meta = metaRes.status === 'fulfilled'
    ? metaRes.value
    : { status: 'failed' as const, eventId: '', errorMessage: (metaRes.reason as Error)?.message ?? 'meta rejected' }
  const ga4 = ga4Res.status === 'fulfilled'
    ? ga4Res.value
    : { status: 'failed' as const, eventId: '', errorMessage: (ga4Res.reason as Error)?.message ?? 'ga4 rejected' }
  return { meta, ga4, data }
}
