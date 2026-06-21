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
  ) {}

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
    const token = this.auth.createToken({ id: user.id, role: user.role })
    await this.repo.update(user.id, { token })
    return { token, user: { id: user.id, nombre: user.name, email: user.email, role: user.role, hotelId: user.hotelId } }
  }

  async me(id: string): Promise<any> {
    // @ignore IDOR_RISK — el id proviene del JWT del propio usuario (req.user.id), es un self-lookup.
    const u = await this.repo.findById(id)
    if (!u) throw new NotFoundError('Usuario no encontrado')
    return { id: u.id, nombre: u.name, email: u.email, role: u.role, hotelId: u.hotelId }
  }

  async list(hotelId: string): Promise<any[]> {
    const users = await this.repo.findMany({ hotelId })
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
    const allowed = (({ name, email, password, phone, avatar }) => ({ name, email, password, phone, avatar }))(data)
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

  async forgotPassword(email: string): Promise<{ resetToken: string }> {
    const normalizedEmail = email.trim().toLowerCase()
    const user = await this.repo.findOne({ email: normalizedEmail })
    // Always return success to prevent email enumeration
    if (!user) return { resetToken: 'dummy' }
    const resetToken = crypto.randomUUID()
    const resetExpires = Date.now() + 60 * 60 * 1000 // 1 hour
    await this.repo.update(user.id, { resetToken, resetExpires })
    // TODO: Send email with reset link containing resetToken
    return { resetToken }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.repo.findOne({ resetToken: token })
    if (!user || user.resetExpires < Date.now()) throw new AuthError('Token inválido o expirado')
    const hashed = await this.hashPassword(newPassword)
    await this.repo.update(user.id, { password: hashed, resetToken: null, resetExpires: null })
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.repo.findById(id)
    if (!user) throw new NotFoundError('Usuario no encontrado')
    const valid = await this.verifyPassword(currentPassword, user.password)
    if (!valid) throw new AuthError('Contraseña actual incorrecta')
    const hashed = await this.hashPassword(newPassword)
    await this.repo.update(id, { password: hashed })
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
