// Rate limiter de intentos (login, forgot-password, endpoints públicos del booking engine, etc.)
//
// RL-01 (#316): el contador vivía en un Map en memoria del proceso — con varios workers/PM2
// cluster cada uno tiene su propio contador y el límite real termina siendo N× lo configurado
// (un atacante que rota entre workers multiplica su cupo). Con REDIS_URL seteada, el contador
// se comparte vía Redis (INCR atómico + EXPIRE en el primer hit de la ventana). Sin la var,
// Map en memoria de siempre — cero config nueva en dev, mismo comportamiento que antes.
//
// Fail-open: si Redis no está disponible, se permite el request (no se bloquea login legítimo
// por una caída de infraestructura) y se loguea una alerta — decisión documentada en el issue.
//
// La firma pública (rateLimit/recordFailedAttempt/resetAttempts) pasa a ser async: un contador
// realmente distribuido necesita un round-trip a un store compartido, no hay forma de que sea
// atómico entre procesos y siga siendo síncrono. Los ~30 call-sites ya corren dentro de
// handlers `async`, así que el cambio es agregar `await` — no se toca la lógica de negocio de
// qué se limita ni el reset-solo-en-éxito.

import type { HttpRequest } from 'arckode-framework'
import { RedisClient } from 'bun'
import { Logger } from 'arckode-framework'

const logger = new Logger('rate-limit', 'info')

const attempts = new Map<string, { count: number; resetAt: number }>()

const MAX_ATTEMPTS = 20
const WINDOW_MS = 5 * 60 * 1000 // 5 minutes
const MS_TO_SEC = 1000
const SWEEP_INTERVAL_MS = 5 * 60 * 1000 // cleanup every 5 min

// Periodic cleanup to prevent memory leak (solo aplica al backend en memoria).
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of attempts) {
    if (now > record.resetAt) attempts.delete(key)
  }
}, SWEEP_INTERVAL_MS)

// Cliente Redis: mismo patrón fail-soft que RedisCache (#279) — enableOfflineQueue:false para
// que un Redis caído rechace rápido en vez de colgar el request indefinidamente. Se conecta
// explícitamente al cargar el módulo (top-level await, mismo patrón que `await db.connect()`
// en composition-root.ts): sin esto, la PRIMERA llamada a rateLimit() justo después del boot
// podía perder la carrera contra el handshake TCP y caer en fail-open aunque Redis estuviera
// sano — con connect() resuelto de antemano, cuando entra el primer request ya se sabe si
// Redis está disponible o no.
const redis = process.env.REDIS_URL
  ? new RedisClient(process.env.REDIS_URL, { enableOfflineQueue: false, connectionTimeout: 3000 })
  : null
if (redis) {
  try {
    await redis.connect()
  } catch (e) {
    logger.warn(`rate-limit: no se pudo conectar a Redis al arrancar — ${(e as Error).message}`)
  }
}

function memoryRateLimit(key: string, maxAttempts: number, windowMs: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const record = attempts.get(key)

  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (record.count >= maxAttempts) {
    const retryAfter = Math.ceil((record.resetAt - now) / MS_TO_SEC)
    return { allowed: false, retryAfter }
  }

  record.count++
  return { allowed: true }
}

/**
 * Contador distribuido: INCR atómico (Redis garantiza que cada llamada devuelve un valor
 * único e incremental aunque lleguen concurrentes desde workers distintos). Si el contador
 * volvió a 1 (clave recién creada por este INCR), fija el TTL de la ventana — evita el
 * read-modify-write no atómico de "leer, decidir, escribir" que reintroduciría la carrera
 * que este issue viene a cerrar.
 */
async function redisRateLimit(key: string, maxAttempts: number, windowMs: number): Promise<{ allowed: boolean; retryAfter?: number }> {
  const redisKey = `ratelimit:${key}`
  const count = await redis!.incr(redisKey)
  if (count === 1) {
    await redis!.expire(redisKey, Math.ceil(windowMs / MS_TO_SEC))
  }
  if (count > maxAttempts) {
    const ttl = await redis!.ttl(redisKey)
    return { allowed: false, retryAfter: ttl > 0 ? ttl : Math.ceil(windowMs / MS_TO_SEC) }
  }
  return { allowed: true }
}

export async function rateLimit(
  key: string,
  opts?: { maxAttempts?: number; windowMs?: number },
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const maxAttempts = opts?.maxAttempts ?? MAX_ATTEMPTS
  const windowMs = opts?.windowMs ?? WINDOW_MS

  if (!redis) return memoryRateLimit(key, maxAttempts, windowMs)

  try {
    return await redisRateLimit(key, maxAttempts, windowMs)
  } catch (e) {
    // Fail-open documentado: no bloquear login legítimo por una caída de Redis.
    logger.warn(`rate-limit: Redis no disponible, fail-open para "${key}" — ${(e as Error).message}`)
    return { allowed: true }
  }
}

export async function recordFailedAttempt(key: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  return rateLimit(key)
}

export async function resetAttempts(key: string): Promise<void> {
  attempts.delete(key)
  if (!redis) return
  try {
    await redis.del(`ratelimit:${key}`)
  } catch (e) {
    logger.warn(`rate-limit: resetAttempts falló para "${key}" — ${(e as Error).message}`)
  }
}

/**
 * IP real del cliente para el rate limit. Orden de confianza (SEC-4.1):
 * 1. `CF-Connecting-IP`: Cloudflare la setea con la IP real y la sobrescribe en el borde
 *    (no forjable a través de CF). Es la fuente correcta en este deploy (Cloudflare → nginx).
 * 2. ÚLTIMA IP de `X-Forwarded-For`: la agrega el proxy confiable (nginx). La PRIMERA la puede
 *    forjar el cliente para rotar el bucket y saltarse el límite → NO se usa la primera.
 * 3. `remoteAddress`: fallback en dev/local sin proxy.
 */
export function getClientIp(req: HttpRequest): string {
  const cf = req.headers?.['cf-connecting-ip']
  if (cf) { const ip = String(cf).trim(); if (ip) return ip }
  const xff = req.headers?.['x-forwarded-for']
  if (xff) {
    const parts = String(xff).split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }
  return req.remoteAddress || 'unknown'
}
