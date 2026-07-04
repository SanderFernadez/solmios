// service.ts — StaffAuth: login por PIN con bcrypt + rate limiting
import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import { AuthError, NotFoundError, ValidationError } from 'arckode-framework'
import type { PinLoginDTO, PinLoginResponse, StaffUser } from './types'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

export class StaffAuthService {
  constructor(
    private readonly userRepo: RepositoryAdapter<StaffUser>,
    private readonly logger: Logger,
    private readonly auth: Auth,
  ) {}

  async loginByPin(dto: PinLoginDTO): Promise<PinLoginResponse> {
    // 1. Buscar usuario por teléfono
    const users = await this.userRepo.findMany({ phone: dto.phone })
    const user = users.length > 0 ? (users[0] as any) : null

    if (!user) {
      // Error genérico por seguridad
      throw new AuthError('Credenciales incorrectas')
    }

    // 2. Verificar si la cuenta está bloqueada
    if (user.pinLockedUntil) {
      const lockedUntil = new Date(user.pinLockedUntil).getTime()
      if (lockedUntil > Date.now()) {
        const remaining = Math.ceil((lockedUntil - Date.now()) / 60000)
        throw new AuthError(`Cuenta bloqueada. Intenta en ${remaining} minutos`)
      }
      // Desbloquear si ya pasó el tiempo
      await this.userRepo.update(user.id, {
        pinAttempts: 0,
        pinLockedUntil: null,
      } as any)
    }

    // 3. Verificar que PIN esté habilitado
    if (!user.pinEnabled || !user.pinHash) {
      throw new AuthError('PIN no configurado. Contacta al administrador')
    }

    // 4. Verificar PIN con bcrypt
    const pinValid = await Bun.password.verify(dto.pin, user.pinHash)
    if (!pinValid) {
      // Incrementar intentos
      const attempts = (user.pinAttempts || 0) + 1
      const updateData: Record<string, any> = { pinAttempts: attempts }

      if (attempts >= MAX_ATTEMPTS) {
        // Bloquear cuenta
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString()
        updateData.pinLockedUntil = lockUntil
        updateData.pinAttempts = 0
        this.logger.warn('Cuenta bloqueada por múltiples intentos', { userId: user.id })
      }

      await this.userRepo.update(user.id, updateData as any)

      throw new AuthError('PIN incorrecto')
    }

    // 5. PIN correcto — resetear intentos
    await this.userRepo.update(user.id, {
      pinAttempts: 0,
      pinLockedUntil: null,
    } as any)

    // 6. Generar tokens JWT
    const tokenPayload = {
      id: user.id,
      hotelId: user.hotelId,
      role: user.role,
    }

    const token = (this.auth as any).createToken(tokenPayload)
    const refreshToken = (this.auth as any).createRefreshToken(tokenPayload)

    this.logger.info('PIN login exitoso', { userId: user.id, role: user.role })

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        hotelId: user.hotelId || '',
      },
    }
  }

  async setPin(userId: string, pin: string, adminId: string): Promise<void> {
    // 1. Verificar que el admin tenga permisos
    const admin = await this.userRepo.findById(adminId) as any
    if (!admin || (admin.role !== 'hotel_admin' && admin.role !== 'super_admin')) {
      throw new AuthError('Solo el administrador puede configurar PIN')
    }

    // 2. Validar PIN (6 dígitos)
    if (!/^\d{6}$/.test(pin)) {
      throw new ValidationError('El PIN debe tener 6 dígitos')
    }

    // 3. Hash del PIN con bcrypt
    const pinHash = await Bun.password.hash(pin)

    // 4. Guardar
    await this.userRepo.update(userId, {
      pinHash,
      pinEnabled: 1,
      pinAttempts: 0,
      pinLockedUntil: null,
      pinSetAt: new Date().toISOString(),
    } as any)

    this.logger.info('PIN configurado', { userId, setBy: adminId })
  }

  async resetPin(userId: string, adminId: string): Promise<void> {
    const admin = await this.userRepo.findById(adminId) as any
    if (!admin || (admin.role !== 'hotel_admin' && admin.role !== 'super_admin')) {
      throw new AuthError('Solo el administrador puede resetear PIN')
    }

    await this.userRepo.update(userId, {
      pinHash: null,
      pinEnabled: 0,
      pinAttempts: 0,
      pinLockedUntil: null,
    } as any)

    this.logger.info('PIN reseteado', { userId, resetBy: adminId })
  }
}
