// empleados/tests/contracts-salary.test.ts — El salario es privado (privacidad, GitLab #397)
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { ContractUseCase } from '../usecases/contracts'

const log = silentLogger()

const CONTRACT = { id: 'c1', hotelId: 'h1', employeeId: 'e1', salary: 45000, currency: 'USD', status: 'active', position: 'Recepción' }

function makeRepo(overrides: Partial<RepositoryAdapter<any>> = {}): RepositoryAdapter<any> {
  return {
    findMany: async () => [{ ...CONTRACT }],
    findById: async () => ({ ...CONTRACT }),
    findOne: async () => null,
    create: async (d) => ({ id: 'c1', ...d }),
    update: async (id, d) => ({ ...CONTRACT, id, ...d }),
    delete: async () => true, count: async () => 1,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

function makeUseCase() {
  return new ContractUseCase(makeRepo(), makeRepo(), log)
}

describe('ContractUseCase — stripping de salary', () => {
  it('oculta salary en el listado para un rol no privilegiado (receptionist)', async () => {
    const rows = await makeUseCase().list('h1', undefined, { id: 'u1', role: 'receptionist', hotelId: 'h1' })
    expect(rows[0]).not.toHaveProperty('salary')
    expect(rows[0].position).toBe('Recepción') // el resto del contrato sigue visible
  })

  it('muestra salary en el listado para hotel_admin', async () => {
    const rows = await makeUseCase().list('h1', undefined, { id: 'u1', role: 'hotel_admin', hotelId: 'h1' })
    expect(rows[0].salary).toBe(45000)
  })

  it('oculta salary en getById para receptionist', async () => {
    const c = await makeUseCase().getById('c1', { id: 'u1', role: 'receptionist', hotelId: 'h1' })
    expect(c).not.toHaveProperty('salary')
  })

  it('muestra salary en getById para super_admin', async () => {
    const c = await makeUseCase().getById('c1', { id: 'u1', role: 'super_admin', hotelId: 'h1' })
    expect(c.salary).toBe(45000)
  })

  it('sin usuario (llamada interna) no strippea', async () => {
    const rows = await makeUseCase().list('h1')
    expect(rows[0].salary).toBe(45000)
  })
})
