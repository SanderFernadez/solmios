import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import type { FeedbackPinDTO, CreateFeedbackPinDTO, UpdateFeedbackPinDTO } from './types'
import { auditSafely, type AuditPort } from '../../shared/usecases/audit'
import { createGitHubIssueUsecase } from './usecases/create-github-issue'

export class FeedbackService {
  private auditPort: AuditPort | null = null

  /** Conecta el audit log. Lo inyecta el connector `feedback-auditlog`. */
  setAuditDeps(port: AuditPort): void { this.auditPort = port }

  constructor(
    private readonly pinsRepo: RepositoryAdapter<FeedbackPinDTO>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
    // feedback-user-email: resolver el email del autor del feedback. El JWT (req.user → CurrentUser)
    // solo lleva id/hotelId/role; el email NO viaja en el token → sin esto, TODOS los issues de GitHub
    // salen "Usuario: desconocido" y se pierde la trazabilidad de quién lo envió (bug #632). Mismo
    // patrón que settlement.loadOrder (userRepo.findById). Opcional para no romper módulos sin users.
    private readonly userRepo?: RepositoryAdapter<any>,
  ) {}

  /**
   * feedback-user-email: resuelve el email del autor del feedback. El JWT (req.user → CurrentUser)
   * solo lleva id/hotelId/role; el email NO viaja en el token. Sin esto, `user?.email` es siempre
   * undefined y el issue de GitHub sale "Usuario: desconocido" para todos (#632). Lo busca por id en
   * la tabla users (mismo patrón que settlement.loadOrder). Degrada bien: sin userRepo o si falla la
   * lectura, vuelve a undefined → el caller cae a 'desconocido', pero el feedback NUNCA se pierde.
   */
  private async resolveEmail(user: { id?: string; email?: string } | undefined): Promise<string | undefined> {
    if (user?.email) return user.email
    if (!user?.id || !this.userRepo) return undefined
    try {
      const u = await this.userRepo.findById(user.id)
      return (u as any)?.email ?? undefined
    } catch (e) {
      this.logger.warn('No se pudo resolver el email del autor del feedback', { userId: user?.id, error: (e as Error).message })
      return undefined
    }
  }

  // ── CRUD Feedback Pins ──────────────────────────────────────────────────
  async listPins(hotelId?: string, route?: string): Promise<{ data: FeedbackPinDTO[]; total: number }> {
    const filters: Record<string, any> = {}
    if (hotelId) filters.hotelId = hotelId
    if (route) filters.route = route
    const data = await this.pinsRepo.findMany(filters)
    return { data: data as FeedbackPinDTO[], total: data.length }
  }

  async getPin(id: string, user?: any): Promise<FeedbackPinDTO | null> {
    const pin = (await this.pinsRepo.findById(id)) as FeedbackPinDTO | null
    if (pin && this.auth && user) this.auth.assertOwnership(pin.hotelId ?? '', user.hotelId, user.role, 'super_admin')
    return pin
  }

  async createPin(dto: CreateFeedbackPinDTO): Promise<FeedbackPinDTO> {
    // feedback-user-email: el dto trae userEmail del controller, pero user.email es undefined (el JWT
    // no lleva email). Resolverlo por userId para que el pin registre el autor real, no 'desconocido'.
    const userEmail = dto.userEmail || await this.resolveEmail({ id: dto.userId, email: dto.userEmail })
    const pin = await this.pinsRepo.create({
      ...dto,
      userEmail,
      priority: dto.priority || 'medium',
      category: dto.category || 'UI',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any)
    this.logger.info('Feedback pin creado', { id: pin.id, route: dto.route })
    return pin as FeedbackPinDTO
  }

  async updatePin(id: string, dto: UpdateFeedbackPinDTO, user?: any): Promise<FeedbackPinDTO | null> {
    const existing = (await this.pinsRepo.findById(id)) as FeedbackPinDTO | null
    if (!existing) return null
    if (this.auth && user) this.auth.assertOwnership(existing.hotelId ?? '', user.hotelId, user.role, 'super_admin')
    const updated = await this.pinsRepo.update(id, {
      ...dto,
      updatedAt: new Date().toISOString(),
    } as any)
    return updated as FeedbackPinDTO
  }

  async deletePin(id: string, user?: any): Promise<boolean> {
    const existing = (await this.pinsRepo.findById(id)) as FeedbackPinDTO | null
    if (!existing) return false
    if (this.auth && user) this.auth.assertOwnership(existing.hotelId ?? '', user.hotelId, user.role, 'super_admin')
    const deleted = await this.pinsRepo.delete(id)
    if (deleted) {
      const comment = existing.comment ?? ''
      await auditSafely(this.auditPort, this.logger, {
        hotelId: existing.hotelId, userId: user?.id, action: 'feedback.delete',
        entity: 'feedback_pin', entityId: id,
        detail: `Pin de feedback en ${existing.route} eliminado: "${comment.length > 60 ? `${comment.slice(0, 60)}…` : comment}"`,
      })
    }
    return deleted
  }

  // ── GitHub Issue ────────────────────────────────────────────────────────
  async createGitHubIssue(reqBody: any, user: any): Promise<any> {
    return createGitHubIssueUsecase(
      { pinsRepo: this.pinsRepo, logger: this.logger, auth: this.auth, resolveEmail: (u) => this.resolveEmail(u) },
      reqBody,
      user,
    )
  }
}
