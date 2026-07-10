// pushtokens/usecases/chat-notification.ts — Cómo se lee un mensaje de chat en
// la pantalla bloqueada del teléfono.
//
// Función pura: recibe el mensaje y el nombre de quien lo escribió, devuelve el
// aviso. Sin repos, sin red, sin Firebase.

import type { ChatPushInput, PushNotification } from '../types'

/** El id del canal grupal del hotel. La convención la fija el módulo `messages`. */
const TEAM_PREFIX = 'team:'

export const isTeamRecipient = (toUserId: string): boolean => toUserId.startsWith(TEAM_PREFIX)

/** Una foto sin epígrafe no dice nada: se anuncia como foto. */
export function previewOf(input: ChatPushInput): string {
  if (input.text.trim().length > 0) return input.text
  return input.hasPhoto ? '📷 Foto' : 'Nuevo mensaje'
}

export function titleFor(input: ChatPushInput, senderName: string): string {
  if (isTeamRecipient(input.toUserId)) {
    return senderName ? `Equipo · ${senderName}` : 'Equipo del hotel'
  }
  return senderName || 'Nuevo mensaje'
}

/**
 * `data` viaja como strings —es lo único que FCM acepta— y le dice a la app qué
 * hilo abrir cuando alguien toca el aviso.
 */
export function chatNotificationFor(input: ChatPushInput, senderName: string): PushNotification {
  return {
    title: titleFor(input, senderName),
    body: previewOf(input),
    data: {
      type: 'chat',
      chatId: isTeamRecipient(input.toUserId) ? 'team' : input.fromUserId,
    },
  }
}
