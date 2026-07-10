// messages/usecases/team-reads.ts — No leídos del canal del equipo.
//
// Los chats 1-a-1 marcan cada mensaje con `isRead`, pero el grupo no puede: un
// mensaje lo leen N personas en momentos distintos. Se guarda "hasta cuándo
// leyó cada uno" (`message_reads`), y los no leídos son los mensajes ajenos
// posteriores a esa marca.

import type { RepositoryAdapter } from 'arckode-framework'
import type { MessageDTO, MessageUser } from '../types'

/** Marca de "último leído" de un usuario en un canal. Ver `MessageReadsModel`. */
export interface ReadMarker {
  id: string
  userId: string
  channel: string
  lastReadAt?: string
}

/** El nombre de canal del grupo del hotel en la tabla de lecturas. */
export const TEAM_CHANNEL = 'team'

/**
 * No leídos del grupo para un usuario: mensajes ajenos posteriores a su marca.
 * Sin repo o sin marca previa cuenta todos los ajenos (nunca lo abrió).
 */
export async function teamUnreadFor(
  readsRepo: RepositoryAdapter<ReadMarker> | undefined,
  currentUser: MessageUser,
  teamMessages: MessageDTO[],
): Promise<number> {
  if (!readsRepo) return 0
  const marks = await readsRepo.findMany({
    hotelId: currentUser.hotelId, userId: currentUser.id, channel: TEAM_CHANNEL,
  })
  const lastReadAt = marks[0]?.lastReadAt
  return teamMessages.filter((m) =>
    m.fromUserId !== currentUser.id &&
    (!lastReadAt || new Date(m.createdAt) > new Date(lastReadAt)),
  ).length
}

/** Marca el grupo como leído hasta ahora. Upsert por (hotel, usuario, canal). */
export async function markTeamRead(
  readsRepo: RepositoryAdapter<ReadMarker> | undefined,
  currentUser: MessageUser,
): Promise<void> {
  if (!readsRepo) return
  const now = new Date().toISOString()
  const [existing] = await readsRepo.findMany({
    hotelId: currentUser.hotelId, userId: currentUser.id, channel: TEAM_CHANNEL,
  })
  if (existing) {
    await readsRepo.update(existing.id, { lastReadAt: now } as Partial<ReadMarker>)
  } else {
    await readsRepo.create({
      id: crypto.randomUUID(), hotelId: currentUser.hotelId, userId: currentUser.id,
      channel: TEAM_CHANNEL, lastReadAt: now,
    } as Omit<ReadMarker, 'id'> & { id: string })
  }
}
