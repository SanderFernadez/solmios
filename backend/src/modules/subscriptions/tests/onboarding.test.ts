// La guía se calcula con los DATOS REALES del hotel: un checklist que se marca
// porque alguien apretó "listo" miente en cuanto se borra lo que había cargado.
import { describe, it, expect } from 'bun:test'
import { OnboardingUseCase } from '../usecases/onboarding'
import type { RepositoryAdapter } from 'arckode-framework'

function setup(opts: { rooms?: number; users?: number; rates?: number; hotel?: any } = {}) {
  const list = (n = 0) => Array.from({ length: n }, (_, i) => ({ id: `x${i}` }))
  const repo = (rows: any[]): RepositoryAdapter<any> => ({
    findMany: async () => rows,
    findById: async () => opts.hotel ?? null,
  } as unknown as RepositoryAdapter<any>)

  return new OnboardingUseCase({
    roomsRepo: repo(list(opts.rooms)),
    usersRepo: repo(list(opts.users ?? 1)), // el dueño siempre existe
    ratesRepo: repo(list(opts.rates)),
    hotelsRepo: repo([]),
  })
}

describe('OnboardingUseCase', () => {
  it('hotel recién creado: nada hecho y la guía se muestra', async () => {
    const st = await setup().status('h1')
    expect(st.completed).toBe(false)
    expect(st.doneCount).toBe(0)
    expect(st.steps[0]!.key).toBe('rooms') // sin habitaciones no hay reservas
    expect(st.steps[0]!.required).toBe(true)
  })

  it('cuenta lo que ya cargó', async () => {
    const st = await setup({ rooms: 12 }).status('h1')
    const rooms = st.steps.find(s => s.key === 'rooms')!
    expect(rooms.done).toBe(true)
    expect(rooms.count).toBe(12)
  })

  it('la guía se esconde cuando lo obligatorio está hecho', async () => {
    const st = await setup({ rooms: 5, hotel: { phone: '809', address: 'SD' } }).status('h1')
    expect(st.completed).toBe(true) // aunque falten tarifas y equipo, que son opcionales
  })

  it('el dueño solo no cuenta como equipo armado', async () => {
    const soloDueño = await setup({ users: 1 }).status('h1')
    expect(soloDueño.steps.find(s => s.key === 'team')!.done).toBe(false)
    const conEquipo = await setup({ users: 3 }).status('h1')
    const team = conEquipo.steps.find(s => s.key === 'team')!
    expect(team.done).toBe(true)
    expect(team.count).toBe(2) // sin contar al dueño
  })

  it('los datos del hotel se dan por hechos con teléfono o dirección', async () => {
    const st = await setup({ hotel: { address: 'Santo Domingo' } }).status('h1')
    expect(st.steps.find(s => s.key === 'hotel')!.done).toBe(true)
  })
})
