import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { resolveUserPermissions } from '../usecases/resolve-permissions'

// Repo falso que devuelve la fila de rol que le pasemos (o nada).
function roleRepo(rows: any[]): RepositoryAdapter<any> {
  return { findMany: async () => rows } as unknown as RepositoryAdapter<any>
}

describe('resolveUserPermissions', () => {
  it('super_admin: comodín total *:*', async () => {
    expect(await resolveUserPermissions(roleRepo([]), 'super_admin', 'h1')).toEqual(['*:*'])
  })

  it('rol CUSTOM con permisos en la tabla: los devuelve tal cual', async () => {
    const perms = ['billing:view', 'reservations:view']
    const out = await resolveUserPermissions(roleRepo([{ name: 'nocturno', permissions: perms }]), 'nocturno', 'h1')
    expect(out.sort()).toEqual([...perms].sort())
  })

  it('rol de sistema sin fila en la tabla: cae a los defaults del rol', async () => {
    // receptionist tiene defaults conocidos (incluye reservations:view, NO payroll).
    const out = await resolveUserPermissions(roleRepo([]), 'receptionist', 'h1')
    expect(out).toContain('reservations:view')
    expect(out).not.toContain('payroll:view')
  })

  it('sin roleRepo ni hotelId: usa defaults del rol (nunca rompe)', async () => {
    const out = await resolveUserPermissions(undefined, 'housekeeper', null)
    expect(Array.isArray(out)).toBe(true)
    expect(out).toContain('housekeeping:view')
  })

  it('rol custom desconocido sin fila: array vacío (falla cerrado, no abre)', async () => {
    const out = await resolveUserPermissions(roleRepo([]), 'inexistente', 'h1')
    expect(out).toEqual([])
  })
})
