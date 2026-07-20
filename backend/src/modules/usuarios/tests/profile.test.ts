// El perfil propio: siempre el del token, nunca el de otro.
// Multi-tenant: no se puede cambiar de hotel ni de rol editándose a uno mismo.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { getProfile, updateProfile } from '../usecases/profile'

const rosa = {
  id: 'rosa',
  name: 'Camarera Rosa',
  email: 'rosa@solmios.com',
  phone: '8095550001',
  avatar: null,
  password: 'hash-secreto',
  token: 'jwt-viejo',
  resetToken: 'reset-secreto',
  role: 'housekeeper',
  userType: 'merchant',
  hotelId: 'hotel-1',
}

function repos(over: Record<string, unknown> = {}, sink: any[] = []) {
  const user = { ...rosa, ...over }
  const repo = {
    findById: async (id: string) => (id === user.id ? user : null),
    update: async (id: string, d: any) => { sink.push({ id, ...d }); Object.assign(user, d); return user },
  } as unknown as RepositoryAdapter<any>
  const hotelRepo = {
    findById: async () => ({ id: 'hotel-1', name: 'Hotel Boutique Palma' }),
  } as unknown as RepositoryAdapter<any>
  return { repo, hotelRepo, sink }
}

describe('getProfile', () => {
  it('trae lo que el perfil necesita, incluidos avatar, teléfono y hotel', async () => {
    const { repo, hotelRepo } = repos({ avatar: '/uploads/avatars/rosa.jpg' })

    const p = await getProfile(repo, hotelRepo, 'rosa')

    expect(p.name).toBe('Camarera Rosa')
    expect(p.phone).toBe('8095550001')
    expect(p.avatar).toBe('/uploads/avatars/rosa.jpg')
    expect(p.hotelName).toBe('Hotel Boutique Palma')
    expect(p.role).toBe('housekeeper')
  })

  // Un perfil que filtra el hash o el token de sesión es un agujero.
  it('nunca devuelve password, token ni resetToken', async () => {
    const { repo, hotelRepo } = repos()

    const p = await getProfile(repo, hotelRepo, 'rosa')

    expect(Object.keys(p).sort()).toEqual(
      ['avatar', 'email', 'hotelId', 'hotelName', 'id', 'name', 'phone', 'role', 'rolePermissions', 'userType'],
    )
  })

  it('sin foto devuelve null, no undefined: la app cae a las iniciales', async () => {
    const { repo, hotelRepo } = repos({ avatar: undefined })

    expect((await getProfile(repo, hotelRepo, 'rosa')).avatar).toBeNull()
  })

  it('si el hotel no se puede leer, el perfil sigue sirviendo', async () => {
    const { repo } = repos()
    const roto = { findById: async () => { throw new Error('db caída') } } as unknown as RepositoryAdapter<any>

    expect((await getProfile(repo, roto, 'rosa')).hotelName).toBe('')
  })

  it('un usuario inexistente falla en vez de devolver un perfil vacío', async () => {
    const { repo, hotelRepo } = repos()

    expect(getProfile(repo, hotelRepo, 'fantasma')).rejects.toThrow()
  })
})

describe('updateProfile', () => {
  it('cambia nombre, teléfono y foto', async () => {
    const { repo, hotelRepo } = repos()

    const p = await updateProfile(repo, hotelRepo, 'rosa', {
      name: 'Rosa Pérez',
      phone: '809-555-9999',
      avatar: '/uploads/avatars/nueva.jpg',
    })

    expect(p.name).toBe('Rosa Pérez')
    expect(p.avatar).toBe('/uploads/avatars/nueva.jpg')
  })

  // El login compara dígitos planos: guardar "809-555-9999" rompería entrar por teléfono.
  it('normaliza el teléfono al formato que el login espera', async () => {
    const { repo, hotelRepo, sink } = repos()

    await updateProfile(repo, hotelRepo, 'rosa', { phone: '+1 (809) 555-9999' })

    expect(sink[0].phone).toBe('8095559999')
  })

  // Escalada de privilegios: editarse a uno mismo no puede volverte admin.
  it('ignora role, hotelId, email y password aunque vengan en el body', async () => {
    const { repo, hotelRepo, sink } = repos()

    await updateProfile(repo, hotelRepo, 'rosa', {
      name: 'Rosa',
      role: 'hotel_admin',
      hotelId: 'hotel-2',
      email: 'otro@mail.com',
      password: 'nueva',
    } as any)

    expect(Object.keys(sink[0]).sort()).toEqual(['id', 'name'])
  })

  it('un nombre de un solo carácter se rechaza', async () => {
    const { repo, hotelRepo } = repos()

    expect(updateProfile(repo, hotelRepo, 'rosa', { name: 'R' })).rejects.toThrow()
  })

  it('un nombre con espacios alrededor se guarda limpio', async () => {
    const { repo, hotelRepo, sink } = repos()

    await updateProfile(repo, hotelRepo, 'rosa', { name: '  Rosa Pérez  ' })

    expect(sink[0].name).toBe('Rosa Pérez')
  })

  it('un patch vacío no escribe en la base', async () => {
    const { repo, hotelRepo, sink } = repos()

    const p = await updateProfile(repo, hotelRepo, 'rosa', {})

    expect(sink).toEqual([])
    expect(p.name).toBe('Camarera Rosa')
  })

  it('borrar la foto (avatar: null) es válido', async () => {
    const { repo, hotelRepo, sink } = repos({ avatar: '/uploads/a.jpg' })

    const p = await updateProfile(repo, hotelRepo, 'rosa', { avatar: null })

    expect(sink[0].avatar).toBeNull()
    expect(p.avatar).toBeNull()
  })

  // El validador declara `avatar` como string: un `null` en el JSON se descarta
  // antes de llegar acá, así que la app manda '' para quitar la foto.
  it('avatar vacío también borra la foto', async () => {
    const { repo, hotelRepo, sink } = repos({ avatar: '/uploads/a.jpg' })

    const p = await updateProfile(repo, hotelRepo, 'rosa', { avatar: '' })

    expect(sink[0].avatar).toBeNull()
    expect(p.avatar).toBeNull()
  })

  it('no se puede editar el perfil de otro usuario', async () => {
    const { repo, hotelRepo } = repos()

    expect(updateProfile(repo, hotelRepo, 'carlos', { name: 'Hackeado' })).rejects.toThrow()
  })
})
