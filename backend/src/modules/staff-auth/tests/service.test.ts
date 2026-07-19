// service.test.ts — StaffAuthService tests (v2: bcrypt + rate limiting)
import { describe, it, expect, vi, beforeEach } from 'bun:test'
import { StaffAuthService } from '../service'

describe('StaffAuthService v2', () => {
  let service: StaffAuthService
  let mockUserRepo: any
  let mockLogger: any
  let mockAuth: any
  let realPinHash: string

  beforeEach(async () => {
    mockUserRepo = { findMany: vi.fn(), findById: vi.fn(), update: vi.fn() }
    mockLogger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    mockAuth = {
      createToken: vi.fn().mockReturnValue('jwt-token'),
      createRefreshToken: vi.fn().mockReturnValue('refresh-token'),
    }
    service = new StaffAuthService(mockUserRepo, mockLogger, mockAuth)
    // Bun.password es un global readonly del runtime (no se puede reasignar con
    // global.Bun = {...}). Usamos el hash bcrypt REAL para '123456' y dejamos que el
    // servicio verify contra él — ejercita el flujo real sin mockear el global.
    realPinHash = await Bun.password.hash('123456')
  })

  it('loginByPin returns token for valid PIN', async () => {
    mockUserRepo.findMany.mockResolvedValue([{
      id: 'u1', name: 'María', phone: '8091234567', role: 'camarera',
      hotelId: 'h1', active: 1, pinEnabled: 1, pinHash: realPinHash, pinAttempts: 0,
    }])

    const result = await service.loginByPin({ phone: '8091234567', pin: '123456' })
    expect(result.token).toBe('jwt-token')
    expect(result.user.name).toBe('María')
  })

  it('loginByPin throws on wrong PIN', async () => {
    mockUserRepo.findMany.mockResolvedValue([{
      id: 'u1', name: 'Ana', phone: '8091234567', role: 'camarera',
      hotelId: 'h1', active: 1, pinEnabled: 1, pinHash: realPinHash, pinAttempts: 0,
    }])

    await expect(service.loginByPin({ phone: '8091234567', pin: '000000' }))
      .rejects.toThrow('PIN incorrecto')
  })

  it('loginByPin locks account after 5 failed attempts', async () => {
    mockUserRepo.findMany.mockResolvedValue([{
      id: 'u1', name: 'Ana', phone: '8091234567', role: 'camarera',
      hotelId: 'h1', active: 1, pinEnabled: 1, pinHash: realPinHash, pinAttempts: 4,
    }])

    await expect(service.loginByPin({ phone: '8091234567', pin: '000000' }))
      .rejects.toThrow('Cuenta bloqueada')
  })

  it('loginByPin rejects when PIN not enabled', async () => {
    mockUserRepo.findMany.mockResolvedValue([{
      id: 'u1', name: 'Ana', phone: '8091234567', role: 'camarera',
      hotelId: 'h1', active: 1, pinEnabled: 0, pinHash: null,
    }])

    await expect(service.loginByPin({ phone: '8091234567', pin: '123456' }))
      .rejects.toThrow('PIN no configurado')
  })

  it('loginByPin throws generic error for unknown phone', async () => {
    mockUserRepo.findMany.mockResolvedValue([])
    await expect(service.loginByPin({ phone: '00000000', pin: '123456' }))
      .rejects.toThrow('Credenciales incorrectas')
  })

  it('loginByPin rejects when account is deactivated (active=0)', async () => {
    // BUG FIX: antes loginByPin no verificaba user.active → un usuario desactivado seguía entrando
    // por PIN desde la app móvil. El login por email sí lo verifica.
    mockUserRepo.findMany.mockResolvedValue([{
      id: 'u1', name: 'Eva', phone: '8091234567', role: 'camarera',
      hotelId: 'h1', active: 0, pinEnabled: 1, pinHash: realPinHash, pinAttempts: 0,
    }])
    await expect(service.loginByPin({ phone: '8091234567', pin: '123456' }))
      .rejects.toThrow('Cuenta desactivada')
  })
})
