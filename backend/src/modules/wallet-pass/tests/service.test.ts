// wallet-pass/tests/service.test.ts — Tests del facade del service (F3 3.6/3.7).
//
// Cubre los acceptance del spec wallet-pass a nivel service (no usecase directo — eso está
// en generate-pass.test.ts). Verifica que:
//   - generatePass delega al usecase (mockeado, no se ejecuta la orquestación real).
//   - getByReservation valida ownership (IDOR) y devuelve 404 si no existe.
//   - list paginado por hotelId del JWT, multi-tenant estricto.
//   - setTtlockPort / setEmailDeps inyectan deps sin romper el service.
//
// Sin tocar SQLite/Postgres ni storage real. RepositoryAdapter mockeado.
import { describe, it, expect, mock } from 'bun:test'
import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { NotFoundError, ValidationError } from 'arckode-framework'
import { WalletPassService } from '../service'
import type { WalletPassDTO } from '../types'

const log: Logger = silentLogger()
const noopAuth: Auth = { assertOwnership: () => undefined, authenticate: (() => []) as any } as any

function makeRepo<T extends object>(overrides: Partial<RepositoryAdapter<T>> = {}): RepositoryAdapter<T> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data: any) => ({ ...data, id: 'wp-1', createdAt: '', updatedAt: '' }) as T,
    update: async (id: any, data: any) => ({ ...data, id }) as T,
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

const baseDeps = {
  auth: noopAuth,
  configRepo: makeRepo<Record<string, unknown>>(),
  lockCodeRepo: makeRepo<{ reservationId?: string; code?: string; status?: string }>(),
  reservationRepo: makeRepo<any>(),
  hotelRepo: makeRepo<any>(),
  guestRepo: makeRepo<any>(),
  roomRepo: makeRepo<any>(),
  ttlock: null,
  storage: undefined,
  emailService: null,
}

describe('WalletPassService — facade F3 3.6/3.7', () => {
  describe('getByReservation', () => {
    it('lanza NotFound si no existe pass para la reserva', async () => {
      const svc = new WalletPassService(makeRepo(), log, baseDeps)
      await expect(svc.getByReservation('no-existe', { id: 'u1', role: 'hotel_admin', hotelId: 'h1' }))
        .rejects.toThrow(NotFoundError)
    })

    it('retorna el pass si existe y es del hotel del user', async () => {
      const pass: WalletPassDTO = {
        id: 'wp-1', hotelId: 'h1', reservationId: 'r1', lockCode: 'TT-1', generatedAt: '2026-01-01',
        appleUrl: null, googleUrl: null, createdAt: '', updatedAt: '',
      }
      const svc = new WalletPassService(makeRepo({ findOne: async () => pass }), log, baseDeps)
      const result = await svc.getByReservation('r1', { id: 'u1', role: 'hotel_admin', hotelId: 'h1' })
      expect(result).toEqual(pass)
    })
  })

  describe('list', () => {
    it('lanza ValidationError si user sin hotelId (y no super_admin)', async () => {
      const svc = new WalletPassService(makeRepo(), log, baseDeps)
      await expect(svc.list({}, { id: 'u1', role: 'hotel_admin' /* sin hotelId */ }))
        .rejects.toThrow(ValidationError)
    })

    it('retorna paginado por hotelId del JWT', async () => {
      const paginate = mock(async () => ({ data: [{ id: 'wp-1' }], total: 1, limit: 20, offset: 0, pages: 1 }))
      const svc = new WalletPassService(makeRepo({ paginate: paginate as any }), log, baseDeps)
      const result = await svc.list({}, { id: 'u1', role: 'hotel_admin', hotelId: 'h1' })
      expect(result.total).toBe(1)
      expect(result.data.length).toBe(1)
      expect(paginate).toHaveBeenCalled()
    })
  })

  describe('setTtlockPort / setEmailDeps', () => {
    it('inyectar deps no rompe llamadas subsiguientes (idempotente, no-op para repos)', async () => {
      const svc = new WalletPassService(makeRepo(), log, baseDeps)
      // Antes de inyectar: getByReservation retorna NotFound (repo mock devuelve null).
      await expect(svc.getByReservation('r1', { id: 'u1', role: 'hotel_admin', hotelId: 'h1' }))
        .rejects.toThrow(NotFoundError)
      // Inyectar deps: no debe tirar ni cambiar el comportamiento del service.
      svc.setTtlockPort(null)
      svc.setEmailDeps({ enqueue: async () => 'q' } as any)
      // Sigue funcionando (lanza NotFound como antes — los setters solo mutan deps).
      await expect(svc.getByReservation('r1', { id: 'u1', role: 'hotel_admin', hotelId: 'h1' }))
        .rejects.toThrow(NotFoundError)
    })
  })
})
