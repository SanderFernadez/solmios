// messages/types.ts — DTOs y contrato del módulo (el schema de DB vive en ./model.ts)

export interface MessageDTO {
  id: string
  fromUserId: string
  toUserId: string
  message: string
  photoUrl: string | null
  isRead: boolean
  hotelId: string
  createdAt: string
  updatedAt: string
}

/** Usuario autenticado que envía o lee mensajes. */
export interface MessageUser {
  id: string
  hotelId: string
  role: string
}

export interface SendMessageDTO {
  toUserId: string
  message?: string
  photoUrl?: string | null
}

/**
 * Un mensaje ya resuelto contra el directorio: trae quién lo escribió.
 *
 * En un hilo 1-a-1 el remitente es obvio, pero en el canal del equipo hay N
 * personas hablando y la burbuja necesita nombre y foto. Estos campos NO son
 * columnas: se agregan al leer y nunca se pasan a `create`/`update` (el ORM
 * descarta silenciosamente los campos que no están en el modelo).
 */
export interface MessageWithSender extends MessageDTO {
  senderName: string
  senderAvatar: string | null
  senderRole: string
}

/** Última interacción con cada interlocutor, para la lista de chats. */
export interface Conversation {
  userId: string
  lastMessage: string
  lastPhoto: string | null
  lastTime: string
  isRead: boolean
  direction: 'sent' | 'received'
  /**
   * Cuántos mensajes de este interlocutor siguen sin leer.
   *
   * `isRead` describe SOLO al último mensaje, y por eso no alcanza para contar:
   * si el último lo escribí yo, dice `true` aunque los tres anteriores de la
   * otra persona sigan sin abrirse. El cliente suma este campo para saber
   * cuántos mensajes —no cuántas conversaciones— tiene pendientes.
   */
  unreadCount: number
  /** Nombre del interlocutor, resuelto en el backend. Antes lo cruzaba el
   *  cliente contra un directorio filtrado por hotel y caía a "Usuario". */
  name?: string
  /** Avatar del interlocutor, o null. */
  avatar?: string | null
  /** Rol del interlocutor (para el color del avatar en la app). */
  role?: string
  /** El canal del equipo se pinta distinto y va fijo arriba de la lista. */
  isTeam?: boolean
  /** Quién escribió el último mensaje. Solo útil en el canal del equipo. */
  lastSenderName?: string
}

/** Un compañero de trabajo al que se le puede escribir. Proyección mínima: nunca email ni teléfono. */
export interface ContactDTO {
  id: string
  name: string
  role: string
  /** URL de la foto de perfil, o null si nunca subió una. */
  avatar: string | null
}

/**
 * Puerto hacia el módulo `usuarios`. Lo cablea `connectors/messages-usuarios.ts`.
 * El chat necesita los nombres de sus interlocutores sin depender del permiso `users:view`,
 * que housekeeper/supervisor/maintenance no tienen.
 */
export interface UserDirectory {
  listStaff(hotelId: string): Promise<ContactDTO[]>
  /**
   * Resuelve nombre/avatar/rol de usuarios por id, SIN filtrar por hotel.
   *
   * `listStaff` solo trae al staff del hotel; pero una conversación puede ser
   * con alguien de afuera (el super_admin de la plataforma, que no está
   * scopeado a ningún hotel). Sin esto, esos remitentes salían como "Usuario".
   */
  resolveNames(userIds: string[]): Promise<Map<string, ContactDTO>>
}
