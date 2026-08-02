import type { HttpRequest, Logger, Auth, RepositoryAdapter } from 'arckode-framework'
import { validateSchema, OrmRepository } from 'arckode-framework'
import type { ReservasService } from './service'
import { CreateReservasSchema, UpdateReservasSchema, CompanionSchema, AddonSchema, PreCheckinSchema, SettleSchema, RescheduleSchema, RescheduleChargeSchema } from './validators/schema'
import { listCompanions, createCompanion, updateCompanion, deleteCompanion } from './usecases/companions'
import { listAddons, createAddon, deleteAddon } from './usecases/addons'
import { hashGuaranteePin, verifyGuaranteePin } from '../../services/guarantee-pin'
import { sendCheckinEmail } from './usecases/checkin-email'
import { dispatchLifecycleEmail } from './usecases/lifecycle-email'

export class ReservasController {
  constructor(
    private readonly service: ReservasService,
    private readonly logger: Logger,
    private readonly companionsRepo: RepositoryAdapter<any>,
    private readonly addonsRepo: RepositoryAdapter<any>,
    private readonly reservationRepo: RepositoryAdapter<any>,
    private readonly userRepo: RepositoryAdapter<any>,
    private readonly auth: Auth,
    private readonly orm?: any,
    private readonly emailSender?: any,
    private readonly messageLogRepo?: any,
    private readonly roomRepoForEmail?: any,
    private readonly hotelRepoForEmail?: any,
  ) {}

  // ── CRUD reservas (/api/reservas) ──
  async index(req: HttpRequest) {
    const result = await this.service.list(req.query as any, req.user as any)
    return { status: 200, body: result }
  }
  async show(req: HttpRequest) {
    const item = await this.service.getById(req.params.id, req.user as any)
    return { status: 200, body: item }
  }
  async store(req: HttpRequest) {
    const data = validateSchema(CreateReservasSchema, req.body)
    const item = await this.service.create(data as any, req.user as any)
    return { status: 201, body: item }
  }
  async update(req: HttpRequest) {
    const data = validateSchema(UpdateReservasSchema, req.body)
    const item = await this.service.update(req.params.id, data as any, req.user as any)
    return { status: 200, body: item }
  }
  async destroy(req: HttpRequest) {
    await this.service.delete(req.params.id, req.user as any)
    return { status: 204, body: null }
  }

  // ── Companions (/api/reservations/:id/companions, /api/companions/:id) — F2 ──
  async listCompanions(req: HttpRequest) {
    const data = await listCompanions(this.companionsRepo, this.reservationRepo, this.userRepo, this.auth, req.params.id, req.user as any)
    return { status: 200, body: { data } }
  }
  async createCompanion(req: HttpRequest) {
    const dto = validateSchema(CompanionSchema, req.body) as any
    const c = await createCompanion(this.companionsRepo, this.reservationRepo, this.userRepo, this.auth, req.params.id, dto, req.user as any)
    return { status: 201, body: c }
  }
  async updateCompanion(req: HttpRequest) {
    const dto = validateSchema(CompanionSchema, req.body) as any
    const c = await updateCompanion(this.companionsRepo, this.reservationRepo, this.userRepo, this.auth, req.params.id, dto, req.user as any)
    return { status: 200, body: c }
  }
  async deleteCompanion(req: HttpRequest) {
    await deleteCompanion(this.companionsRepo, this.reservationRepo, this.userRepo, this.auth, req.params.id, req.user as any)
    return { status: 200, body: { success: true } }
  }

  // ── Addons (/api/reservations/:id/addons, /api/addons/:id) — F2 ──
  async listAddons(req: HttpRequest) {
    const data = await listAddons(this.addonsRepo, this.reservationRepo, this.userRepo, this.auth, req.params.id, req.user as any)
    return { status: 200, body: { data } }
  }
  async createAddon(req: HttpRequest) {
    const dto = validateSchema(AddonSchema, req.body) as any
    const a = await createAddon(this.addonsRepo, this.reservationRepo, this.userRepo, this.auth, req.params.id, dto, req.user as any)
    return { status: 201, body: a }
  }
  async deleteAddon(req: HttpRequest) {
    await deleteAddon(this.addonsRepo, this.reservationRepo, this.userRepo, this.auth, req.params.id, req.user as any)
    return { status: 200, body: { success: true } }
  }

