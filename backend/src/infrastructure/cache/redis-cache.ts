// infrastructure/cache/redis-cache.ts — CacheAdapter respaldado por Redis (PF-03, #279).
//
// El cache in-memory (MemoryCache, kernel/cache.ts) se pierde en cada restart y no se
// comparte entre procesos — bloquea escalado horizontal y desperdicia el warm-up tras cada
// deploy. Selección por REDIS_URL en composition-root.ts: sin la var, comportamiento actual
// (MemoryCache) queda intacto — cero config nueva requerida en dev.
//
// Cliente: Bun.RedisClient nativo (Bun >=1.2, este repo corre 1.3.x) — sin dependencia externa.
//
// Fail-soft: si Redis está caído, NO se tumba el request. get() devuelve null (cache miss, el
// caller recomputa como si nunca hubiera estado cacheado); set()/delete()/flush() loguean el
// error y siguen sin lanzar — el cache es una optimización, no una fuente de verdad.
//
// Invalidación: sin KEYS/glob (`cache.delete('x:*')` no borra nada en ningún adapter). Las
// claves de listado ya se invalidan bumpeando un token de versión (ver
// facturas/usecases/cache.ts, folios/usecases/cache.ts) — delete() acá sigue siendo por clave
// exacta, mismo contrato que MemoryCache.

import type { CacheAdapter, Logger } from 'arckode-framework'
import { RedisClient } from 'bun'

export class RedisCache implements CacheAdapter {
  private readonly client: RedisClient

  constructor(url: string, private readonly logger: Logger) {
    // enableOfflineQueue:false es CLAVE para el fail-soft: por default Bun.RedisClient encola
    // comandos mientras está desconectado en vez de fallar — con Redis caído, get()/set()
    // quedarían colgados indefinidamente (nunca resuelven ni rechazan) en vez de devolver
    // rápido el fallback. connectionTimeout corto (3s) evita que un Redis inalcanzable demore
    // el primer intento tanto como el default (10s).
    this.client = new RedisClient(url, { enableOfflineQueue: false, connectionTimeout: 3000 })
    this.client.onclose = (error) => {
      this.logger.warn(`RedisCache: conexión cerrada — ${error?.message ?? 'sin detalle'}`)
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key)
      if (raw === null) return null
      return JSON.parse(raw) as T
    } catch (e) {
      this.logger.warn(`RedisCache.get falló para "${key}": ${(e as Error).message}`)
      return null
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch (e) {
      this.logger.warn(`RedisCache.set falló para "${key}": ${(e as Error).message}`)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key)
    } catch (e) {
      this.logger.warn(`RedisCache.delete falló para "${key}": ${(e as Error).message}`)
    }
  }

  /** FLUSHDB vía comando crudo — el CacheAdapter no expone flush por patrón, solo total. */
  async flush(): Promise<void> {
    try {
      await this.client.send('FLUSHDB', [])
    } catch (e) {
      this.logger.warn(`RedisCache.flush falló: ${(e as Error).message}`)
    }
  }
}
