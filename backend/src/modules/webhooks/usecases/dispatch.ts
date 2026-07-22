// webhooks/usecases/dispatch.ts — Entrega de eventos a las subscriptions activas de un hotel.
//
// Para cada subscription activa del hotel que tenga el evento en su lista `events`, hace POST a
// `url` con el payload + firma HMAC-SHA256 (header `x-solmios-signature`, calculada con el
// `secret` de ESA subscription). Reintenta hasta 3 veces (backoff 1s/3s/9s) si la respuesta no es
// 2xx o hay error de red. Registra en `webhook_deliveries` el resultado FINAL (no cada intento
// individual) — best-effort: si el registro falla, no vuelve a lanzar (ya se hizo todo lo posible
// por entregar el evento).

import { createHmac } from 'crypto'
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { WebhookSubscriptionDTO, WebhookDeliveryDTO } from '../types'
import { assertPublicWebhookUrl, type DnsLookupFn } from './validate-url'

const RETRY_DELAYS_MS = [1000, 3000, 9000]

export interface DispatchDeps {
  subscriptionRepo: RepositoryAdapter<WebhookSubscriptionDTO>
  deliveryRepo: RepositoryAdapter<WebhookDeliveryDTO>
  logger: Logger
  /** Inyectable para tests (mockear fetch sin red real). Default: `fetch` global. */
  fetchImpl?: typeof fetch
  /** Inyectable para tests (evitar esperar 1s/3s/9s reales). Default: `setTimeout` real. */
  sleepImpl?: (ms: number) => Promise<void>
  /** Inyectable para tests (evitar depender de DNS real). Default: `dns.lookup`. */
  lookupImpl?: DnsLookupFn
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

async function deliverToSubscription(
  deps: DispatchDeps,
  sub: WebhookSubscriptionDTO,
  event: string,
  payload: unknown,
): Promise<void> {
  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() })
  const signature = sign(body, sub.secret ?? '')
  const doFetch = deps.fetchImpl ?? fetch
  const doSleep = deps.sleepImpl ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))

  let statusCode: number | undefined
  let success = false

  // Re-valida la URL acá, no solo al crear/editar la subscription: el hostname pudo resolver a una
  // IP pública en ese momento y a una privada ahora (DNS rebinding). Si falla, no se intenta ningún
  // fetch — se registra como entrega fallida, best-effort, sin romper al llamante.
  try {
    await assertPublicWebhookUrl(sub.url, deps.lookupImpl)
  } catch (e) {
    deps.logger.warn('Entrega de webhook bloqueada: URL no pública', {
      webhookId: sub.id, url: sub.url, event, error: (e as Error).message,
    })
    try {
      await deps.deliveryRepo.create({
        webhookId: sub.id, event, statusCode: undefined, success: 0, attemptedAt: new Date().toISOString(),
      } as Omit<WebhookDeliveryDTO, 'id'>)
    } catch { /* best-effort */ }
    return
  }

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await doFetch(sub.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-solmios-signature': signature },
        body,
      })
      statusCode = res.status
      if (res.status >= 200 && res.status < 300) { success = true; break }
    } catch (e) {
      deps.logger.warn('Entrega de webhook falló (error de red)', {
        webhookId: sub.id, url: sub.url, event, attempt, error: (e as Error).message,
      })
    }
    const delay = RETRY_DELAYS_MS[attempt]
    if (delay !== undefined) await doSleep(delay)
  }

  try {
    await deps.deliveryRepo.create({
      webhookId: sub.id,
      event,
      statusCode,
      success: success ? 1 : 0,
      attemptedAt: new Date().toISOString(),
    } as Omit<WebhookDeliveryDTO, 'id'>)
  } catch (e) {
    deps.logger.warn('No se pudo registrar la entrega del webhook (best-effort)', {
      webhookId: sub.id, event, error: (e as Error).message,
    })
  }
}

/** Despacha un evento de negocio a todas las subscriptions activas del hotel que lo escuchan. */
export async function dispatchWebhookEvent(
  deps: DispatchDeps,
  hotelId: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const subs = await deps.subscriptionRepo.findMany({ hotelId, active: 1 })
  const targets = subs.filter((s) => Array.isArray(s.events) && s.events.includes(event))
  await Promise.all(targets.map((sub) => deliverToSubscription(deps, sub, event, payload)))
}

/** Dispara un evento sintético a UNA subscription puntual, sin filtrar por su lista `events` (usado por POST /webhooks/:id/test). */
export async function testWebhookSubscription(
  deps: DispatchDeps,
  sub: WebhookSubscriptionDTO,
  event = 'ping',
  payload: unknown = { message: 'Evento de prueba desde SolmiOS' },
): Promise<void> {
  await deliverToSubscription(deps, sub, event, payload)
}