  // ── CHECK-IN ──────────────────────────────────────────────────────────
  async checkin(req: HttpRequest) {
    try {
      const { reservation, hotelId } = await this.service.checkin(req.params.id, req.user as any)
      const result = await this.service.executeCheckin(reservation, req.user as any, { orm: this.orm, logger: this.logger })
      this.pushChannex(reservation.hotelId, reservation.roomId)
      sendCheckinEmail({ emailSender: this.emailSender, guestRepo: this.userRepo, roomRepo: this.roomRepoForEmail, hotelRepo: this.hotelRepoForEmail, messageLogRepo: this.messageLogRepo, lockCodeRepo: this.orm ? new OrmRepository(this.orm, 'LockCodes') : undefined, logger: this.logger }, { reservationId: reservation.id, hotelId: reservation.hotelId, guestId: result.guestId, roomId: reservation.roomId, checkIn: reservation.checkIn, checkOut: reservation.checkOut }).catch((e: any) => this.logger.warn('check-in email', { error: e.message }))
      return { status: 200, body: result }
    } catch (e: any) {
      if (e.name === 'NotFoundError') return { status: 404, body: { error: e.message } }
      if (e.name === 'AuthError') return { status: 403, body: { error: e.message } }
      if (e.name === 'ForbiddenError') return { status: 403, body: { error: e.message } }
      if (e.name === 'ConflictError') return { status: 409, body: { error: e.message } }
      return { status: 500, body: { error: e.message } }
    }
  }

  // ── CHECK-OUT ─────────────────────────────────────────────────────────
  async checkout(req: HttpRequest) {
    try {
      const { reservation, hotelId } = await this.service.checkout(req.params.id, req.user as any)

      // Settlement: close folio → create invoice → record payment (if any)
      let settlementResult = null
      const body = req.body as Record<string, any> | undefined
      if (body?.settle !== undefined) {
        const settle = validateSchema(SettleSchema, body.settle) as { method: string; amount: number; reference?: string }
        settlementResult = await this.service.settleFolioForCheckout(reservation, settle, req.user as any)
      }

      const result = await this.service.executeCheckout(reservation, req.user as any, { orm: this.orm, logger: this.logger })
      this.pushChannex(reservation.hotelId, reservation.roomId)
      dispatchLifecycleEmail({ emailSender: this.emailSender, guestRepo: this.userRepo, roomRepo: this.roomRepoForEmail, hotelRepo: this.hotelRepoForEmail, messageLogRepo: this.messageLogRepo, logger: this.logger }, { reservationId: reservation.id, hotelId: reservation.hotelId, guestId: reservation.guestId, roomId: reservation.roomId, checkIn: reservation.checkIn, checkOut: reservation.checkOut, event: 'checkout' }).catch((e: any) => this.logger.warn('checkout email', { error: e.message }))
      return { status: 200, body: { ...result, settlement: settlementResult } }
    } catch (e: any) {
      if (e.name === 'NotFoundError') return { status: 404, body: { error: e.message } }
      if (e.name === 'AuthError') return { status: 403, body: { error: e.message } }
      if (e.name === 'ForbiddenError') return { status: 403, body: { error: e.message } }
      if (e.name === 'ConflictError') return { status: 409, body: { error: e.message } }
      if (e.name === 'ValidationError') return { status: 400, body: { error: e.message, fields: e.fields } }
      return { status: 500, body: { error: e.message } }
    }
  }

  // ── RESCHEDULE (mover/extender desde planning) ────────────────────────
  async rescheduleQuote(req: HttpRequest) {
    try {
      const data = validateSchema(RescheduleSchema, req.body) as any
      return { status: 200, body: await this.service.quoteReschedule(req.params.id, data, req.user as any) }
    } catch (e: any) {
      return this.mapRescheduleError(e)
    }
  }

  async reschedule(req: HttpRequest) {
    try {
      const body = req.body as Record<string, any> | undefined
      const move = validateSchema(RescheduleSchema, body) as any
      const charge = body?.charge ? validateSchema(RescheduleChargeSchema, body.charge) : undefined
      const result = await this.service.reschedule(req.params.id, { ...move, charge }, req.user as any)
      return { status: 200, body: result }
    } catch (e: any) {
      return this.mapRescheduleError(e)
    }
  }

