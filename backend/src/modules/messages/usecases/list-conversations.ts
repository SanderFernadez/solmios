// messages/usecases/list-conversations.ts — La lista de chats de un usuario.
//
// Última conversación por interlocutor (con nombre resuelto y no leídos), más el
// canal del equipo si tiene mensajes. Extraído del service para no volverlo un
// God Object.

import type { RepositoryAdapter } from 'arckode-framework'
import type { Conversation, ContactDTO, MessageDTO, MessageUser, UserDirectory } from '../types'
import { TEAM_ALIAS, isTeamId, teamIdFor } from './team-channel'
import { teamUnreadFor, type ReadMarker } from './team-reads'

const byCreatedAtAsc = (a: MessageDTO, b: MessageDTO) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()

export async function listConversations(
  repo: RepositoryAdapter<MessageDTO>,
  directory: UserDirectory | undefined,
  readsRepo: RepositoryAdapter<ReadMarker> | undefined,
  currentUser: MessageUser,
): Promise<Conversation[]> {
  const teamId = teamIdFor(currentUser.hotelId)
  const [sent, received, team] = await Promise.all([
    repo.findMany({ hotelId: currentUser.hotelId, fromUserId: currentUser.id }),
    repo.findMany({ hotelId: currentUser.hotelId, toUserId: currentUser.id }),
    repo.findMany({ hotelId: currentUser.hotelId, toUserId: teamId }),
  ])

  // Última interacción por interlocutor. Los que yo mandé al equipo salen en
  // `sent`: agruparlos por interlocutor los mezclaría con los chats personales.
  const byUser = new Map<string, MessageDTO>()
  for (const msg of [...sent.filter((m) => !isTeamId(m.toUserId)), ...received]) {
    const otherId = msg.fromUserId === currentUser.id ? msg.toUserId : msg.fromUserId
    const existing = byUser.get(otherId)
    if (!existing || new Date(msg.createdAt) > new Date(existing.createdAt)) byUser.set(otherId, msg)
  }

  // Pendientes: los que me mandaron y no abrí, uno por uno.
  const unreadByUser = new Map<string, number>()
  for (const msg of received) {
    if (msg.isRead) continue
    unreadByUser.set(msg.fromUserId, (unreadByUser.get(msg.fromUserId) ?? 0) + 1)
  }

  // El nombre del interlocutor lo resuelve el backend (sin filtrar por hotel):
  // así un remitente de otro hotel —el super_admin— no cae a "Usuario".
  const names = await directory?.resolveNames([...byUser.keys()]) ?? new Map<string, ContactDTO>()

  const direct: Conversation[] = Array.from(byUser.entries()).map(([userId, lastMsg]) => ({
    userId,
    lastMessage: lastMsg.message,
    lastPhoto: lastMsg.photoUrl,
    lastTime: lastMsg.createdAt,
    isRead: lastMsg.isRead,
    direction: lastMsg.fromUserId === currentUser.id ? 'sent' : 'received',
    unreadCount: unreadByUser.get(userId) ?? 0,
    name: names.get(userId)?.name ?? '',
    avatar: names.get(userId)?.avatar ?? null,
    role: names.get(userId)?.role ?? '',
  }))

  if (team.length === 0) return direct

  const lastTeam = [...team].sort(byCreatedAtAsc).at(-1)!
  const teamNames = await directory?.resolveNames([lastTeam.fromUserId]) ?? new Map<string, ContactDTO>()
  // No leídos reales del grupo: mensajes ajenos posteriores a la última vez que
  // este usuario lo abrió. Antes era 0 fijo, así que abrirlo no bajaba nada.
  const teamUnread = await teamUnreadFor(readsRepo, currentUser, team)
  return [
    {
      userId: TEAM_ALIAS,
      lastMessage: lastTeam.message,
      lastPhoto: lastTeam.photoUrl,
      lastTime: lastTeam.createdAt,
      isRead: teamUnread === 0,
      unreadCount: teamUnread,
      direction: lastTeam.fromUserId === currentUser.id ? 'sent' : 'received',
      isTeam: true,
      lastSenderName: teamNames.get(lastTeam.fromUserId)?.name ?? '',
    },
    ...direct,
  ]
}
