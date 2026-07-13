// route-permission-helpers.ts — SC-03 (issue #212)
//
// Helper compartido para probar, a nivel de RUTA REAL (router.resolve), que cada módulo exige el
// module:action correcto. Monta el módulo de verdad (mod.create({...})) sobre un Router real y un
// HotelAuth real, con un ORM fake genérico (findMany/findById/findOne/create/update/delete/count/
// transaction devolviendo datos vacíos) — suficiente para que el guard (auth.authenticate +
// loadPermissions + requirePermission) se ejecute de punta a punta sin necesitar una DB real.
//
// loadPermissions() cae a getRolePermissions(role) del REAL src/shared/permissions.ts cuando el
// roleRepo fake no encuentra una fila custom — así el test valida contra el mapa de permisos posta,
// no una copia hardcodeada que se desincroniza.
//
// No cubre necesariamente un 200 "de negocio" limpio (el ORM fake devuelve vacíos, así que un POST
// puede fallar validación más adelante) — lo que se afirma es que el guard NO cortó con 403.

import { Router } from 'arckode-framework'
import { HotelAuth } from '../hotel-auth'

/** Logger no-op recursivo (child() devuelve otro logger no-op). */
export function fakeLogger(): any {
  const logger: any = {
    info() {}, warn() {}, error() {}, debug() {},
  }
  logger.child = () => fakeLogger()
  return logger
}

/**
 * ORM fake genérico: cubre todo lo que llaman los módulos del inventario (OrmRepository +
 * las clases *Queries/*UseCase) — findMany/findById/findOne/create/update/delete/count/paginate/
 * transaction/define. Devuelve colecciones vacías y `null` en los lookups puntuales, así que
 * cualquier ruta llega al handler sin reventar por falta de datos.
 */
export function fakeOrm(customRoles: Record<string, string[]> = {}): any {
  const orm: any = {
    define() { return orm },
    findMany: async (table: string, filters?: any) => {
      // Roles sintéticos con permisos exactos, para probar casos puntuales
      // ("tiene create pero no edit") sin depender de que un rol real del mapa
      // por defecto tenga ese hueco.
      if (table === 'Roles' && filters?.name && customRoles[filters.name]) {
        return [{ name: filters.name, permissions: customRoles[filters.name] }]
      }
      return []
    },
    findById: async () => null,
    findOne: async () => null,
    create: async (_table: string, data: any) => ({ id: 'fake-id', ...data }),
    update: async (_table: string, id: string, data: any) => ({ id, ...data }),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, page: 1, limit: 20 }),
    transaction: async (fn: any) => fn(orm),
  }
  return orm
}

/** JwtAdapter de juguete: sign/verify simétricos (JSON.stringify/parse), sin criptografía real.
 *  Alcanza para probar el guard: lo que importa es que el payload (role/hotelId) viaje intacto. */
const toyJwt = {
  sign: (payload: Record<string, unknown>) => JSON.stringify(payload),
  verify: (token: string) => JSON.parse(token),
}

/** HotelAuth real (mismo que corre en producción) con el jwt de juguete de arriba. */
export function makeAuth(): HotelAuth {
  return new HotelAuth(toyJwt as any, 'test-secret', fakeLogger())
}

export function tokenFor(auth: HotelAuth, role: string, hotelId = 'hotel-a'): string {
  return auth.createToken({ id: `user-${role}`, role, hotelId, userType: 'merchant' })
}

export function bearer(auth: HotelAuth, role: string, hotelId = 'hotel-a'): Record<string, string> {
  return { authorization: `Bearer ${tokenFor(auth, role, hotelId)}` }
}

/** Rol sintético garantizado sin ningún permiso (no existe en DEFAULT_ROLE_PERMISSIONS). */
export const NO_PERMS_ROLE = 'sc03_sin_permisos'

/**
 * Monta un módulo real (el factory que exporta cada modules/X/index.ts) sobre un Router real,
 * usando el ORM/logger/auth fakes de arriba. Devuelve el router para hacer router.resolve(...).
 *
 * @param moduleOpts   Segundo argumento que recibe el factory (ej. `{ storage }` en housekeeping).
 * @param customRoles  Roles sintéticos con permisos exactos (ver fakeOrm).
 */
export function mountModule(
  moduleFactory: (opts?: any) => any,
  moduleOpts?: any,
  customRoles: Record<string, string[]> = {},
): { router: Router; auth: HotelAuth; service: any } {
  const router = new Router()
  const auth = makeAuth()
  const orm = fakeOrm(customRoles)
  const cache = { get: async () => null, set: async () => {}, delete: async () => {} }
  const logger = fakeLogger()

  const mod = moduleFactory(moduleOpts) as any
  const service = mod.create({ logger, orm, cache, router, auth })

  return { router, auth, service }
}
