// server-tracking/usecases/ga4-ss.ts — Fire GA4 Measurement Protocol v2 Server-Side (F3 3.11+3.12).
//
// Spec: server-tracking/spec.md "GA4 Measurement Protocol Server-Side fire".
// POST https://www.google-analytics.com/mp/collect?measurement_id=X&api_secret=Y
// con client_id + events:[{name:'purchase', params:{transaction_id, value, currency, items}}].
//
// Si `ga4_measurement_id` o `ga4_api_secret` no configurados → skip silencioso. Persiste
// tracking_events con status='skipped'.
//
// client_id (spec.md "client_id: AnonymousID del navegador"): se propagaba desde el form
// del widget (F2). Hoy F2 todavía no cablea anonymousId → usamos fallback determinístico
// 'server.<reservationId>' (NO 'anonymous' genérico: GA4 cuenta users únicos por client_id;
// un fallback compartido achata la métrica). Cuando F3 3.18 suba el client_id del navegador,
// se respeta ese valor.
//
// HTTP timeout: 5s con AbortController. Anti-patrón ORM (mem 1805): TODO campo persistido
// está declarado en model.ts.
import type { Logger, RepositoryAdapter } from 'arckode-framework'
import type { ReservationTrackingData, FireResult, TrackingFetcher } from '../types'

const GA4_MP_BASE = 'https://www.google-analytics.com/mp/collect'
const DEFAULT_TIMEOUT_MS = 5000

export interface Ga4SSDeps {
  configRepo: RepositoryAdapter<{ key: string; value: unknown; hotelId: string }>
  fetcher?: TrackingFetcher
  timeoutMs?: number
}

/** Lee creds GA4 del hotel desde configuration. Devuelve null si falta measurement_id o api_secret. */
export async function readGa4Config(
  hotelId: string,
  configRepo: RepositoryAdapter<{ key: string; value: unknown }>,
): Promise<{ measurementId: string; apiSecret: string } | null> {
  const rows = await configRepo.findMany({ hotelId })
  const map: Record<string, unknown> = {}
  for (const r of rows) {
    if (typeof r.key === 'string') map[r.key] = r.value
  }
  const measurementId = map.ga4_measurement_id
  const apiSecret = map.ga4_api_secret
  if (typeof measurementId !== 'string' || !measurementId.trim()) return null
  if (typeof apiSecret !== 'string' || !apiSecret.trim()) return null
  return { measurementId: measurementId.trim(), apiSecret: apiSecret.trim() }
}

/**
 * Construye el payload GA4 MP v2 para purchase (spec.md "GA4 MP fire").
 * Exportado para tests: verificar shape sin tocar HTTP.
 *
 * NOTA sobre `anonymousId`: si el caller lo trae (futuro F3 3.18), se respeta como
 * client_id. Si no, se genera fallback determinístico por reservationId.
 */
export function buildGa4Payload(data: ReservationTrackingData): Record<string, unknown> {
  const clientId = (data.anonymousId && String(data.anonymousId).trim())
    ? String(data.anonymousId).trim()
    : `server.${data.reservationId}`
  return {
    client_id: clientId,
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: data.reservationId,
          value: data.totalAmount,
          currency: data.currency || 'USD',
          items: [
            {
              item_id: data.roomId,
              item_name: `Room ${data.roomId}`,
              item_category: 'hotel',
              price: data.totalAmount,
              quantity: 1,
            },
          ],
        },
      },
    ],
  }
}

/**
 * Dispara el evento purchase a GA4 MP para una reserva confirmada.
 * NUNCA lanza: toda excepción se captura y persiste como status='failed'.
 */
export async function fireGa4Conversion(
  data: ReservationTrackingData,
  trackingRepo: RepositoryAdapter<any>,
  deps: Ga4SSDeps,
  logger: Logger,
): Promise<FireResult> {
  const log = logger.child('ga4-ss')
  let cfg: { measurementId: string; apiSecret: string } | null = null
  try {
    cfg = await readGa4Config(data.hotelId, deps.configRepo)
  } catch (e) {
    log.error('Error leyendo configuration GA4', { error: (e as Error).message })
  }

  const pendingId = await persistPending(trackingRepo, data, {
    reason: cfg ? 'about_to_fire' : 'no_creds',
  })

  if (!cfg) {
    await updateStatus(trackingRepo, pendingId, 'skipped', 'ga4 skipped: not configured', { ga4_payload: null })
    log.info('ga4 skipped: not configured', { hotelId: data.hotelId, reservationId: data.reservationId })
    return { status: 'skipped', eventId: pendingId, errorMessage: 'ga4 skipped: not configured' }
  }

  const body = buildGa4Payload(data)
  const url = `${GA4_MP_BASE}?measurement_id=${encodeURIComponent(cfg.measurementId)}&api_secret=${encodeURIComponent(cfg.apiSecret)}`
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
    // GA4 MP devuelve 204 No Content en éxito (sin body). 2xx = OK.
    let respBody: unknown = null
    if (response.status !== 204) {
      try { respBody = await response.json() } catch { try { respBody = await response.text() } catch { /* ignore */ } }
    }
    if (response.ok) {
      await updateStatus(trackingRepo, pendingId, 'sent', undefined, { ga4_payload: body, ga4_response: respBody })
      log.info('ga4 fire sent', { hotelId: data.hotelId, reservationId: data.reservationId, httpStatus: response.status })
      return { status: 'sent', eventId: pendingId, response: respBody }
    }
    const errMsg = `GA4 API ${response.status}: ${truncate(JSON.stringify(respBody))}`
    await updateStatus(trackingRepo, pendingId, 'failed', errMsg, { ga4_payload: body, ga4_response: respBody })
    log.warn('ga4 fire failed', { hotelId: data.hotelId, reservationId: data.reservationId, httpStatus: response.status })
    return { status: 'failed', eventId: pendingId, errorMessage: errMsg, response: respBody }
  } catch (e) {
    clearTimeout(timer)
    const errMsg = `ga4 network: ${(e as Error).message}`
    await updateStatus(trackingRepo, pendingId, 'failed', errMsg, { ga4_payload: body })
    log.warn('ga4 fire exception', { hotelId: data.hotelId, reservationId: data.reservationId, error: (e as Error).message })
    return { status: 'failed', eventId: pendingId, errorMessage: errMsg }
  }
}

// ─── Helpers (duplicados acá para evitar dependencia cruzada meta-capi ↔ ga4-ss) ───
// Si se añade un 3er target, mover a un shared helpers.ts. Por ahora dos targets = duplicación tolerable.

async function persistPending(
  repo: RepositoryAdapter<any>,
  data: ReservationTrackingData,
  meta: Record<string, unknown>,
): Promise<string> {
  const id = crypto.randomUUID()
  try {
    await repo.create({
      id,
      hotelId: data.hotelId,
      event: 'confirm',
      meta: { target: 'ga4', ...meta },
      anonymousId: data.anonymousId ?? null,
      reservationId: data.reservationId,
      target: 'ga4',
      status: 'pending',
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[server-tracking] ga4 persistPending failed', e)
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
    console.error('[server-tracking] ga4 updateStatus failed', e)
  }
}

function truncate(s: string, max = 500): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

export const ga4ss = { fireConversion: fireGa4Conversion, buildPayload: buildGa4Payload, readConfig: readGa4Config }
