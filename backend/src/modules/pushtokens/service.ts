// pushtokens/service.ts — Facade pública del módulo
// Responsabilidad ÚNICA: guardar los tokens de los teléfonos y avisarles.
// NO sabe de HTTP. NO importa de otros módulos.
//
// Depende de RepositoryAdapter<PushTokenDTO>, no del ORM directamente.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type {
  ChatPushInput,
  PushNotification,
  PushSender,
  PushTokenDTO,
  PushUser,
  RegisterPushTokenDTO,
  StaffDirectory,
} from './types'
import { chatNotificationFor, isTeamRecipient } from './usecases/chat-notification'

export class PushTokensService {
  /** Sin credenciales de Firebase se guardan los tokens pero no se manda nada. */
  private sender: PushSender | null = null

  /** Cableado por `connectors/pushtokens-usuarios.ts`. Ausente = avisos sin nombre. */
  private directory?: StaffDirectory

  constructor(
    private readonly repo: RepositoryAdapter<PushTokenDTO>,
    private readonly logger: Logger,
  ) {}

  setSender(sender: PushSender): void {
    this.sender = sender
  }

  setStaffDirectory(directory: StaffDirectory): void {
    this.directory = directory
  }

  get enabled(): boolean {
    return this.sender !== null
  }

  /**
   * Un mensaje de chat, en la pantalla bloqueada de quien lo recibe.
   *
   * Al canal del equipo le llega todo el hotel menos quien escribió; a un chat
   * personal, solo el destinatario.
   */
  async notifyChatMessage(input: ChatPushInput): Promise<number> {
    if (!this.enabled) return 0

    const senderName = await this.nameOf(input.hotelId, input.fromUserId)
    const notification = chatNotificationFor(input, senderName)

    if (isTeamRecipient(input.toUserId)) {
      return this.notifyHotel(input.hotelId, notification, input.fromUserId)
    }
    return this.notifyUser(input.toUserId, input.hotelId, notification)
  }

  private async nameOf(hotelId: string, userId: string): Promise<string> {
    if (!this.directory) return ''
    try {
      return await this.directory.nameOf(hotelId, userId)
    } catch {
      return ''
    }
  }

  /**
   * Guarda el token de este teléfono para este usuario.
   *
   * Se busca por token, no por usuario. Si el teléfono ya estaba registrado a
   * nombre de otro —el turno anterior cerró sesión y entró otra persona— el
   * token pasa de dueño: si no, la camarera de la mañana recibiría los mensajes
   * de la noche.
   */
  async register(dto: RegisterPushTokenDTO, user: PushUser): Promise<PushTokenDTO> {
    const platform = dto.platform ?? null
    const [existing] = await this.repo.findMany({ token: dto.token })

    if (existing) {
      if (existing.userId === user.id && existing.hotelId === user.hotelId) return existing
      this.logger.info('Token de push cambia de dueño', { from: existing.userId, to: user.id })
      const updated = await this.repo.update(existing.id, {
        userId: user.id,
        hotelId: user.hotelId,
        platform,
      } as Partial<Omit<PushTokenDTO, 'id'>>)
      return updated ?? existing
    }

    this.logger.info('Registrando token de push', { userId: user.id, platform })
    return this.repo.create({
      hotelId: user.hotelId,
      userId: user.id,
      token: dto.token,
      platform,
    } as Omit<PushTokenDTO, 'id'>)
  }

  /** Al cerrar sesión. Solo el dueño borra su token. */
  async unregister(token: string, user: PushUser): Promise<void> {
    const rows = await this.repo.findMany({ token })
    for (const row of rows) {
      if (row.userId !== user.id) continue
      await this.repo.delete(row.id)
    }
  }

  /**
   * Avisa a todos los teléfonos de una persona.
   *
   * Los fallos NO se propagan: que Firebase esté caído no puede tumbar el envío
   * de un mensaje de chat, que ya está guardado. Los tokens que FCM rechaza por
   * muertos se borran acá mismo.
   */
  async notifyUser(userId: string, hotelId: string, notification: PushNotification): Promise<number> {
    const sender = this.sender
    if (!sender) return 0

    const rows = await this.repo.findMany({ userId, hotelId })
    let delivered = 0

    for (const row of rows) {
      try {
        const result = await sender.send(row.token, notification)
        if (result === 'sent') delivered++
        if (result === 'invalidToken') {
          this.logger.info('Token de push muerto, se borra', { userId })
          await this.repo.delete(row.id)
        }
      } catch (error) {
        this.logger.warn('No se pudo mandar el push', { userId, error: String(error) })
      }
    }
    return delivered
  }

  /** El canal del equipo: le llega a todo el hotel menos a quien escribió. */
  async notifyHotel(
    hotelId: string,
    notification: PushNotification,
    exceptUserId?: string,
  ): Promise<number> {
    if (!this.sender) return 0

    const rows = await this.repo.findMany({ hotelId })
    const userIds = [...new Set(rows.map((r) => r.userId))].filter((id) => id !== exceptUserId)

    let delivered = 0
    for (const userId of userIds) {
      delivered += await this.notifyUser(userId, hotelId, notification)
    }
    return delivered
  }
}
