// apikeys/tests/validate-key.test.ts — Auth por API key: correcta / incorrecta / inactiva.

import { describe, it, expect } from 'bun:test'
import { createHash } from 'crypto'
import type { RepositoryAdapter } from 'arckode-framework'
import { validateApiKey } from '../usecases/validate-key'
import type { ApikeysDTO } from '../types'

function hashOf(plainKey: string): string {
  return createHash('sha256').update(plainKey).digest('hex')
}

function makeRepo(overrides: Partial<RepositoryAdapter<ApikeysDTO>> = {}): RepositoryAdapter<ApikeysDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'key-1', ...data } as ApikeysDTO),
    update: async (id, data) => ({ id, ...data } as ApikeysDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('validateApiKey', () => {
  it('matchea una key correcta y devuelve hotelId/scope', async () => {
    const plainKey = 'sk_test_correct_key'
    const stored: ApikeysDTO = {
      id: 'key-1', hotelId: 'hotel-1', name: 'Integración', scope: 'read:rooms,write:reservations',
      secretHash: hashOf(plainKey), active: 1, requests: 3, createdAt: '', updatedAt: '',
    }
    const repo = makeRepo({ findMany: async () => [stored] })
    const result = await validateApiKey(repo, plainKey)
    expect(result).toEqual({ hotelId: 'hotel-1', scope: 'read:rooms,write:reservations' })
  })

  it('incrementa requests y actualiza lastUsed en un match (best-effort)', async () => {
    const plainKey = 'sk_test_correct_key'
    const stored: ApikeysDTO = {
      id: 'key-1', hotelId: 'hotel-1', name: 'Integración', secretHash: hashOf(plainKey),
      active: 1, requests: 3, createdAt: '', updatedAt: '',
    }
    let updateCalledWith: any = null
    const repo = makeRepo({
      findMany: async () => [stored],
      update: async (id, data) => { updateCalledWith = { id, data }; return { ...stored, ...data, id } as ApikeysDTO },
    })
    await validateApiKey(repo, plainKey)
    expect(updateCalledWith.id).toBe('key-1')
    expect(updateCalledWith.data.requests).toBe(4)
    expect(typeof updateCalledWith.data.lastUsed).toBe('string')
  })

  it('rechaza una key incorrecta (hash no matchea ninguna almacenada)', async () => {
    const stored: ApikeysDTO = {
      id: 'key-1', hotelId: 'hotel-1', name: 'Integración', secretHash: hashOf('sk_the_real_key'),
      active: 1, requests: 0, createdAt: '', updatedAt: '',
    }
    const repo = makeRepo({ findMany: async () => [] }) // el filtro por secretHash exacto no encuentra nada
    const result = await validateApiKey(repo, 'sk_wrong_key')
    expect(result).toBeNull()
    void stored
  })

  it('rechaza una key revocada (active=0, no aparece en el filtro del repo)', async () => {
    // El middleware filtra `active: 1` en el repo — una key inactiva nunca llega a candidates.
    const repo = makeRepo({ findMany: async () => [] })
    const result = await validateApiKey(repo, 'sk_revoked_key')
    expect(result).toBeNull()
  })

  it('no revienta con un plainKey vacío o undefined', async () => {
    const repo = makeRepo()
    expect(await validateApiKey(repo, '')).toBeNull()
    expect(await validateApiKey(repo, undefined)).toBeNull()
  })

  it('no bloquea la auth si el update de uso falla (best-effort)', async () => {
    const plainKey = 'sk_test_correct_key'
    const stored: ApikeysDTO = {
      id: 'key-1', hotelId: 'hotel-1', name: 'Integración', secretHash: hashOf(plainKey),
      active: 1, requests: 0, createdAt: '', updatedAt: '',
    }
    const repo = makeRepo({
      findMany: async () => [stored],
      update: async () => { throw new Error('db down') },
    })
    const result = await validateApiKey(repo, plainKey)
    expect(result).toEqual({ hotelId: 'hotel-1', scope: undefined })
  })
})
