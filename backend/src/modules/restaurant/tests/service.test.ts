// restaurant/tests/service.test.ts — Tests del servicio POS (estaciones, RES-0).
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { RestaurantService } from '../service'
import type { StationDTO, CurrentUser } from '../types'

const log = silentLogger()
const passAuth: Auth = { assertOwnership: () => {}, authenticate: (() => []) as any } as unknown as Auth
// Auth que rechaza si el hotel del recurso no es el del usuario (simula el guard real).
const strictAuth: Auth = {
  assertOwnership: (resourceHotel: string, userHotel: string, role?: string, sa?: string) => {
    if (role === sa) return
    if (resourceHotel !== userHotel) throw new Error('IDOR: recurso de otro hotel')
  },
  authenticate: (() => []) as any,
} as unknown as Auth
const user: CurrentUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }

function makeRepo(overrides: Partial<RepositoryAdapter<StationDTO>> = {}): RepositoryAdapter<StationDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'st-id', ...data } as StationDTO),
    update: async (id, data) => ({ id, ...data } as StationDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 100, offset: 0, pages: 0 }),
    ...overrides,
  }
}
function makeUserRepo(hotelId = 'h1'): RepositoryAdapter<any> {
  return { ...makeRepo() as any, findById: async () => ({ id: 'u1', hotelId }) }
}
function svc(repo: RepositoryAdapter<StationDTO>, auth: Auth = passAuth, userHotel = 'h1') {
  return new RestaurantService(repo, makeUserRepo(userHotel), log, auth)
}

describe('RestaurantService — estaciones (RES-0)', () => {
  it('crea una estación forzando el hotelId del JWT (no del body)', async () => {
    let created: any = null
    const repo = makeRepo({ create: async (d) => { created = d; return { id: 's1', ...d } as StationDTO } })
    const st = await svc(repo).createStation({ name: 'Cocina' }, user)
    expect(st.id).toBe('s1')
    expect(created.hotelId).toBe('h1')   // del user, no del body
    expect(created.active).toBe(1)        // default
    expect(created.sortOrder).toBe(0)     // default
    expect(created.name).toBe('Cocina')
  })

  it('rechaza estación sin nombre (ValidationError)', async () => {
    await expect(svc(makeRepo()).createStation({ name: '   ' }, user)).rejects.toThrow()
  })

  it('lista las estaciones del hotel ordenadas por sortOrder', async () => {
    const rows: StationDTO[] = [
      { id: 'b', hotelId: 'h1', name: 'Bar', sortOrder: 2 } as StationDTO,
      { id: 'a', hotelId: 'h1', name: 'Cocina', sortOrder: 1 } as StationDTO,
    ]
    const res = await svc(makeRepo({ findMany: async () => rows.slice() })).listStations(user)
    expect(res.total).toBe(2)
    expect(res.data[0].name).toBe('Cocina')   // sortOrder 1 primero
    expect(res.data[1].name).toBe('Bar')
  })

  it('getStation lanza NotFound si no existe', async () => {
    await expect(svc(makeRepo({ findById: async () => null })).getStation('x', user)).rejects.toThrow('no encontrada')
  })

  it('getStation respeta ownership: estación de otro hotel es inaccesible', async () => {
    const repo = makeRepo({ findById: async () => ({ id: 's1', hotelId: 'OTRO', name: 'Bar' } as StationDTO) })
    await expect(svc(repo, strictAuth).getStation('s1', user)).rejects.toThrow('IDOR')
  })

  it('updateStation actualiza una estación propia', async () => {
    const repo = makeRepo({
      findById: async () => ({ id: 's1', hotelId: 'h1', name: 'Cocina' } as StationDTO),
      update: async (id, d) => ({ id, hotelId: 'h1', name: 'Cocina', ...d } as StationDTO),
    })
    const st = await svc(repo, strictAuth).updateStation('s1', { active: 0 }, user)
    expect(st.active).toBe(0)
  })

  it('deleteStation borra una estación propia; NotFound si no existe', async () => {
    const ok = makeRepo({ findById: async () => ({ id: 's1', hotelId: 'h1', name: 'Bar' } as StationDTO) })
    await expect(svc(ok, strictAuth).deleteStation('s1', user)).resolves.toBeUndefined()
    await expect(svc(makeRepo(), strictAuth).deleteStation('nope', user)).rejects.toThrow('no encontrada')
  })
})
