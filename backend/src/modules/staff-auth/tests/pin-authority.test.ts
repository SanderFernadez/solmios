// pin-authority.test.ts — S-C1: quién puede plantar/resetear el PIN de quién.
//
// La escalada que esto corta: un hotel_admin ponía un PIN en el super_admin de otro hotel y se
// logueaba como él (loginByPin emite un token con el rol del usuario objetivo).

import { describe, it, expect } from 'bun:test'
import { assertCanManagePin } from '../usecases/pin-authority'

const admin = (over: any = {}) => ({ id: 'a1', role: 'hotel_admin', hotelId: 'hA', ...over })
const target = (over: any = {}) => ({ id: 't1', role: 'receptionist', hotelId: 'hA', ...over })

describe('assertCanManagePin — S-C1', () => {
  it('super_admin puede gestionar el PIN de cualquiera', () => {
    expect(() => assertCanManagePin(admin({ role: 'super_admin', hotelId: null }), target({ hotelId: 'hB', role: 'hotel_admin' }))).not.toThrow()
  })

  it('hotel_admin puede gestionar el PIN de staff de su propio hotel', () => {
    expect(() => assertCanManagePin(admin(), target({ role: 'receptionist', hotelId: 'hA' }))).not.toThrow()
  })

  it('BLOQUEA: hotel_admin sobre un usuario de OTRO hotel (cross-tenant)', () => {
    expect(() => assertCanManagePin(admin(), target({ hotelId: 'hB' }))).toThrow(/otro hotel/)
  })

  it('BLOQUEA: hotel_admin sobre el super_admin (la escalada)', () => {
    expect(() => assertCanManagePin(admin(), target({ role: 'super_admin', hotelId: 'hA' }))).toThrow(/administrador/)
  })

  it('BLOQUEA: hotel_admin sobre otro hotel_admin (un par)', () => {
    expect(() => assertCanManagePin(admin(), target({ role: 'hotel_admin', hotelId: 'hA' }))).toThrow(/administrador/)
  })
})
