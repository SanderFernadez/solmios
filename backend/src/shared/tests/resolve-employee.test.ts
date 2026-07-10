// shared/tests/resolve-employee.test.ts — A quién se le imputa un fichaje.
//
// Regresión 1: el controller leía `req.userId`, que no existe. Sin `employeeId` en el body creaba
// registros con el campo vacío — basura en el reporte de asistencia.
//
// Regresión 2: aceptaba cualquier `employeeId` del body. Cuando todo el personal ganó permiso para
// fichar, eso significó que una camarera podía fichar por otra.

import { describe, it, expect } from 'bun:test'
import { resolveAttendanceTarget, resolveOwnEmployeeId, type EmployeeProfileFinder } from '../usecases/resolve-employee'

const profiles = (rows: Array<{ id: string; userId: string; hotelId?: string }>): EmployeeProfileFinder => ({
  findMany: async (f: any) => rows.filter((r) => Object.entries(f).every(([k, v]) => (r as any)[k] === v)) as any,
})

const rosa = { id: 'emp-rosa', userId: 'u-rosa', hotelId: 'h1' }
const luis = { id: 'emp-luis', userId: 'u-luis', hotelId: 'h1' }
const actor = { id: 'u-rosa', hotelId: 'h1', permissions: ['attendance:create'] }
const jefe = { id: 'u-rosa', hotelId: 'h1', permissions: ['attendance:create', 'attendance:edit'] }

describe('resolveOwnEmployeeId', () => {
  it('encuentra el perfil del usuario del token', async () => {
    expect(await resolveOwnEmployeeId(profiles([rosa, luis]), actor)).toBe('emp-rosa')
  })

  it('no cruza hoteles', async () => {
    expect(await resolveOwnEmployeeId(profiles([rosa]), { id: 'u-rosa', hotelId: 'h2' })).toBeNull()
  })

  it('un usuario sin perfil de empleado devuelve null', async () => {
    expect(await resolveOwnEmployeeId(profiles([luis]), actor)).toBeNull()
  })
})

describe('resolveAttendanceTarget', () => {
  it('sin employeeId ficha por uno mismo', async () => {
    expect(await resolveAttendanceTarget(profiles([rosa]), actor, undefined, false)).toBe('emp-rosa')
  })

  it('pasar el propio employeeId es lo mismo', async () => {
    expect(await resolveAttendanceTarget(profiles([rosa]), actor, 'emp-rosa', false)).toBe('emp-rosa')
  })

  // La camarera no ficha por la otra.
  it('fichar por otro sin attendance:edit se rechaza', async () => {
    await expect(resolveAttendanceTarget(profiles([rosa, luis]), actor, 'emp-luis', false))
      .rejects.toThrow('Solo podés fichar por vos mismo')
  })

  it('la supervisión sí puede fichar por otro', async () => {
    expect(await resolveAttendanceTarget(profiles([rosa, luis]), jefe, 'emp-luis', true)).toBe('emp-luis')
  })

  // Antes esto escribía un registro con employeeId vacío.
  it('un usuario sin perfil de empleado no puede fichar', async () => {
    await expect(resolveAttendanceTarget(profiles([]), actor, undefined, false))
      .rejects.toThrow('no tiene un perfil de empleado')
  })

  it('un usuario sin id en el token tampoco', async () => {
    await expect(resolveAttendanceTarget(profiles([rosa]), {}, undefined, false))
      .rejects.toThrow('no tiene un perfil de empleado')
  })

  // El supervisor sin perfil propio igual puede corregir el fichaje de otro.
  it('la supervisión sin perfil propio puede fichar por un empleado', async () => {
    expect(await resolveAttendanceTarget(profiles([luis]), jefe, 'emp-luis', true)).toBe('emp-luis')
  })
})
