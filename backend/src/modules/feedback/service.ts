import type { RepositoryAdapter, Logger, Auth } from 'arckode-framework'
import type { FeedbackPinDTO, CreateFeedbackPinDTO, UpdateFeedbackPinDTO } from './types'
import { auditSafely, type AuditPort } from '../../shared/usecases/audit'

export class FeedbackService {
  private auditPort: AuditPort | null = null

  /** Conecta el audit log. Lo inyecta el connector `feedback-auditlog`. */
  setAuditDeps(port: AuditPort): void { this.auditPort = port }

  constructor(
    private readonly pinsRepo: RepositoryAdapter<FeedbackPinDTO>,
    private readonly logger: Logger,
    private readonly auth?: Auth,
  ) {}

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
    const pin = await this.pinsRepo.create({
      ...dto,
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

  // ── GitLab Issue ────────────────────────────────────────────────────────
  async createGitLabIssue(reqBody: any, user: any): Promise<any> {
    const { screenshot, filename, comment, route, x, y, browser, viewportWidth, viewportHeight } = reqBody
    const GITLAB_TOKEN = process.env.GITLAB_TOKEN
    const GITLAB_PROJECT_ID = process.env.GITLAB_PROJECT_ID
    if (!GITLAB_TOKEN || !GITLAB_PROJECT_ID) throw new Error('GitLab no configurado en el servidor')
    if (!comment) throw new Error('Comentario requerido')

    const GITLAB_API = `https://gitlab.com/api/v4/projects/${encodeURIComponent(GITLAB_PROJECT_ID)}`

    // Screenshot es opcional
    let imgMarkdown = ''
    if (screenshot && screenshot.includes(',')) {
      try {
        const imgBase64 = screenshot.split(',')[1]
        if (imgBase64) {
          const imgBuffer = Buffer.from(imgBase64, 'base64')
          const formData = new FormData()
          const blob = new Blob([imgBuffer], { type: 'image/png' })
          formData.append('file', blob, filename || `feedback-${Date.now()}.png`)
          const uploadRes = await fetch(`${GITLAB_API}/uploads`, {
            method: 'POST', headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN }, body: formData,
          })
          if (uploadRes.ok) {
            const uploadData = (await uploadRes.json()) as any
            imgMarkdown = uploadData.markdown || `![screenshot](${uploadData.url})`
          }
        }
      } catch (e) {
        this.logger.warn('Screenshot upload failed, continuing without image', { error: (e as Error).message })
      }
    }

    const title = `[Feedback] ${comment.length > 72 ? comment.slice(0, 72) + '…' : comment}`
    const descriptionParts = [
      '## 📝 Detalles del Feedback', '',
      '| Campo | Valor |', '|-------|-------|',
      `| **Comentario** | ${comment} |`,
      `| **Ruta** | \`${route}\` |`,
      `| **Coordenadas** | (${x}, ${y}) |`,
      `| **Browser** | ${browser} |`,
      `| **Viewport** | ${viewportWidth}×${viewportHeight} |`,
      `| **Usuario** | ${user?.email || 'desconocido'} |`,
      `| **Timestamp** | ${new Date().toISOString()} |`,
    ]
    if (imgMarkdown) {
      descriptionParts.splice(1, 0, '', '## 📸 Screenshot', '', imgMarkdown, '', '---')
    }
    const description = descriptionParts.join('\n')

    const issueRes = await fetch(`${GITLAB_API}/issues`, {
      method: 'POST', headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, labels: 'feedback' }),
    })
    if (!issueRes.ok) { const errText = await issueRes.text(); throw new Error(`Error al crear issue: ${errText}`) }
    const issueData = (await issueRes.json()) as any
    this.logger.info('GitLab issue creado desde feedback', { issueUrl: issueData.web_url, route })
    return { issueUrl: issueData.web_url, issueId: issueData.iid, title: issueData.title }
  }
}
