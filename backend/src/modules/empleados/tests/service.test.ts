// empleados/tests/service.test.ts — Tests del servicio
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { EmpleadosService } from '../service'
import type { DepartmentDTO, EmployeeProfileDTO, ContractDTO, DocumentDTO, LeaveRequestDTO, PerformanceReviewDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

function makeRepo(overrides: Partial<RepositoryAdapter<any>> = {}): RepositoryAdapter<any> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data }),
    update: async (id, data) => ({ id, ...data }),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

/** Mock profileRepo that returns a valid profile for any employeeId/hotelId combo */
function makeProfileRepo(): RepositoryAdapter<any> {
  return makeRepo({
    findOne: async (filters: any) => {
      if (filters.userId && filters.hotelId) {
        return { id: 'p1', userId: filters.userId, hotelId: filters.hotelId, active: 1 }
      }
      return null
    },
  })
}

describe('EmpleadosService', () => {
  describe('createDepartment', () => {
    it('crea un departamento', async () => {
      const service = new EmpleadosService(makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const result = await service.createDepartment({ hotelId: 'h1', name: 'Recepción' })
      expect(result.id).toBe('test-id')
      expect(result.name).toBe('Recepción')
    })
  })

  describe('getDepartment', () => {
    it('lanza NotFound si no existe', async () => {
      const service = new EmpleadosService(makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      await expect(service.getDepartment('no-existe')).rejects.toThrow('Department not found')
    })
  })

  describe('createProfile', () => {
    it('crea un perfil de empleado', async () => {
      const service = new EmpleadosService(makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const result = await service.createProfile({ userId: 'u1', hotelId: 'h1', position: 'Recepcionista' })
      expect(result.id).toBe('test-id')
      expect(result.vacationDaysTotal).toBe(15)
    })
  })

  describe('createContract', () => {
    it('crea un contrato', async () => {
      const service = new EmpleadosService(makeRepo(), makeProfileRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const result = await service.createContract({ hotelId: 'h1', employeeId: 'e1', type: 'indefinido', startDate: '2026-01-01', salary: 1500 })
      expect(result.status).toBe('active')
    })

    it('rechaza salario negativo', async () => {
      const service = new EmpleadosService(makeRepo(), makeProfileRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      await expect(service.createContract({ hotelId: 'h1', employeeId: 'e1', type: 'indefinido', startDate: '2026-01-01', salary: -100 })).rejects.toThrow('Salary must be positive')
    })
  })

  describe('createLeaveRequest', () => {
    it('crea una solicitud de vacaciones', async () => {
      const service = new EmpleadosService(makeRepo(), makeProfileRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const result = await service.createLeaveRequest({ hotelId: 'h1', employeeId: 'e1', type: 'vacation', startDate: '2026-07-01', endDate: '2026-07-15', days: 15 })
      expect(result.status).toBe('pending')
      expect(result.days).toBe(15)
    })
  })

  describe('createReview', () => {
    it('crea una evaluación de desempeño', async () => {
      const service = new EmpleadosService(makeRepo(), makeProfileRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const result = await service.createReview({ hotelId: 'h1', employeeId: 'e1', reviewerId: 'r1', reviewDate: '2026-06-01', score: 8 })
      expect(result.status).toBe('draft')
      expect(result.score).toBe(8)
    })
  })
})
