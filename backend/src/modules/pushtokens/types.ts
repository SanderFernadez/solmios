// pushtokens/types.ts — DTOs y contrato del módulo.
// El schema de DB vive en ./model.ts — son conceptos distintos.

export interface PushTokenDTO {
  id: string
  hotelId: string
  userId: string
  token: string
  platform: string | null
  createdAt: string
  updatedAt: string
}

export interface RegisterPushTokenDTO {
  token: string
  platform?: string
}

/** Usuario autenticado que registra o borra su dispositivo. */
export interface PushUser {
  id: string
  hotelId: string
}

/** Un aviso a mandar al teléfono. `data` viaja como strings: FCM no acepta otra cosa. */
export interface PushNotification {
  title: string
  body: string
  data?: Record<string, string>
}

/**
 * `invalidToken` es lo que contesta FCM cuando la app se desinstaló o el token
 * caducó. Es la única forma de enterarse: hay que borrarlo, o la tabla se llena
 * de tokens muertos a los que se les escribe para siempre.
 */
export type PushSendResult = 'sent' | 'invalidToken' | 'failed'

/**
 * Puerto hacia Firebase. Lo cablea `composition-root`. Sin credenciales queda
 * en `null`: el módulo sigue guardando tokens, simplemente no manda nada.
 */
export interface PushSender {
  send(token: string, notification: PushNotification): Promise<PushSendResult>
}

/**
 * Un mensaje de chat, visto desde acá.
 *
 * Es la forma que tiene `MessageDTO` reducida a lo que hace falta para escribir
 * un aviso. Se declara acá, y no se importa de `messages`, porque un módulo no
 * importa de otro: el connector le pasa el mensaje y encaja por estructura.
 */
export interface ChatPushInput {
  hotelId: string
  fromUserId: string
  toUserId: string
  text: string
  hasPhoto: boolean
}

/**
 * Puerto hacia el módulo `usuarios`: el aviso necesita el nombre de quien
 * escribió, no su id. Lo cablea `connectors/pushtokens-usuarios.ts`.
 */
export interface StaffDirectory {
  nameOf(hotelId: string, userId: string): Promise<string>
}
