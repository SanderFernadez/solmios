// server-tracking/usecases/meta-capi.ts — Fire Meta Conversions API (F3 3.11 + 3.12).
//
// Spec: server-tracking/spec.md "Meta CAPI fire al confirmar" + "Enhanced Conversions".
// POST https://graph.facebook.com/v18.0/{pixel_id}/events?access_token={token}
// con event_name:'Purchase', event_id=reservationId (dedup), action_source:'system',
// user_data con email/phone hasheados SHA256 (Enhanced Conversions).
//
// Si `meta_pixel_id` o `meta_capi_token` no configurados → skip silencioso (spec.md scenario
// "Skip sin creds"). Persiste tracking_events con status='skipped' para auditoría.
//
// Si `marketingAccepted=false` → NO se manda PII (user_data vacío). Spec.md scenario
// "Usuario rechaza consentimiento". El evento se dispara igual (sin hashes), solo cuenta
// la conversión sin atribución al usuario.
//
// Anti-patrón ORM (mem 1805): TODO campo persistido está declarado en model.ts.
//
// HTTP timeout: 5s con AbortController. Si Meta cae o tarda → status='failed' en
// tracking_events, no bloquea el webhook (el caller del connector es fire-and-forget).
import type { Logger, RepositoryAdapter } from 'arckode-framework'
import type { ReservationTrackingData, FireResult, TrackingFetcher } from '../types'
import { hashEmail, hashPhone } from './enhanced-conversions'

const META_GRAPH_BASE = 'https://graph.facebook.com/v18.0'
const DEFAULT_TIMEOUT_MS = 5000

/** Repo `Configuration` para leer creds del hotel (multi-tenant). */
export interface MetaCapiDeps {
  configRepo: RepositoryAdapter<{ key: string; value: unknown; hotelId: string }>
  /** Fetcher HTTP inyectable. Default: global `fetch`. Tests lo mockean. */
  fetcher?: TrackingFetcher
  /** Timeout por HTTP call. Default 5000ms. */
  timeoutMs?: number
}

/**
 * Carga la config de tracking del hotel desde `configuration`. Lee solo las keys Meta.
 * Devuelve null si falta pixel_id o capi_token (skip silencioso).
 */
export async function readMetaConfig(
  hotelId: string,
  configRepo: RepositoryAdapter<{ key: string; value: unknown }>,
): Promise<{ pixelId: string; token: string; testCode?: string } | null> {
  const rows = await configRepo.findMany({ hotelId })
  const map: Record<string, unknown> = {}
  for (const r of rows) {
    if (typeof r.key === 'string') map[r.key] = r.value
  }
  const pixelId = map.meta_pixel_id
  const token = map.meta_capi_token
  const testCode = map.meta_test_event_code
  if (typeof pixelId !== 'string' || !pixelId.trim()) return null
  if (typeof token !== 'string' || !token.trim()) return null
  return {
    pixelId: pixelId.trim(),
    token: token.trim(),
    testCode: typeof testCode === 'string' && testCode.trim() ? testCode.trim() : undefined,
  }
}

/**
 * Construye el payload de Meta CAPI para el evento Purchase (spec.md Requirement: Meta CAPI).
 * Los hashes (`em`, `ph`) ya deben venir pre-computados desde `fireMetaConversion` con
 * `hashEmail`/`hashPhone`. Si `marketingAccepted=false`, los hashes se ignoran y user_data
 * va vacío (spec.md "Usuario rechaza consentimiento").
 *
 * Exportado para tests: verificar shape sin tocar HTTP.
 */
export function buildMetaPayload(
  data: ReservationTrackingData,
  hashes: { em?: string | null; ph?: string | null } = {},
  testCode?: string,
): Record<string, unknown> {
  const eventTime = Math.floor(Date.now() / 1000)
  const userData: Record<string, unknown> = {}
  if (data.marketingAccepted) {
    if (hashes.em) userData.em = [hashes.em]
    if (hashes.ph) userData.ph = [hashes.ph]
  }
  const event: Record<string, unknown> = {
    event_name: 'Purchase',
    event_id: data.reservationId, // dedup con client-side Pixel (spec.md "Deduplication event_id")
    event_time: eventTime,
    action_source: 'system', // server-side, NO 'website' (spec.md)
    user_data: userData,
    custom_data: {
      value: data.totalAmount,
      currency: data.currency || 'USD',
      content_type: 'hotel',
      content_ids: [data.roomId],
    },
    opt_in: data.marketingAccepted,
  }
  const body: Record<string, unknown> = { data: [event] }
  // Modo test de Meta Events Manager (spec.md Requirement: Test mode para dev).
  // test_event_code va al TOP-LEVEL del body, no dentro del event.
  if (testCode) body.test_event_code = testCode
  return body
}

