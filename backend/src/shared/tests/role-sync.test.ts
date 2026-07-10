// shared/tests/role-sync.test.ts — Qué roles se refrescan y cuáles no se tocan.
//
// Regresión: los permisos de la tabla `roles` pisan el mapa estático, y el seeder nunca refresca.
// Cambiar `permissions.ts` no llegaba a producción. Refrescar a ciegas, en cambio, borraba las
// personalizaciones reales (en prod había un `receptionist` con 2 permisos en vez de 15).

import { describe, it, expect } from 'bun:test'
import { planRoleSync, permissionsHash, WRITES, type RoleRow } from '../usecases/role-sync'

const DEFAULTS = {
  hotel_admin: ['billing:view', 'billing:delete'],
  receptionist: ['reservations:view'],
}

const role = (over: Partial<RoleRow> = {}): RoleRow => ({
  id: 'r1', name: 'hotel_admin', system: 1, hotelId: 'h1',
  permissions: ['billing:view', 'billing:delete'],
  ...over,
})

const plan = (r: RoleRow) => planRoleSync([r], DEFAULTS)[0]

describe('permissionsHash', () => {
  it('no depende del orden', () => {
    expect(permissionsHash(['a:1', 'b:2'])).toBe(permissionsHash(['b:2', 'a:1']))
  })

  it('cambia si cambia el conjunto', () => {
    expect(permissionsHash(['a:1'])).not.toBe(permissionsHash(['a:1', 'b:2']))
  })
})

describe('planRoleSync — no toca lo que no debe', () => {
  it('un rol creado por el hotel se ignora', () => {
    expect(plan(role({ system: 0 })).action).toBe('skip-unknown')
  })

  it('un rol que no existe en el mapa se ignora', () => {
    expect(plan(role({ name: 'gerente' })).action).toBe('skip-unknown')
  })

  // El caso de producción: un receptionist con 2 permisos en vez de 15.
  it('una fila vieja con permisos distintos se marca para revisión, no se pisa', () => {
    const p = plan(role({ permissions: ['billing:view'], defaultsHash: null }))
    expect(p.action).toBe('review')
    expect(p.nextPermissions).toBeUndefined()
  })

  it('un rol personalizado después del último sync no se pisa', () => {
    const p = plan(role({
      permissions: ['billing:view'],
      // La huella es de otro conjunto: alguien editó los permisos desde entonces.
      defaultsHash: permissionsHash(['billing:view', 'billing:delete']),
    }))
    expect(p.action).toBe('skip-custom')
  })
})

describe('planRoleSync — refresca lo que sí debe', () => {
  it('un rol intacto desde el último sync se actualiza al default nuevo', () => {
    const viejo = ['billing:view']
    const p = plan(role({ permissions: viejo, defaultsHash: permissionsHash(viejo) }))

    expect(p.action).toBe('update')
    expect(p.nextPermissions).toEqual(DEFAULTS.hotel_admin)
    expect(p.nextHash).toBe(permissionsHash(DEFAULTS.hotel_admin))
  })

  it('una fila vieja que ya es el default actual solo recibe la huella', () => {
    const p = plan(role({ defaultsHash: null }))

    expect(p.action).toBe('stamp')
    expect(p.nextPermissions).toEqual(DEFAULTS.hotel_admin)
  })

  it('una fila ya sincronizada no se vuelve a escribir', () => {
    const p = plan(role({ defaultsHash: permissionsHash(DEFAULTS.hotel_admin) }))

    expect(p.action).toBe('up-to-date')
    expect(WRITES.has(p.action)).toBe(false)
  })

  it('el orden de los permisos guardados no dispara una escritura', () => {
    const p = plan(role({
      permissions: ['billing:delete', 'billing:view'],
      defaultsHash: permissionsHash(DEFAULTS.hotel_admin),
    }))
    expect(p.action).toBe('up-to-date')
  })
})

describe('planRoleSync — --adopt', () => {
  const adopt = (r: RoleRow, ids: string[]) => planRoleSync([r], DEFAULTS, { adopt: new Set(ids) })[0]

  it('adopta una fila vieja sin huella cuando se la nombra', () => {
    const p = adopt(role({ id: 'r1', permissions: ['billing:view'], defaultsHash: null }), ['r1'])

    expect(p.action).toBe('adopt')
    expect(p.nextPermissions).toEqual(DEFAULTS.hotel_admin)
    expect(p.nextHash).toBe(permissionsHash(DEFAULTS.hotel_admin))
  })

  it('no adopta la que no se nombró', () => {
    const p = adopt(role({ id: 'r1', permissions: ['billing:view'], defaultsHash: null }), ['otro'])
    expect(p.action).toBe('review')
  })

  // Una fila CON huella que ya no matchea fue editada a conciencia. Adoptarla sería pisar esa
  // decisión, así que `--adopt` no la alcanza.
  it('NO adopta un rol personalizado, aunque se lo nombre', () => {
    const p = adopt(role({ id: 'r1', permissions: ['billing:view'], defaultsHash: 'huella-vieja' }), ['r1'])
    expect(p.action).toBe('skip-custom')
  })

  it('adoptar es idempotente: al segundo pase ya está al día', () => {
    const p = adopt(role({ id: 'r1', permissions: ['billing:view'], defaultsHash: null }), ['r1'])
    const aplicado = { ...p.role, permissions: p.nextPermissions!, defaultsHash: p.nextHash! }

    expect(adopt(aplicado, ['r1']).action).toBe('up-to-date')
  })
})

describe('planRoleSync — el sync es convergente', () => {
  it('tras aplicar el plan, un segundo sync no escribe nada', () => {
    const rows: RoleRow[] = [
      role({ id: 'a', permissions: ['billing:view'], defaultsHash: permissionsHash(['billing:view']) }),
      role({ id: 'b', name: 'receptionist', permissions: DEFAULTS.receptionist, defaultsHash: null }),
    ]

    const aplicado = planRoleSync(rows, DEFAULTS).map((p) =>
      WRITES.has(p.action) ? { ...p.role, permissions: p.nextPermissions!, defaultsHash: p.nextHash! } : p.role,
    )

    expect(planRoleSync(aplicado, DEFAULTS).every((p) => !WRITES.has(p.action))).toBe(true)
  })
})
