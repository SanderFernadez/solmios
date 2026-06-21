// usuarios/service.ts — Auth + gestión de usuarios
import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'

const JWT_SECRET = process.env.JWT_SECRET || 'managerhotel-dev-secret-change'

export class UsuariosService {
  constructor(
    private readonly repo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    private readonly cache: CacheAdapter,
    private readonly auth: Auth,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    const user = await this.repo.findOne({ email })
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
    return this.repo.findMany({ hotelId })
  }

  async create(data: any): Promise<any> {
    const password = await this.hashPassword(data.password || 'demo123')
    return this.repo.create({ ...data, id: crypto.randomUUID(), password, activo: 1 })
  }

  async update(id: string, data: any): Promise<any> {
    if (data.password) data.password = await this.hashPassword(data.password)
    return this.repo.update(id, data)
  }

  async delete(id: string): Promise<boolean> {
    return this.repo.delete(id)
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
