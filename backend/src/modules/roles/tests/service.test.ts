// roles/tests/service.test.ts — Tests comprehensivos del servicio
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { RolesService } from '../service'
import type { RolesDTO, CreateRolesDTO, UpdateRolesDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const mockAuth = { assertOwnership: () => {} } as unknown as Auth
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
  permissions: ['rooms:view', 'rooms:create', 'rooms:edit', 'rooms:delete'],
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

function makeUserRepo(users: Array<{ role?: string }> = []) {
  return {
    findById: async () => ({ id: 'user-1', hotelId: 'hotel-1', role: 'hotel_admin' }),
    findMany: async () => users,
  } as unknown as RepositoryAdapter<any>
}

const mockUser = { id: 'user-1', hotelId: 'hotel-1', role: 'hotel_admin' }

describe('RolesService', () => {
  describe('list', () => {
    it('returns paginated roles for super_admin', async () => {
      const roles = [baseRole]
      const repo = makeRepo({ paginate: async () => ({ data: roles, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({ page: 1, limit: 20 }, superAdmin)
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
    })

    it('filters by hotelId for hotel_admin', async () => {
      const roles = [{ ...baseRole, hotelId: 'h1' }]
      const repo = makeRepo({ paginate: async () => ({ data: roles, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({ page: 1, limit: 20 }, hotelAdmin)
      expect(result.data).toHaveLength(1)
    })

    it('cuenta usuarios reales por rol (nombre de rol → usuarios del hotel)', async () => {
      const roles = [{ ...baseRole, name: 'Cajero', hotelId: 'h1' }]
      const repo = makeRepo({ paginate: async () => ({ data: roles, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const usersOfHotel = [{ role: 'Cajero' }, { role: 'Cajero' }, { role: 'receptionist' }]
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(usersOfHotel), fakeAuth)
      const result = await svc.list({ page: 1, limit: 20 }, hotelAdmin)
      expect(result.data[0].users).toBe(2)
    })

    it('throws AuthError when hotel_admin has no hotelId', async () => {
      const noHotel = { id: 'u1', role: 'hotel_admin', hotelId: undefined }
      // noHotel + userRepo returns {} (no hotelId) → service throws 'No hotel assigned'
      const userRepo = { findById: async () => ({}) } as unknown as RepositoryAdapter<any>
      const svc = new RolesService(makeRepo(), log, silentCache, userRepo, fakeAuth)
      await expect(svc.list({ page: 1 }, noHotel)).rejects.toThrow('No hotel assigned')
    })

    it('super_admin can filter by specific hotelId', async () => {
      const roles = [{ ...baseRole, hotelId: 'h1' }]
      const repo = makeRepo({ paginate: async () => ({ data: roles, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({ hotelId: 'h1', page: 1, limit: 20 }, superAdmin)
      expect(result.data).toHaveLength(1)
    })

    it('returns empty when no roles match', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({ page: 1, limit: 20 }, superAdmin)
      expect(result.data).toEqual([])
      expect(result.total).toBe(0)
    })

    it('defaults page to 1 and limit to 20', async () => {
      const repo = makeRepo({ paginate: async (opts: any) => ({ data: [], total: 0, limit: opts.limit, offset: opts.offset, pages: 0 }) })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({} as any, superAdmin)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
    })

    it('clamps limit between 1 and 100', async () => {
      const repo = makeRepo({ paginate: async (opts: any) => ({ data: [], total: 0, limit: opts.limit, offset: opts.offset, pages: 0 }) })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({ limit: 500, page: 1 }, superAdmin)
      expect(result.limit).toBe(100)
    })

    it('caches the result', async () => {
      const cache = makeCache()
      const roles = [baseRole]
      const repo = makeRepo({ paginate: async () => ({ data: roles, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new RolesService(repo, log, cache, makeUserRepo(), fakeAuth)
      await svc.list({ page: 1, limit: 20 }, superAdmin)
      expect(cache.deleted.length).toBe(0) // set was called, not delete
    })
  })

  // ─── GET BY ID ────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns role for super_admin', async () => {
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.getById('role-1', superAdmin)
      expect(result.name).toBe('Admin')
    })

    it('returns role for hotel_admin when hotelId matches', async () => {
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.getById('role-1', hotelAdmin)
      expect(result.id).toBe('role-1')
    })

    it('throws NotFoundError when role does not exist', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.getById('nonexistent', superAdmin)).rejects.toThrow('Rol no encontrado')
    })

    it('throws AuthError when hotel_admin accesses other hotel role', async () => {
      const otherHotelRole = { ...baseRole, hotelId: 'h2' }
      const repo = makeRepo({ findById: async () => otherHotelRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.getById('role-1', hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  // ─── CREATE ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates role in own hotel', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.create({ name: 'Staff', hotelId: 'h1' }, hotelAdmin)
      expect(result.id).toBeTruthy()   // el server genera el id (UUID)
      expect(result.name).toBe('Staff')
    })

    it('forces system:0 — un merchant no puede crear un rol del sistema', async () => {
      let created: any
      const repo = makeRepo({ create: async (data) => { created = data; return { id: 'x', ...data } as RolesDTO } })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await svc.create({ name: 'Cajero', hotelId: 'h1', system: 1 } as any, hotelAdmin)
      expect(created.system).toBe(0)
    })

    it('defaults permissions to [] when none provided', async () => {
      let created: any
      const repo = makeRepo({ create: async (data) => { created = data; return { id: 'x', ...data } as RolesDTO } })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await svc.create({ name: 'Cajero', hotelId: 'h1' }, hotelAdmin)
      expect(created.permissions).toEqual([])
    })

    it('super_admin can create in any hotel', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.create({ name: 'Manager', hotelId: 'h99' }, superAdmin)
      expect(result.name).toBe('Manager')
    })

    it('rejects role creation in other hotel', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(
        svc.create({ name: 'Staff', hotelId: 'h2' }, hotelAdmin),
      ).rejects.toThrow('No autorizado para crear en otro hotel')
    })

    it('invalidates cache after creation', async () => {
      const cache = makeCache()
      const svc = new RolesService(makeRepo(), log, cache, makeUserRepo(), fakeAuth)
      await svc.create({ name: 'Test', hotelId: 'h1' }, hotelAdmin)
      expect(cache.deleted).toContain('roles:list:h1')
    })

    it('fires onRolesCreated socket event', async () => {
      let firedWith: RolesDTO | undefined
      const svc = new RolesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      svc.setSockets({ onRolesCreated: async (role) => { firedWith = role } })
      await svc.create({ name: 'Socket Role', hotelId: 'h1' }, hotelAdmin)
      expect(firedWith?.name).toBe('Socket Role')
    })

    it('persists all provided fields', async () => {
      const repo = makeRepo({ create: async (data) => ({ id: 'c1', ...data } as RolesDTO) })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const dto: CreateRolesDTO = {
        name: 'Housekeeping',
        icon: 'broom',
        color: '#00ff00',
        hotelId: 'h1',
        permissions: ['rooms:view'],
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
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.update('role-1', { name: 'Super Admin' }, hotelAdmin)
      expect(result.name).toBe('Super Admin')
    })

    it('super_admin can update any role', async () => {
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.update('role-1', { name: 'Updated' }, superAdmin)
      expect(result.name).toBe('Updated')
    })

    it('throws NotFoundError when role does not exist', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.update('nonexistent', { name: 'X' }, superAdmin)).rejects.toThrow('Rol no encontrado')
    })

    it('rejects update to other hotel role', async () => {
      const otherHotelRole = { ...baseRole, hotelId: 'h2' }
      const repo = makeRepo({ findById: async () => otherHotelRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.update('role-1', { name: 'X' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })

     it('rejects update to system role fields (name/icon/color)', async () => {
      const repo = makeRepo({ findById: async () => systemRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.update('role-1', { name: 'X' }, hotelAdmin)).rejects.toThrow('campos del sistema')
    })

    it('allows update to system role permissions', async () => {
      const repo = makeRepo({ findById: async () => systemRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.update('role-1', { permissions: ['test:view'] as any }, hotelAdmin)).resolves.toBeDefined()
    })

    it('super_admin also cannot modify system role fields', async () => {
      const repo = makeRepo({ findById: async () => systemRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.update('role-sys', { name: 'X' }, superAdmin)).rejects.toThrow('campos del sistema')
    })

    it('invalidates cache after update', async () => {
      const cache = makeCache()
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, cache, makeUserRepo(), fakeAuth)
      await svc.update('role-1', { name: 'Updated' }, superAdmin)
      expect(cache.deleted).toContain('roles:list:h1')
    })

    it('fires onRolesUpdated socket event', async () => {
      let firedWith: RolesDTO | undefined
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      svc.setSockets({ onRolesUpdated: async (role) => { firedWith = role } })
      await svc.update('role-1', { name: 'Updated' }, superAdmin)
      expect(firedWith?.name).toBe('Updated')
    })
  })

  // ─── RESTORE ──────────────────────────────────────────────────────────────

  describe('restore', () => {
    const receptionistRole: RolesDTO = {
      ...baseRole,
      id: 'role-recep',
      name: 'receptionist',
      system: 1,
      permissions: ['rooms:view'], // personalizado (no es el default de fábrica)
    }

    it('restaura un rol del sistema a DEFAULT_ROLE_PERMISSIONS y sella el hash', async () => {
      let updated: any
      const repo = makeRepo({
        findById: async () => receptionistRole,
        update: async (id, data) => { updated = { id, ...data }; return updated as RolesDTO },
      })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.restore('role-recep', hotelAdmin)
      // Los defaults de receptionist incluyen checkin/checkout — justamente lo que se perdía al editar.
      expect(updated.permissions).toEqual(expect.arrayContaining(['reservations:checkin', 'reservations:checkout']))
      expect(updated.defaultsHash).toBeTruthy()
      expect(result.permissions).toEqual(updated.permissions)
    })

    it('rechaza restaurar un rol personalizado (no tiene original)', async () => {
      const repo = makeRepo({ findById: async () => baseRole }) // system: 0
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.restore('role-1', hotelAdmin)).rejects.toThrow('Solo los roles del sistema')
    })

    it('rechaza restaurar el rol de otro hotel', async () => {
      const other = { ...receptionistRole, hotelId: 'h2' }
      const repo = makeRepo({ findById: async () => other })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.restore('role-recep', hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('NotFoundError si el rol no existe', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.restore('nope', hotelAdmin)).rejects.toThrow('Rol no encontrado')
    })

    it('invalida la caché tras restaurar', async () => {
      const cache = makeCache()
      const repo = makeRepo({ findById: async () => receptionistRole })
      const svc = new RolesService(repo, log, cache, makeUserRepo(), fakeAuth)
      await svc.restore('role-recep', hotelAdmin)
      expect(cache.deleted).toContain('roles:list:h1')
    })

    it('dispara onRolesUpdated', async () => {
      let fired: RolesDTO | undefined
      // El repo real devuelve la entidad completa tras un PATCH; el mock por defecto solo spreadea
      // `data` ({permissions, defaultsHash}, sin name) → mergemos con el rol existente como hace el ORM.
      const repo = makeRepo({
        findById: async () => receptionistRole,
        update: async (id, data) => ({ ...receptionistRole, ...data } as RolesDTO),
      })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      svc.setSockets({ onRolesUpdated: async (r) => { fired = r } })
      await svc.restore('role-recep', hotelAdmin)
      expect(fired?.name).toBe('receptionist')
    })
  })

  // ─── DELETE ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('super_admin can delete', async () => {
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('role-1', superAdmin)).resolves.toBeUndefined()
    })

    it('hotel_admin can delete own hotel role', async () => {
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('role-1', hotelAdmin)).resolves.toBeUndefined()
    })

    it('throws NotFoundError when role does not exist', async () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('nonexistent', superAdmin)).rejects.toThrow('Rol no encontrado')
    })

    it('rejects delete of other hotel role', async () => {
      const otherHotelRole = { ...baseRole, hotelId: 'h2' }
      const repo = makeRepo({ findById: async () => otherHotelRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('role-1', hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('rejects delete of system role', async () => {
      const repo = makeRepo({ findById: async () => systemRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('role-sys', superAdmin)).rejects.toThrow('roles del sistema')
    })

    it('hotel_admin also cannot delete system roles', async () => {
      const repo = makeRepo({ findById: async () => systemRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('role-sys', hotelAdmin)).rejects.toThrow('roles del sistema')
    })

    it('throws NotFoundError when repo.delete returns false', async () => {
      const repo = makeRepo({ findById: async () => baseRole, delete: async () => false })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('role-1', superAdmin)).rejects.toThrow('Rol no encontrado')
    })

    it('invalidates cache after deletion', async () => {
      const cache = makeCache()
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, cache, makeUserRepo(), fakeAuth)
      await svc.delete('role-1', superAdmin)
      expect(cache.deleted).toContain('roles:list:h1')
    })

    it('fires onRolesDeleted socket event with the deleted id', async () => {
      let firedId: string | undefined
      const repo = makeRepo({ findById: async () => baseRole })
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
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
      const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      svc.setSockets({ onRolesDeleted: async () => { calls.push('first') } })
      svc.setSockets({ onRolesDeleted: async () => { calls.push('second') } })
      await svc.delete('role-1', superAdmin)
      expect(calls).toEqual(['first', 'second'])
    })

    it('does not crash when setting null handler', () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      expect(() => svc.setSockets({ onRolesCreated: null as any })).not.toThrow()
    })

    it('does not crash when setting empty sockets', () => {
      const svc = new RolesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      expect(() => svc.setSockets({})).not.toThrow()
    })
  })
})

// SC-05 — los cambios de roles/permisos dejan rastro en el audit log.
describe('RolesService — auditlog (SC-05)', () => {
  it('registra role.delete al borrar un rol', async () => {
    const repo = makeRepo({ findById: async () => baseRole, delete: async () => true })
    const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
    const recorded: any[] = []
    svc.setAuditDeps({ record: async (e) => { recorded.push(e) } })
    await svc.delete('role-1', hotelAdmin)
    expect(recorded).toHaveLength(1)
    expect(recorded[0].action).toBe('role.delete')
    expect(recorded[0].entityId).toBe('role-1')
  })

  it('un fallo del audit NO tumba la operación', async () => {
    const repo = makeRepo({ findById: async () => baseRole, delete: async () => true })
    const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
    svc.setAuditDeps({ record: async () => { throw new Error('audit caído') } })
    await expect(svc.delete('role-1', hotelAdmin)).resolves.toBeUndefined()
  })

  it('registra role.restore al restaurar un rol del sistema', async () => {
    const repo = makeRepo({ findById: async () => ({ ...baseRole, id: 'r-r', name: 'receptionist', system: 1 }) })
    const svc = new RolesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
    const recorded: any[] = []
    svc.setAuditDeps({ record: async (e) => { recorded.push(e) } })
    await svc.restore('r-r', hotelAdmin)
    expect(recorded).toHaveLength(1)
    expect(recorded[0].action).toBe('role.restore')
  })
})
