// messages/usecases/team-channel.ts — El chat del equipo, sin tabla de conversaciones.
//
// Cada hotel tiene UN canal de equipo. En vez de introducir `conversations` +
// `conversation_members`, un mensaje al grupo se guarda con un destinatario
// sentinel: `team:<hotelId>`. La tabla `messages` sigue siendo 1-a-1 y el
// filtro por `hotelId` que ya existe sigue siendo la frontera multi-tenant.
//
// El cliente NUNCA manda el hotelId: manda el alias `team` y el servidor lo
// resuelve contra el token. Así no hay forma de escribir en el grupo de otro hotel.

/** Lo que el cliente escribe en `toUserId` para hablarle al equipo. */
export const TEAM_ALIAS = 'team'

const TEAM_PREFIX = 'team:'

/** El `toUserId` real que se persiste para el canal de un hotel. */
export function teamIdFor(hotelId: string): string {
  return `${TEAM_PREFIX}${hotelId}`
}

/** ¿Este `toUserId` almacenado corresponde a un canal de equipo? */
export function isTeamId(toUserId: string): boolean {
  return toUserId.startsWith(TEAM_PREFIX)
}

/**
 * Traduce el destinatario que llega del cliente al que se persiste.
 *
 * `team` → `team:<hotelId del token>`. Cualquier otra cosa se devuelve tal cual:
 * es el id de un usuario y el service ya lo valida contra el hotel.
 */
export function resolveRecipient(toUserId: string, hotelId: string): string {
  return toUserId === TEAM_ALIAS ? teamIdFor(hotelId) : toUserId
}