  private mapRescheduleError(e: any) {
    if (e.name === 'NotFoundError') return { status: 404, body: { error: e.message } }
    if (e.name === 'AuthError' || e.name === 'ForbiddenError') return { status: 403, body: { error: e.message } }
    if (e.name === 'ConflictError') return { status: 409, body: { error: e.message } }
    if (e.name === 'ValidationError') return { status: 400, body: { error: e.message, fields: e.fields } }
    return { status: 500, body: { error: e.message } }
  }

  private pushChannex(hotelId: string, roomId: string): void {
    const svc = this.service as any
    if (svc.orchestrationDeps?.pushAvailabilityToChannex) {
      svc.orchestrationDeps.pushAvailabilityToChannex(hotelId, roomId)
    }
  }

  // ── PRE-CHECKIN (público) ─────────────────────────────────────────────
  async getPreCheckinData(req: HttpRequest) {
    try {
      return { status: 200, body: await this.service.getPreCheckinData(req.params.hash) }
    } catch (e: any) {
      return { status: e.message.includes('expiro') ? 410 : 404, body: { success: false, error: { message: e.message } } }
    }
  }

  async submitPreCheckin(req: HttpRequest) {
    try {
      validateSchema(PreCheckinSchema, req.body)
    } catch (e: any) {
      return { status: 400, body: { success: false, error: { message: `Datos inválidos: ${e.message}` } } }
    }
    try {
      await this.service.submitPreCheckin(req.params.hash, req.body)
      return { status: 200, body: { success: true, message: 'Pre-checkin completado' } }
    } catch (e: any) {
      return { status: 404, body: { success: false, error: { message: e.message } } }
    }
  }

  // ── EXTENDED DETAIL ───────────────────────────────────────────────────
  async getExtendedDetail(req: HttpRequest) {
    try {
      return { status: 200, body: await this.service.getExtendedDetail(req.params.id, req.user) }
    } catch (e: any) {
      if (e.name === 'NotFoundError') return { status: 404, body: { error: e.message } }
      return { status: 403, body: { error: e.message } }
    }
  }

  // ── AUDIT TRAIL ───────────────────────────────────────────────────────
  async getAuditTrail(req: HttpRequest) {
    try {
      return { status: 200, body: { data: await this.service.getAuditTrail(req.params.id, req.user) } }
    } catch (e: any) {
      if (e.name === 'NotFoundError') return { status: 404, body: { error: e.message } }
      return { status: 403, body: { error: e.message } }
    }
  }

  // ── GUARANTEE CARD ────────────────────────────────────────────────────
  async setGuaranteePin(req: HttpRequest) {
    try {
      return { status: 200, body: await this.service.setGuaranteePin(req.user as any, req.body) }
    } catch (e: any) {
      return { status: 400, body: { error: e.message } }
    }
  }

  async getGuaranteeHasPin(req: HttpRequest) {
    try {
      return { status: 200, body: await this.service.getGuaranteeHasPin(req.user as any) }
    } catch (e: any) {
      return { status: 401, body: { error: e.message } }
    }
  }

  async unlockGuaranteeCard(req: HttpRequest) {
    try {
      return { status: 200, body: await this.service.unlockGuaranteeCard(req.params.id, req.user as any, req.body) }
    } catch (e: any) {
      if (e.name === 'NotFoundError') return { status: 404, body: { error: e.message } }
      if (e.name === 'AuthError') return { status: 403, body: { error: e.message } }
      if (e.name === 'ForbiddenError') return { status: 403, body: { error: e.message } }
      return { status: 400, body: { error: e.message } }
    }
  }

  // ── BOOKING ENGINE DASHBOARD ──────────────────────────────────────────
  async getBookingEngineDashboard(req: HttpRequest) {
    try {
      return { status: 200, body: await this.service.getBookingEngineDashboard(req.user as any) }
    } catch (e: any) {
      return { status: 500, body: { error: e.message } }
    }
  }

  // ── SEND LOCK CODE EMAIL (botón "Enviar código por email" del planning) ──
  async sendLockCodeEmail(req: HttpRequest) {
    try {
      const result = await this.service.sendLockCodeEmail(req.params.id, req.user as any, { orm: this.orm })
      return { status: 200, body: { success: true, sentTo: result.sentTo } }
    } catch (e: any) {
      if (e.name === 'NotFoundError') return { status: 404, body: { error: e.message } }
      if (e.name === 'ValidationError') return { status: 400, body: { error: e.message } }
      if (e.name === 'AuthError' || e.name === 'ForbiddenError') return { status: 403, body: { error: e.message } }
      return { status: 500, body: { error: e.message } }
    }
  }
}
