// empleados/tests/profiles-enrichment.test.ts — El listado de perfiles muestra el NOMBRE, no el userId.
//
// Regresión: se enriquecía con `userRepo.findMany({ id: [array] })`, pero el ORM no hace WHERE IN
// (bindea el array como un valor, falla), y el nombre caía al userId → la tabla mostraba el UUID.
// El fix trae los usuarios del hotel en un query. Este mock simula el ORM roto para arrays.

import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { ProfileUseCase } from '../usecases/profiles'

const log = silentLogger()

const USERS = [
  { id: 'u1', name: 'Juan Pérez', hotelId: 'h1' },
  { id: 'u2', name: 'María Gómez', hotelId: 'h1' },
]

// userRepo que imita el ORM real: responde a { hotelId } pero NO a { id: [array] } (devuelve []).
const userRepo = {
  findMany: async (f: any) => {
    if (Array.isArray(f.id)) return []          // el ORM no soporta WHERE IN
    if (f.hotelId) return USERS.filter((u) => u.hotelId === f.hotelId)
    return []
  },
  findById: async (id: string) => USERS.find((u) => u.id === id) ?? null,
} as any

function repoWith(profiles: any[]) {
  return {
    paginate: async () => ({ data: profiles, total: profiles.length, limit: 20, offset: 0, pages: 1 }),
  } as any
}

describe('ProfileUseCase.list — enriquecido de nombre', () => {
  it('pone el nombre del usuario, no el userId', async () => {
    const uc = new ProfileUseCase(repoWith([
      { id: 'p1', userId: 'u1', hotelId: 'h1', active: 1 },
      { id: 'p2', userId: 'u2', hotelId: 'h1', active: 1 },
    ]), log, userRepo)
    const res = await uc.list({ hotelId: 'h1' })
    expect(res.data[0].userName).toBe('Juan Pérez')
    expect(res.data[1].userName).toBe('María Gómez')
  })

  it('cae al userId sólo si el usuario no existe', async () => {
    const uc = new ProfileUseCase(repoWith([
      { id: 'p3', userId: 'huerfano', hotelId: 'h1', active: 1 },
    ]), log, userRepo)
    const res = await uc.list({ hotelId: 'h1' })
    expect(res.data[0].userName).toBe('huerfano')
  })
})
