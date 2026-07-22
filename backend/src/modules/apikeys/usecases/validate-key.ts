// apikeys/usecases/validate-key.ts — Autenticación por API key (header x-api-key).
//
// Mismo algoritmo que usecases/secret.ts (SHA-256 del secreto en claro). El hash calculado se
// usa primero para acotar la búsqueda en el repo (índice/igualdad exacta), y LUEGO se vuelve a
// comparar con `crypto.timingSafeEqual` contra el hash guardado — así no dependemos únicamente
// de la semántica de igualdad de string del motor de DB para el paso de seguridad. `timingSafeEqual`
// tira si los Buffers no tienen la MISMA longitud, así que se valida el largo antes (nunca debería
// pasar con SHA-256 hex de 64 chars, pero un dato corrupto/legacy no puede tumbar el middleware).
//
// Efecto secundario best-effort: si matchea y la key está activa, incrementa `requests` y
// actualiza `lastUsed`. Si ese UPDATE falla, la autenticación NO se bloquea (no es razón para
// rechazar una request válida).

import { createHash, timingSafeEqual } from 'crypto'
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { ApikeysDTO } from '../types'

export interface ValidatedApiKey {
  hotelId?: string
  scope?: string
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function validateApiKey(
  repo: RepositoryAdapter<ApikeysDTO>,
  plainKey: string | undefined | null,
  logger?: Logger,
): Promise<ValidatedApiKey | null> {
  if (!plainKey) return null
  const hash = createHash('sha256').update(plainKey).digest('hex')

  // Acota por igualdad exacta de hash (índice) — la seguridad real la da timingSafeEqual abajo.
  const candidates = await repo.findMany({ secretHash: hash, active: 1 })
  const match = candidates.find((item) => item.secretHash && safeEqualHex(hash, item.secretHash))
  if (!match) return null

  try {
    await repo.update(match.id, {
      requests: (match.requests ?? 0) + 1,
      lastUsed: new Date().toISOString(),
    } as Partial<ApikeysDTO>)
  } catch (e) {
    logger?.warn('No se pudo actualizar uso de API key (best-effort, no bloquea auth)', {
      id: match.id, error: (e as Error).message,
    })
  }

  return { hotelId: match.hotelId, scope: match.scope }
}
