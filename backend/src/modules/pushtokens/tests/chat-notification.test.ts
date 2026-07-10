// pushtokens/tests/chat-notification.test.ts — Cómo se lee el aviso en el teléfono.

import { describe, it, expect } from 'bun:test'
import { chatNotificationFor, isTeamRecipient, previewOf } from '../usecases/chat-notification'
import type { ChatPushInput } from '../types'

function input(over: Partial<ChatPushInput> = {}): ChatPushInput {
  return { hotelId: 'h1', fromUserId: 'u1', toUserId: 'u2', text: 'llegué al 302', hasPhoto: false, ...over }
}

describe('previewOf', () => {
  it('muestra el texto del mensaje', () => {
    expect(previewOf(input())).toBe('llegué al 302')
  })

  it('una foto sin epígrafe se anuncia como foto', () => {
    expect(previewOf(input({ text: '', hasPhoto: true }))).toBe('📷 Foto')
  })

  it('un texto en blanco no cuenta como texto', () => {
    expect(previewOf(input({ text: '   ', hasPhoto: true }))).toBe('📷 Foto')
  })

  it('sin texto ni foto, algo hay que decir', () => {
    expect(previewOf(input({ text: '', hasPhoto: false }))).toBe('Nuevo mensaje')
  })
})

describe('isTeamRecipient', () => {
  it('reconoce el canal del equipo', () => {
    expect(isTeamRecipient('team:h1')).toBe(true)
  })

  it('un usuario no es el equipo', () => {
    expect(isTeamRecipient('u2')).toBe(false)
  })
})

describe('chatNotificationFor', () => {
  it('en un chat personal el título es quien escribió', () => {
    const n = chatNotificationFor(input(), 'Camarera Rosa')

    expect(n.title).toBe('Camarera Rosa')
    expect(n.body).toBe('llegué al 302')
    // Tocar el aviso abre el hilo con quien escribió, no con uno mismo.
    expect(n.data).toEqual({ type: 'chat', chatId: 'u1' })
  })

  it('en el canal del equipo el título lo dice', () => {
    const n = chatNotificationFor(input({ toUserId: 'team:h1' }), 'Luis')

    expect(n.title).toBe('Equipo · Luis')
    expect(n.data).toEqual({ type: 'chat', chatId: 'team' })
  })

  it('sin el directorio cableado, el aviso sigue teniendo título', () => {
    expect(chatNotificationFor(input(), '').title).toBe('Nuevo mensaje')
    expect(chatNotificationFor(input({ toUserId: 'team:h1' }), '').title).toBe('Equipo del hotel')
  })
})
