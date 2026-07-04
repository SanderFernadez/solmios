// service.test.ts — StaffAuthService tests (v2: bcrypt + rate limiting)
import { describe, it, expect, vi, beforeEach } from 'bun:test'
import { StaffAuthService } from '../service'

describe('StaffAuthService v2', () => {
  let service: StaffAuthService
  let mockUserRepo: any
  let mockLogger: any
  let mockAuth: any

  beforeEach(async () => {
    mockUserRepo = { findMany: vi.fn(), findById: vi.fn(), update: vi.fn() }
    mockLogger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    mockAuth = {
      createToken: vi.fn().mockReturnValue('jwt-token'),
      createRefreshToken: vi.fn().mockReturnValue('refresh-token'),
    }
    service = new StaffAuthService(mockUserRepo, mockLogger, mockAuth)

    // Pre-generate a bcrypt hash for PIN "123456"
    global.Bun = { password: { hash: async (p: string) => `hashed_${p}`, verify: async (p: string, h: string) => h === `hashed_${p}` } } as any
  })

  it('loginByPin returns token for valid PIN', async () => {
    mockUserRepo.findMany.mockResolvedValue([{
      id: 'u1', name: 'María', phone: '8091234567', role: 'camarera',
      hotelId: 'h1', pinEnabled: 1, pinHash: 'hashed_123456', pinAttempts: 0,
    }])

    const result = await service.loginByPin({ phone: '8091234567', pin: '123456' })
    expect(result.token).toBe('jwt-token')
    expect(result.user.name).toBe('María')
  })

  it('loginByPin throws on wrong PIN', async () => {
    mockUserRepo.findMany.mockResolvedValue([{
      id: 'u1', name: 'Ana', phone: '8091234567', role: 'camarera',
      hotelId: 'h1', pinEnabled: 1, pinHash: 'hashed_123456', pinAttempts: 0,
    }])

    await expect(service.loginByPin({ phone: '8091234567', pin: '000000' }))
      .rejects.toThrow('PIN incorrecto')
  })

  it('loginByPin locks account after 5 failed attempts', async () => {
    mockUserRepo.findMany.mockResolvedValue([{
      id: 'u1', name: 'Ana', phone: '8091234567', role: 'camarera',
      hotelId: 'h1', pinEnabled: 1, pinHash: 'hashed_123456', pinAttempts: 4,
    }])

    await expect(service.loginByPin({ phone: '8091234567', pin: '000000' }))
      .rejects.toThrow('Cuenta bloqueada')
  })

  it('loginByPin rejects when PIN not enabled', async () => {
    mockUserRepo.findMany.mockResolvedValue([{
      id: 'u1', name: 'Ana', phone: '8091234567', role: 'camarera',
      hotelId: 'h1', pinEnabled: 0, pinHash: null,
    }])

    await expect(service.loginByPin({ phone: '8091234567', pin: '123456' }))
      .rejects.toThrow('PIN no configurado')
  })

  it('loginByPin throws generic error for unknown phone', async () => {
    mockUserRepo.findMany.mockResolvedValue([])
    await expect(service.loginByPin({ phone: '00000000', pin: '123456' }))
      .rejects.toThrow('Credenciales incorrectas')
  })
})
