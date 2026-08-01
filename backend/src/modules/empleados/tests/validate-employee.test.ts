// empleados/tests/validate-employee.test.ts — El empleado se valida por id de perfil O por userId.
//
// Regresión: la función buscaba sólo `findOne({ userId: employeeId })`, pero los formularios
// (contrato/documento/ausencia/evaluación) mandan el id del employee_profile. Resultado: un empleado
// válido daba SIEMPRE "El empleado no pertenece a este hotel" (400) → no se podía crear un contrato.

import { describe, it, expect } from 'bun:test'
import { validateEmployeeBelongsToHotel } from '../usecases/validate-employee'

// Repo que imita al ORM: findOne aplica los filtros exactos.
function repo(profiles: Array<{ id: string; userId: string; hotelId: string }>) {
  return {
    findOne: async (f: Record<string, any>) =>
      profiles.find((p) => Object.entries(f).every(([k, v]) => (p as any)[k] === v)) ?? null,
  } as any
}

const PROFILE = { id: 'prof-1', userId: 'user-1', hotelId: 'h1' }

describe('validateEmployeeBelongsToHotel', () => {
  it('acepta el id del employee_profile (lo que mandan los forms)', async () => {
    await expect(validateEmployeeBelongsToHotel(repo([PROFILE]), 'prof-1', 'h1')).resolves.toBeUndefined()
  })

  it('acepta también el userId (compatibilidad)', async () => {
    await expect(validateEmployeeBelongsToHotel(repo([PROFILE]), 'user-1', 'h1')).resolves.toBeUndefined()
  })

  it('rechaza un empleado de otro hotel', async () => {
    await expect(validateEmployeeBelongsToHotel(repo([PROFILE]), 'prof-1', 'otro-hotel')).rejects.toThrow(/no pertenece/)
  })

  it('rechaza un id inexistente', async () => {
    await expect(validateEmployeeBelongsToHotel(repo([PROFILE]), 'no-existe', 'h1')).rejects.toThrow(/no pertenece/)
  })
})
