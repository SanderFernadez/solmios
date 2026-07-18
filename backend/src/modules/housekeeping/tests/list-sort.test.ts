// El tablero pide "las últimas 10 terminadas", así que el listado tiene que
// poder ordenar. El valor viene de la query y termina en el ORDER BY: solo se
// aceptan campos de una lista blanca.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { ListUseCase } from '../usecases/list'
import type { HousekeepingDTO, HousekeepingUser } from '../types'

const admin: HousekeepingUser = { id: 'u1', role: 'hotel_admin', hotelId: 'h1' }

function setup() {
  const calls: any[] = []
  const repo = {
    paginate: async (filters: any, options: any) => {
      calls.push({ filters, options })
      return { data: [], total: 0 }
    },
  } as unknown as RepositoryAdapter<HousekeepingDTO>
  const cache = {
    get: async () => null,
    set: async () => {},
  } as unknown as CacheAdapter
  const userRepo = { findById: async () => ({ hotelId: 'h1' }) } as unknown as RepositoryAdapter<any>
  return { uc: new ListUseCase(repo, cache, userRepo), calls }
}

describe('ListUseCase — orden', () => {
  it('`-completedDate` ordena descendente (las terminadas más recientes)', async () => {
    const { uc, calls } = setup()
    await uc.list({ hotelId: 'h1', status: 'completed', limit: 10, sort: '-completedDate' } as any, admin)
    expect(calls[0].options.orderBy).toEqual({ field: 'completedDate', dir: 'DESC' })
    expect(calls[0].options.limit).toBe(10)
    expect(calls[0].filters.status).toBe('completed')
  })

  it('sin guion, ascendente', async () => {
    const { uc, calls } = setup()
    await uc.list({ hotelId: 'h1', sort: 'createdAt' } as any, admin)
    expect(calls[0].options.orderBy).toEqual({ field: 'createdAt', dir: 'ASC' })
  })

  it('un campo que no está en la lista blanca se ignora, no rompe el listado', async () => {
    const { uc, calls } = setup()
    await uc.list({ hotelId: 'h1', sort: '-password; DROP TABLE users' } as any, admin)
    expect(calls[0].options.orderBy).toBeUndefined()
  })

  it('sin `sort` no se toca el orden (la app móvil sigue viendo lo mismo)', async () => {
    const { uc, calls } = setup()
    await uc.list({ hotelId: 'h1' } as any, admin)
    expect(calls[0].options.orderBy).toBeUndefined()
  })

  it('respeta page/limit y calcula el offset', async () => {
    const { uc, calls } = setup()
    await uc.list({ hotelId: 'h1', page: 3, limit: 20 } as any, admin)
    expect(calls[0].options).toMatchObject({ offset: 40, limit: 20 })
  })

  it('el limit no puede pasar el tope del backend', async () => {
    const { uc, calls } = setup()
    await uc.list({ hotelId: 'h1', limit: 5000 } as any, admin)
    expect(calls[0].options.limit).toBe(100)
  })
})