/**
 * Dispara el evento Purchase a Meta CAPI para una reserva confirmada.
 *
 * Pasos:
 *  1. Lee creds Meta del hotel (configuration). Si faltan → status='skipped'.
 *  2. Hashea email/phone si marketingAccepted (Enhanced Conversions).
 *  3. POST a Meta Graph API con timeout 5s.
 *  4. Persiste tracking_events con status sent/failed/skipped + payload en meta.
 *
 * NUNCA lanza — toda excepción se captura y se persiste como status='failed' (spec.md
 * "Rate-limit / queue" + design.md: "no bloquea el webhook").
 */
export async function fireMetaConversion(
  data: ReservationTrackingData,
  trackingRepo: RepositoryAdapter<any>,
  deps: MetaCapiDeps,
  logger: Logger,
): Promise<FireResult> {
  const log = logger.child('meta-capi')
  let cfg: { pixelId: string; token: string; testCode?: string } | null = null
  try {
    cfg = await readMetaConfig(data.hotelId, deps.configRepo)
  } catch (e) {
    log.error('Error leyendo configuration Meta', { error: (e as Error).message })
  }

  // Pending row — se persiste ANTES del HTTP para que el status refleje el ciclo de vida
  // real. Si el proceso crashea antes del HTTP, queda 'pending' y se puede reintentar.
  const pendingId = await persistPending(trackingRepo, data, 'meta', {
    reason: cfg ? 'about_to_fire' : 'no_creds',
  })

  if (!cfg) {
    const errMsg = 'meta_capi skipped: not configured'
    await updateStatus(trackingRepo, pendingId, 'skipped', errMsg, { meta_payload: null })
    log.info('meta_capi skipped: not configured', { hotelId: data.hotelId, reservationId: data.reservationId })
    return { status: 'skipped', eventId: pendingId, errorMessage: errMsg }
  }

  // Hash PII si opt-in
  const hashes: { em?: string | null; ph?: string | null } = {}
  if (data.marketingAccepted) {
    hashes.em = await hashEmail(data.guestEmail)
    hashes.ph = await hashPhone(data.guestPhone)
  }

  const body = buildMetaPayload(data, hashes, cfg.testCode)
  const url = `${META_GRAPH_BASE}/${cfg.pixelId}/events?access_token=${encodeURIComponent(cfg.token)}`
  const fetcher = deps.fetcher ?? (globalThis.fetch as unknown as TrackingFetcher)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)
    let respBody: unknown = null
    if (response.status !== 204) {
      try { respBody = await response.json() } catch { try { respBody = await response.text() } catch { /* ignore */ } }
    }
    if (response.ok) {
      await updateStatus(trackingRepo, pendingId, 'sent', undefined, { meta_payload: body, meta_response: respBody })
      log.info('meta_capi fire sent', { hotelId: data.hotelId, reservationId: data.reservationId, httpStatus: response.status })
      return { status: 'sent', eventId: pendingId, response: respBody }
    }
    const errMsg = `Meta API ${response.status}: ${truncate(JSON.stringify(respBody))}`
    await updateStatus(trackingRepo, pendingId, 'failed', errMsg, { meta_payload: body, meta_response: respBody })
    log.warn('meta_capi fire failed', { hotelId: data.hotelId, reservationId: data.reservationId, httpStatus: response.status })
    return { status: 'failed', eventId: pendingId, errorMessage: errMsg, response: respBody }
  } catch (e) {
    clearTimeout(timer)
    const errMsg = `meta_capi network: ${(e as Error).message}`
    await updateStatus(trackingRepo, pendingId, 'failed', errMsg, { meta_payload: body })
    log.warn('meta_capi fire exception', { hotelId: data.hotelId, reservationId: data.reservationId, error: (e as Error).message })
    return { status: 'failed', eventId: pendingId, errorMessage: errMsg }
  }
}

// ─── Helpers de persistencia ────────────────────────────────────────────────

async function persistPending(
  repo: RepositoryAdapter<any>,
  data: ReservationTrackingData,
  target: 'meta' | 'ga4',
  meta: Record<string, unknown>,
): Promise<string> {
  const id = crypto.randomUUID()
  try {
    await repo.create({
      id,
      hotelId: data.hotelId,
      event: 'confirm',
      meta: { target, ...meta },
      anonymousId: data.anonymousId ?? null,
      reservationId: data.reservationId,
      target,
      status: 'pending',
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    // No dejar que un fallo de persistencia rompa el caller (webhook). Loguear y seguir:
    // igual intentamos el HTTP, el status final no se podrá actualizar pero el fire sigue.
    console.error('[server-tracking] persistPending failed', e)
  }
  return id
}

async function updateStatus(
  repo: RepositoryAdapter<any>,
  id: string,
  status: 'sent' | 'failed' | 'skipped',
  errorMessage: string | undefined,
  metaPatch: Record<string, unknown>,
): Promise<void> {
  try {
    await repo.update(id, { status, errorMessage: errorMessage ?? null, meta: metaPatch })
  } catch (e) {
    console.error('[server-tracking] updateStatus failed', e)
  }
}

function truncate(s: string, max = 500): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

export const metaCapi = {
  fireConversion: fireMetaConversion,
  buildPayload: buildMetaPayload,
  readConfig: readMetaConfig,
}
