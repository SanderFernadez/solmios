// infrastructure/cache/redis-cache.test.ts — PF-03 (#279).
// Corre contra un Redis real (DB lógica 15, aislada). Si no hay Redis disponible en
// REDIS_URL/localhost:6379, los tests se saltan (skip) en vez de fallar el suite entero —
// no todos los entornos de CI/dev tienen redis-server instalado.

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Logger } from 'arckode-framework'
import { RedisCache } from './redis-cache'

const TEST_REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/15'
const silentLogger = new Logger('test', 'error')

let redisAvailable = true
let cache: RedisCache

beforeAll(async () => {
  cache = new RedisCache(TEST_REDIS_URL, silentLogger)
  try {
    await cache.set('__probe__', 1, 5)
    const v = await cache.get('__probe__')
    if (v !== 1) redisAvailable = false
    await cache.delete('__probe__')
  } catch {
    redisAvailable = false
  }
})

afterAll(async () => {
  if (redisAvailable) await cache.flush()
})

describe('RedisCache (CacheAdapter)', () => {
  it('set/get: devuelve el valor serializado ida y vuelta sin pérdida', async () => {
    if (!redisAvailable) return
    const value = { a: 1, b: 'texto', c: [1, 2, 3], d: null }
    await cache.set('k1', value, 60)
    expect(await cache.get<typeof value>('k1')).toEqual(value)
  })

  it('get: clave inexistente devuelve null', async () => {
    if (!redisAvailable) return
    expect(await cache.get<string>('no-existe-nunca')).toBeNull()
  })

  it('delete: la clave deja de estar disponible', async () => {
    if (!redisAvailable) return
    await cache.set('k2', 'valor', 60)
    expect(await cache.get<string>('k2')).toBe('valor')
    await cache.delete('k2')
    expect(await cache.get<string>('k2')).toBeNull()
  })

  it('TTL: la clave expira sola pasado el tiempo configurado', async () => {
    if (!redisAvailable) return
    await cache.set('k3', 'expira-ya', 1)
    expect(await cache.get<string>('k3')).toBe('expira-ya')
    await new Promise((r) => setTimeout(r, 1300))
    expect(await cache.get<string>('k3')).toBeNull()
  }, 3000)

  it('flush: vacía todas las claves', async () => {
    if (!redisAvailable) return
    await cache.set('k4', 'a', 60)
    await cache.set('k5', 'b', 60)
    await cache.flush()
    expect(await cache.get<string>('k4')).toBeNull()
    expect(await cache.get<string>('k5')).toBeNull()
  })

  it('fail-soft: get() contra una URL inválida no lanza, devuelve null', async () => {
    const brokenCache = new RedisCache('redis://localhost:1/0', silentLogger)
    const result = await brokenCache.get<string>('cualquier-clave')
    expect(result).toBeNull()
  })

  it('fail-soft: set()/delete()/flush() contra una URL inválida no lanzan', async () => {
    const brokenCache = new RedisCache('redis://localhost:1/0', silentLogger)
    await expect(brokenCache.set('k', 'v', 60)).resolves.toBeUndefined()
    await expect(brokenCache.delete('k')).resolves.toBeUndefined()
    await expect(brokenCache.flush()).resolves.toBeUndefined()
  })
})
