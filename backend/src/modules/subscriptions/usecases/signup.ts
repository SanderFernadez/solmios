// signup.ts — Alta pública: alguien crea su hotel y arranca la prueba gratis.
//
// Deja el hotel LISTO PARA TRABAJAR, que es lo que hoy no pasa: el alta manual
// del super-admin crea la fila del hotel y nada más — sin usuario (el formulario
// ni siquiera pide contraseña), sin roles, sin suscripción. El resultado es un
// hotel al que nadie puede entrar.
//
// Acá se crean las cuatro cosas juntas: hotel + dueño + roles + prueba.
import { ValidationError } from 'arckode-framework'
import type { RepositoryAdapter } from 'arckode-framework'
import { DEFAULT_ROLE_PERMISSIONS } from '../../../shared/permissions'

/** Días de prueba gratis. Es la promesa de la landing: si cambia, cambia acá. */
export const TRIAL_DAYS = 7

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MIN_PASSWORD = 8

export interface SignupInput {
  hotelName: string
  email: string
  password: string
  /** Nombre de la persona dueña de la cuenta. */
  ownerName?: string
  phone?: string
  address?: string
  /** País del hotel. Se elige de un catálogo en el alta (data/locales.ts). */
  country?: string
  /** Plan que quiere probar. Si no viene, se prueba sin plan asignado. */
  planId?: string
}

export interface SignupResult {
  hotelId: string
  userId: string
  trialEndsAt: string
  trialDays: number
}

export interface SignupDeps {
  hotelsRepo: RepositoryAdapter<any>
  usersRepo: RepositoryAdapter<any>
  rolesRepo: RepositoryAdapter<any>
  subscriptionsRepo: RepositoryAdapter<any>
  hashPassword: (plain: string) => Promise<string>
}

export class SignupUseCase {
  constructor(private readonly deps: SignupDeps) {}

  async signup(input: SignupInput, now: Date = new Date()): Promise<SignupResult> {
    const email = String(input.email ?? '').trim().toLowerCase()
    const hotelName = String(input.hotelName ?? '').trim()

    if (!hotelName) throw new ValidationError('El nombre del hotel es obligatorio')
    if (!email || !email.includes('@')) throw new ValidationError('El email no es válido')
    if (!input.password || input.password.length < MIN_PASSWORD) {
      throw new ValidationError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`)
    }

    // El email es la llave con la que después inicia sesión: si ya existe, el
    // alta no puede seguir o quedarían dos cuentas peleando por el mismo login.
    const taken = await this.deps.usersRepo.findMany({ email })
    if (taken.length) throw new ValidationError('Ya existe una cuenta con ese email')

    const hotelId = crypto.randomUUID()
    const trialEnds = new Date(now.getTime() + TRIAL_DAYS * MS_PER_DAY)

    // El alta son cuatro inserciones y cualquiera puede fallar. Si se cae a
    // mitad, lo creado se borra: un hotel sin suscripción entraría gratis para
    // siempre, y un email a medio registrar impide reintentar el alta ("ya
    // existe una cuenta") sin que exista una cuenta usable.
    try {
      return await this.createAll(hotelId, email, hotelName, input, trialEnds)
    } catch (err) {
      await this.rollback(hotelId)
      throw err
    }
  }

  private async createAll(
    hotelId: string,
    email: string,
    hotelName: string,
    input: SignupInput,
    trialEnds: Date,
  ): Promise<SignupResult> {
    await this.deps.hotelsRepo.create({
      id: hotelId,
      name: hotelName,
      email,
      phone: input.phone ?? '',
      // `address`, no `location`: el formulario del super-admin manda `location`,
      // que el ORM descarta sin avisar, y la dirección se pierde.
      address: input.address ?? '',
      country: input.country ?? '',
      status: 'active',
      active: 1,
    })

    const userId = crypto.randomUUID()
    await this.deps.usersRepo.create({
      id: userId,
      hotelId,
      name: input.ownerName?.trim() || hotelName,
      email,
      password: await this.deps.hashPassword(input.password),
      role: 'hotel_admin',
      userType: 'merchant',
      active: 1,
    })

    await this.createDefaultRoles(hotelId)

    await this.deps.subscriptionsRepo.create({
      id: crypto.randomUUID(),
      hotelId,
      planId: input.planId ?? '',
      status: 'trialing',
      trialEndsAt: trialEnds.toISOString(),
    })

    return {
      hotelId,
      userId,
      trialEndsAt: trialEnds.toISOString(),
      trialDays: TRIAL_DAYS,
    }
  }

  /**
   * Deshace un alta que quedó a medias. Es best-effort a propósito: si el
   * borrado también falla, se propaga el error ORIGINAL, que es el que explica
   * qué pasó.
   */
  private async rollback(hotelId: string): Promise<void> {
    const del = async (repo: RepositoryAdapter<any>, rows: any[]) => {
      for (const r of rows) await repo.delete?.(r.id).catch(() => {})
    }
    await del(this.deps.subscriptionsRepo, await this.deps.subscriptionsRepo.findMany({ hotelId }).catch(() => []))
    await del(this.deps.rolesRepo, await this.deps.rolesRepo.findMany({ hotelId }).catch(() => []))
    await del(this.deps.usersRepo, await this.deps.usersRepo.findMany({ hotelId }).catch(() => []))
    await this.deps.hotelsRepo.delete?.(hotelId).catch(() => {})
  }

  /**
   * Sin roles el hotel arranca sin permisos configurables: el dueño entra por
   * su `role` de usuario, pero no puede dar de alta a su recepcionista.
   */
  private async createDefaultRoles(hotelId: string): Promise<void> {
    for (const [name, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      await this.deps.rolesRepo.create({
        id: crypto.randomUUID(),
        hotelId,
        name,
        permissions,
        isSystem: 1,
      }).catch(() => { /* un rol repetido no puede tumbar el alta entera */ })
    }
  }
}
