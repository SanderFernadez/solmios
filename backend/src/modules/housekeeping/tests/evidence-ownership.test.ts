// evidence-ownership.test.ts — Quién puede tocar fotos/video de una tarea.
// La camarera solo la SUYA; el supervisor/admin, cualquiera del hotel (foto de presencia).

import { describe, it, expect } from 'bun:test'
import { assertCanEditEvidence } from '../usecases/ownership'
import type { HousekeepingUser } from '../types'

const task = { hotelId: 'h1', staffId: 'rosa' }

describe('assertCanEditEvidence', () => {
  it('la camarera dueña puede', () => {
    const rosa: HousekeepingUser = { id: 'rosa', role: 'housekeeper', hotelId: 'h1' }
    expect(() => assertCanEditEvidence(task, rosa)).not.toThrow()
  })

  it('una camarera que NO es la dueña, no', () => {
    const otra: HousekeepingUser = { id: 'otra', role: 'housekeeper', hotelId: 'h1' }
    expect(() => assertCanEditEvidence(task, otra)).toThrow('no es la tarea asignada')
  })

  it('el supervisor puede (sube la foto de presencia de cualquier tarea)', () => {
    const sup: HousekeepingUser = { id: 'sup', role: 'supervisor', hotelId: 'h1' }
    expect(() => assertCanEditEvidence(task, sup)).not.toThrow()
  })

  it('el hotel_admin puede sobre cualquier tarea de su hotel', () => {
    const admin: HousekeepingUser = { id: 'a', role: 'hotel_admin', hotelId: 'h1' }
    expect(() => assertCanEditEvidence(task, admin)).not.toThrow()
  })

  it('nadie toca la evidencia de otro hotel', () => {
    const ajeno: HousekeepingUser = { id: 'x', role: 'hotel_admin', hotelId: 'h2' }
    expect(() => assertCanEditEvidence(task, ajeno)).toThrow('No autorizado')
  })

  it('el super_admin pasa siempre (cross-hotel)', () => {
    const su: HousekeepingUser = { id: 's', role: 'super_admin', hotelId: 'hZ' }
    expect(() => assertCanEditEvidence(task, su)).not.toThrow()
  })
})
