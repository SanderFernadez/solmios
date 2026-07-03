// usuarios/service.ts — Auth + gestión de usuarios
import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required')

export class UsuariosService {
  constructor(
    private readonly repo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
    private readonly hotelRepo?: RepositoryAdapter<any>,
  ) {}

  async getHotels(userId: string, role: string): Promise<any[]> {
    if (!this.hotelRepo) return []
    const hotels = await this.hotelRepo.findMany({})
    // super_admin ve todos los hoteles; hotel_admin solo el suyo
    if (role === 'super_admin') {
      return hotels.map(({ ...rest }: any) => rest)
    }
    const user = await this.repo.findById(userId)
    if (!user) return []
    return hotels.filter((h: any) => h.id === user.hotelId)
  }

  async switchHotel(userId: string, targetHotelId: string, currentRole: string): Promise<{ token: string; user: any }> {
    if (!this.hotelRepo) throw new AuthError('HotelRepo no disponible')
    const hotels = await this.hotelRepo.findMany({})
    const hotel = hotels.find((h: any) => h.id === targetHotelId)
    if (!hotel) throw new NotFoundError('Hotel no encontrado')
    const user = await this.repo.findById(userId)
    if (!user) throw new NotFoundError('Usuario no encontrado')
    // hotel_admin solo puede cambiar a su propio hotel
    if (currentRole !== 'super_admin' && user.hotelId !== targetHotelId) {
      throw new AuthError('No autorizado para este hotel')
    }
    // Mantener rol original; si es super_admin y cambia a otro hotel, queda super_admin
    // Si es hotel_admin, ya validamos que targetHotelId === user.hotelId
    const token = (this.auth as any).createToken({ id: userId, role: currentRole, hotelId: targetHotelId })
    await this.repo.update(userId, { token })
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: currentRole,
        hotelId: targetHotelId,
        hotelName: hotel.name,
      },
    }
  }

  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    const normalizedEmail = email.trim().toLowerCase()
    const user = await this.repo.findOne({ email: normalizedEmail })
    if (!user || user.active === 0) throw new AuthError('Credenciales inválidas')
    const valid = await this.verifyPassword(password, user.password)
    if (!valid) throw new AuthError('Credenciales inválidas')
    // migración lazy de legacy plaintext → bcrypt
    if (!String(user.password).startsWith('$2') && !String(user.password).startsWith('$argon2') && !String(user.password).includes(':')) {
      await this.repo.update(user.id, { password: await this.hashPassword(password) })
    }
    const token = (this.auth as any).createToken({ id: user.id, role: user.role, hotelId: user.hotelId })
    await this.repo.update(user.id, { token })
    let hotelName = ''
    if (user.hotelId && this.hotelRepo) {
      try {
        const hotel = await this.hotelRepo.findById(user.hotelId)
        if (hotel && this.auth) this.auth.assertOwnership(hotel, user.hotelId)
        hotelName = (hotel as any)?.name || ''
      } catch { /* graceful */ }
    }
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, hotelId: user.hotelId, hotelName } }
  }

  async me(id: string): Promise<any> {
    // @ignore IDOR_RISK — el id proviene del JWT del propio usuario (req.user.id), es un self-lookup.
    const u = await this.repo.findById(id)
    if (!u) throw new NotFoundError('Usuario no encontrado')
    return { id: u.id, name: u.name, email: u.email, role: u.role, hotelId: u.hotelId }
  }

  async list(hotelId?: string): Promise<any[]> {
    // sin hotelId (super_admin) → todos los usuarios; con hotelId → solo ese hotel.
    const users = await this.repo.findMany(hotelId ? { hotelId } : {})
    return users.map(({ password, token, resetToken, resetExpires, ...rest }) => rest)
  }

  async create(data: any): Promise<any> {
    if (!data.password) throw new Error('Password is required')
    const password = await this.hashPassword(data.password)
    const created = await this.repo.create({ ...data, id: crypto.randomUUID(), password, active: 1 })
    const { password: _, token: __, resetToken: ___, resetExpires: ____, ...rest } = created
    return rest
  }

  async update(id: string, data: any): Promise<any> {
    const allowed = (({ name, email, password, phone, avatar, role }) => ({ name, email, password, phone, avatar, role }))(data)
    if (allowed.password) allowed.password = await this.hashPassword(allowed.password)
    const updated = await this.repo.update(id, allowed)
    const { password: _, token: __, resetToken: ___, resetExpires: ____, ...rest } = updated
    return rest
  }

  async delete(id: string): Promise<boolean> {
    return this.repo.delete(id)
  }

  async logout(id: string): Promise<void> {
    await this.repo.update(id, { token: null })
  }

  async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase()
    const user = await this.repo.findOne({ email: normalizedEmail })
    if (!user) return
    const resetToken = crypto.randomUUID()
    const resetExpires = Date.now() + 60 * 60 * 1000
    await this.repo.update(user.id, { resetToken, resetExpires })
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.repo.findOne({ resetToken: token })
    if (!user || user.resetExpires < Date.now()) throw new AuthError('Token inválido o expirado')
    const hashed = await this.hashPassword(newPassword)
    await this.repo.update(user.id, { password: hashed, token: null, resetToken: null, resetExpires: null })
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    // Ownership: callerUserId === id se valida en el controller vía auth.assertOwnership(req.user.userId, id).
    // Aquí además se verifica con currentPassword (re-autenticación implícita).
    if (!id) throw new AuthError('userId requerido')
    const user = await this.repo.findById(id)
    if (!user) throw new NotFoundError('Usuario no encontrado')
    const valid = await this.verifyPassword(currentPassword, user.password)
    if (!valid) throw new AuthError('Contraseña actual incorrecta')
    const hashed = await this.hashPassword(newPassword)
    await this.repo.update(id, { password: hashed, token: null })
  }

  private async hashPassword(p: string): Promise<string> {
    return Bun.password.hash(p, 'bcrypt')
  }
  private async verifyPassword(plain: string, stored: string): Promise<boolean> {
    if (stored.startsWith('$2') || stored.startsWith('$argon2')) {
      try { return await Bun.password.verify(plain, stored) } catch { return false }
    }
    return stored === plain
  }
}
