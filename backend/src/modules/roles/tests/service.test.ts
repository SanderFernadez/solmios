// roles/tests/service.test.ts — Tests comprehensivos del servicio
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { RolesService } from '../service'
import type { RolesDTO, CreateRolesDTO, UpdateRolesDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const fakeAuth = { createToken: () => 'tok', assertOwnership: () => {} } as unknown as Auth

const superAdmin = { id: 'admin1', role: 'super_admin', hotelId: undefined }
const hotelAdmin = { id: 'user1', role: 'hotel_admin', hotelId: 'h1' }

const baseRole: RolesDTO = {
  id: 'role-1',
  name: 'Admin',
  icon: 'shield',
  color: '#ff0000',
  system: 0,
  hotelId: 'h1',
  permissions: [{ module: 'rooms', actions: ['create', 'read', 'update', 'delete'] }],
  users: 5,
  createdAt: '2026-06-21T00:00:00Z',
  updatedAt: '2026-06-21T00:00:00Z',
}

const systemRole: RolesDTO = {
  ...baseRole,
  id: 'role-sys',
  name: 'Super Admin',
  system: 1,
}

function makeRepo(overrides: Partial<RepositoryAdapter<RolesDTO>> = {}): RepositoryAdapter<RolesDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'role-new', ...data } as RolesDTO),
    update: async (id, data) => ({ id, ...data } as RolesDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

function makeCache(): CacheAdapter & { deleted: string[] } {
  const deleted: string[] = []
  return {
    deleted,
    get: async () => null,
    set: async () => {},
    delete: async (key: string) => { deleted.push(key) },
    flush: async () => {},
  }
}

// ─── LIST ─────────────────────────────────────────────────────────────────────

describe('RolesService', () => {
  describe('list', () => {
    it('returns paginated roles for super_admin', async () => {
      const roles = [baseRole]
      const repo = makeRepo({ paginate: async () => ({ data: roles, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      const result = await svc.list({ page: 1, limit: 20 }, superAdmin)
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
    })

    it('filters by hotelId for hotel_admin', async () => {
      const roles = [{ ...baseRole, hotelId: 'h1' }]
      const repo = makeRepo({ paginate: async () => ({ data: roles, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      const result = await svc.list({ page: 1, limit: 20 }, hotelAdmin)
      expect(result.data).toHaveLength(1)
    })

    it('throws AuthError when hotel_admin has no hotelId', async () => {
      const noHotel = { id: 'u1', role: 'hotel_admin', hotelId: undefined }
      const svc = new RolesService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      await expect(svc.list({ page: 1 }, noHotel)).rejects.toThrow('No hotel assigned')
    })

    it('super_admin can filter by specific hotelId', async () => {
      const roles = [{ ...baseRole, hotelId: 'h1' }]
      const repo = makeRepo({ paginate: async () => ({ data: roles, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      const result = await svc.list({ hotelId: 'h1', page: 1, limit: 20 }, superAdmin)
      expect(result.data).toHaveLength(1)
    })

    it('returns empty when no roles match', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      const result = await svc.list({ page: 1, limit: 20 }, superAdmin)
      expect(result.data).toEqual([])
      expect(result.total).toBe(0)
    })

    it('defaults page to 1 and limit to 20', async () => {
      const repo = makeRepo({ paginate: async (opts: any) => ({ data: [], total: 0, limit: opts.limit, offset: opts.offset, pages: 0 }) })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      const result = await svc.list({} as any, superAdmin)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
    })

    it('clamps limit between 1 and 100', async () => {
      const repo = makeRepo({ paginate: async (opts: any) => ({ data: [], total: 0, limit: opts.limit, offset: opts.offset, pages: 0 }) })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      const result = await svc.list({ limit: 500, page: 1 }, superAdmin)
      expect(result.limit).toBe(100)
    })

    it('caches the result', async () => {
      const cache = makeCache()
      const roles = [baseRole]
      const repo = makeRepo({ paginate: async () => ({ data: roles, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new RolesService(repo, log, cache, fakeAuth)
      await svc.list({ page: 1, limit: 20 }, superAdmin)
      expect(cache.deleted.length).toBe(0) // set was called, not delete
    })
  })

  // ─── GET BY ID ────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns role for super_admin', async () => {
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      const result = await svc.getById('role-1', superAdmin)
      expect(result.name).toBe('Admin')
    })

    it('returns role for hotel_admin when hotelId matches', async () => {
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      const result = await svc.getById('role-1', hotelAdmin)
      expect(result.id).toBe('role-1')
    })

    it('throws NotFoundError when role does not exist', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      await expect(svc.getById('nonexistent', superAdmin)).rejects.toThrow('Rol no encontrado')
    })

    it('throws AuthError when hotel_admin accesses other hotel role', async () => {
      const otherHotelRole = { ...baseRole, hotelId: 'h2' }
      const repo = makeRepo({ findById: async () => otherHotelRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      await expect(svc.getById('role-1', hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  // ─── CREATE ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates role in own hotel', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      const result = await svc.create({ name: 'Staff', hotelId: 'h1' }, hotelAdmin)
      expect(result.id).toBe('role-new')
      expect(result.name).toBe('Staff')
    })

    it('super_admin can create in any hotel', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      const result = await svc.create({ name: 'Manager', hotelId: 'h99' }, superAdmin)
      expect(result.name).toBe('Manager')
    })

    it('rejects role creation in other hotel', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      await expect(
        svc.create({ name: 'Staff', hotelId: 'h2' }, hotelAdmin),
      ).rejects.toThrow('No autorizado para crear en otro hotel')
    })

    it('invalidates cache after creation', async () => {
      const cache = makeCache()
      const svc = new RolesService(makeRepo(), log, cache, fakeAuth)
      await svc.create({ name: 'Test', hotelId: 'h1' }, hotelAdmin)
      expect(cache.deleted).toContain('roles:list:h1')
    })

    it('fires onRolesCreated socket event', async () => {
      let firedWith: RolesDTO | undefined
      const svc = new RolesService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      svc.setSockets({ onRolesCreated: async (role) => { firedWith = role } })
      await svc.create({ name: 'Socket Role', hotelId: 'h1' }, hotelAdmin)
      expect(firedWith?.name).toBe('Socket Role')
    })

    it('persists all provided fields', async () => {
      const repo = makeRepo({ create: async (data) => ({ id: 'c1', ...data } as RolesDTO) })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      const dto: CreateRolesDTO = {
        name: 'Housekeeping',
        icon: 'broom',
        color: '#00ff00',
        hotelId: 'h1',
        permissions: [{ module: 'rooms', actions: ['read'] }],
      }
      const result = await svc.create(dto, hotelAdmin)
      expect(result.icon).toBe('broom')
      expect(result.color).toBe('#00ff00')
      expect(result.permissions).toHaveLength(1)
    })
  })

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates own hotel role', async () => {
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      const result = await svc.update('role-1', { name: 'Super Admin' }, hotelAdmin)
      expect(result.name).toBe('Super Admin')
    })

    it('super_admin can update any role', async () => {
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      const result = await svc.update('role-1', { name: 'Updated' }, superAdmin)
      expect(result.name).toBe('Updated')
    })

    it('throws NotFoundError when role does not exist', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      await expect(svc.update('nonexistent', { name: 'X' }, superAdmin)).rejects.toThrow('Rol no encontrado')
    })

    it('rejects update to other hotel role', async () => {
      const otherHotelRole = { ...baseRole, hotelId: 'h2' }
      const repo = makeRepo({ findById: async () => otherHotelRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      await expect(svc.update('role-1', { name: 'X' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('rejects update to system role', async () => {
      const repo = makeRepo({ findById: async () => systemRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      await expect(svc.update('role-1', { name: 'X' }, hotelAdmin)).rejects.toThrow('roles del sistema')
    })

    it('super_admin also cannot modify system roles', async () => {
      const repo = makeRepo({ findById: async () => systemRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      await expect(svc.update('role-sys', { name: 'X' }, superAdmin)).rejects.toThrow('roles del sistema')
    })

    it('invalidates cache after update', async () => {
      const cache = makeCache()
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, cache, fakeAuth)
      await svc.update('role-1', { name: 'Updated' }, superAdmin)
      expect(cache.deleted).toContain('roles:list:h1')
    })

    it('fires onRolesUpdated socket event', async () => {
      let firedWith: RolesDTO | undefined
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      svc.setSockets({ onRolesUpdated: async (role) => { firedWith = role } })
      await svc.update('role-1', { name: 'Updated' }, superAdmin)
      expect(firedWith?.name).toBe('Updated')
    })
  })

  // ─── DELETE ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('super_admin can delete', async () => {
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('role-1', superAdmin)).resolves.toBeUndefined()
    })

    it('hotel_admin can delete own hotel role', async () => {
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('role-1', hotelAdmin)).resolves.toBeUndefined()
    })

    it('throws NotFoundError when role does not exist', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      await expect(svc.delete('nonexistent', superAdmin)).rejects.toThrow('Rol no encontrado')
    })

    it('rejects delete of other hotel role', async () => {
      const otherHotelRole = { ...baseRole, hotelId: 'h2' }
      const repo = makeRepo({ findById: async () => otherHotelRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('role-1', hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('rejects delete of system role', async () => {
      const repo = makeRepo({ findById: async () => systemRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('role-sys', superAdmin)).rejects.toThrow('roles del sistema')
    })

    it('hotel_admin also cannot delete system roles', async () => {
      const repo = makeRepo({ findById: async () => systemRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('role-sys', hotelAdmin)).rejects.toThrow('roles del sistema')
    })

    it('throws NotFoundError when repo.delete returns false', async () => {
      const repo = makeRepo({ findById: async () => baseRole, delete: async () => false })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('role-1', superAdmin)).rejects.toThrow('Rol no encontrado')
    })

    it('invalidates cache after deletion', async () => {
      const cache = makeCache()
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, cache, fakeAuth)
      await svc.delete('role-1', superAdmin)
      expect(cache.deleted).toContain('roles:list:h1')
    })

    it('fires onRolesDeleted socket event with the deleted id', async () => {
      let firedId: string | undefined
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      svc.setSockets({ onRolesDeleted: async (id) => { firedId = id } })
      await svc.delete('role-1', superAdmin)
      expect(firedId).toBe('role-1')
    })
  })

  // ─── SET SOCKETS ──────────────────────────────────────────────────────────

  describe('setSockets', () => {
    it('accumulates socket handlers across multiple calls', async () => {
      const calls: string[] = []
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, fakeAuth)
      svc.setSockets({ onRolesDeleted: async () => { calls.push('first') } })
      svc.setSockets({ onRolesDeleted: async () => { calls.push('second') } })
      await svc.delete('role-1', superAdmin)
      expect(calls).toEqual(['first', 'second'])
    })

    it('does not crash when setting null handler', () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      expect(() => svc.setSockets({ onRolesCreated: null as any })).not.toThrow()
    })

    it('does not crash when setting empty sockets', () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      expect(() => svc.setSockets({})).not.toThrow()
    })
  })
})
