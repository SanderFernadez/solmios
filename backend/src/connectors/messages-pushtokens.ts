// connectors/messages-pushtokens.ts — Wire: messages → pushtokens
//
// Cuando alguien manda un mensaje, al destinatario le llega un aviso al teléfono
// aunque tenga la app cerrada. Con la app abierta ya avisaba el vigilante del
// cliente, que pregunta cada 10s; cerrada, no corre nadie.
//
// Ninguno de los dos módulos conoce al otro: `messages` emite `onMessageSent` y
// `pushtokens` sabe qué hacer con un mensaje. Acá solo se los presenta.

import type { ConnectorContext } from 'arckode-framework'
import type { MessageDTO, MessagesSockets } from '../modules/messages'
import type { ChatPushInput } from '../modules/pushtokens'

export function messagesPushtokensConnector(ctx: ConnectorContext): void {
  const messages = ctx.resolveModule<{ setSockets: (s: Partial<MessagesSockets>) => void }>('messages')
  const push = ctx.resolveModule<{ notifyChatMessage: (i: ChatPushInput) => Promise<number> }>('pushtokens')
  if (!messages || !push) return

  messages.setSockets({
    onMessageSent: async (message: MessageDTO) => {
      await push.notifyChatMessage({
        hotelId: message.hotelId,
        fromUserId: message.fromUserId,
        toUserId: message.toUserId,
        text: message.message,
        hasPhoto: Boolean(message.photoUrl),
      })
    },
  })
}
