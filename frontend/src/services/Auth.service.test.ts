import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./http', () => ({
  http: { post: vi.fn(), get: vi.fn() },
}))

import { AuthService } from './Auth.service'
import { http } from './http'

// mapUser (Auth.service.ts) es un passthrough puro — YA NO deriva permisos del `role` en el
// cliente (esa lógica vivía acá antes de la migración a roles custom, #169/#428: hoy el
// backend siempre manda `permissions` resuelto vía load-permissions.ts/getRolePermissions,
// formato `module:action` con `'*:*'` para super_admin). El mock debe traer `permissions`
// como lo manda el backend real, no confiar en una derivación que ya no existe.
const rawUser = (role: string, permissions: string[] = []) => ({
  id: 'u1', email: 't@h.com', name: 'Test', role, hotelId: 'h1', hotelName: 'Hotel Demo', permissions,
})

describe('Auth.service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('login pega a /auth/login con las credenciales y mapea el user', async () => {
    vi.mocked(http.post).mockResolvedValue({
      token: 'tok', refreshToken: 'ref', user: rawUser('hotel_admin', ['reservations:view']),
    } as any)

    const res = await AuthService.login('t@h.com', 'secret')

    expect(http.post).toHaveBeenCalledWith('/auth/login', { email: 't@h.com', password: 'secret' })
    expect(res.token).toBe('tok')
    expect(res.user.role).toBe('hotel_admin')
    // mapUser es passthrough: los permisos son los que mandó el backend, tal cual.
    expect(res.user.permissions).toContain('reservations:view')
    expect(res.user.permissions).not.toContain('*:*')
  })

  it('mapUser da permisos totales al super_admin', async () => {
    vi.mocked(http.get).mockResolvedValue(rawUser('super_admin', ['*:*']) as any)
    const user = await AuthService.me()
    expect(user.permissions).toContain('*:*')
    expect(user.hotelName).toBe('Hotel Demo')
  })

  it('mapUser normaliza hotelId/hotelName ausentes a string vacío', async () => {
    vi.mocked(http.get).mockResolvedValue({ id: 'u2', email: 'a@b.com', name: 'A', role: 'receptionist' } as any)
    const user = await AuthService.me()
    expect(user.hotelId).toBe('')
    expect(user.hotelName).toBe('')
  })

  it('logout pega a /auth/logout', async () => {
    vi.mocked(http.post).mockResolvedValue(undefined as any)
    await AuthService.logout()
    expect(http.post).toHaveBeenCalledWith('/auth/logout')
  })
})
