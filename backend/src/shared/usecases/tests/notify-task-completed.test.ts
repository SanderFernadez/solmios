// notify-task-completed.test.ts — Al terminar la limpieza, avisar a quien revisa.

import { describe, it, expect } from 'bun:test'
import { notifyTaskCompleted } from '../notify-task-completed'

const roomsPort = { getById: async () => ({ number: '201' }) }

function hotelWith(users: any[]) {
  return { list: async () => users }
}

describe('notifyTaskCompleted', () => {
  it('avisa a los supervisores del hotel (in-app + push), con habitación y camarera', async () => {
    const sent: any[] = []
    const pushed: any[] = []
    const notif = { create: async (d: any) => { sent.push(d); return d } }
    const push = { notifyUser: async (uid: string, _h: string, n: any) => { pushed.push({ uid, ...n }); return 1 } }
    const users = hotelWith([
      { id: 'sup1', role: 'supervisor', name: 'Supervisora' },
      { id: 'rosa', role: 'housekeeper', name: 'Rosa' },
      { id: 'admin', role: 'hotel_admin', name: 'Dueño' },
    ])

    await notifyTaskCompleted(notif, users, roomsPort, { hotelId: 'h1', roomId: 'r1', staffId: 'rosa' }, push)

    // Solo al supervisor (no al admin ni a la camarera).
    expect(sent).toHaveLength(1)
    expect(sent[0].userId).toBe('sup1')
    expect(sent[0].title).toBe('Limpieza lista para revisar')
    expect(sent[0].message).toBe('Habitación 201 terminada · Rosa')
    expect(pushed).toHaveLength(1)
    expect(pushed[0].uid).toBe('sup1')
    expect(pushed[0].data.type).toBe('cleaning_review')
  })

  it('sin supervisores, cae al hotel_admin (el dueño revisa)', async () => {
    const sent: any[] = []
    const notif = { create: async (d: any) => { sent.push(d); return d } }
    const users = hotelWith([
      { id: 'admin', role: 'hotel_admin', name: 'Dueño' },
      { id: 'rosa', role: 'housekeeper', name: 'Rosa' },
    ])

    await notifyTaskCompleted(notif, users, roomsPort, { hotelId: 'h1', roomId: 'r1', staffId: 'rosa' })

    expect(sent).toHaveLength(1)
    expect(sent[0].userId).toBe('admin')
  })

  it('sin nadie que revise, no manda nada', async () => {
    const sent: any[] = []
    const notif = { create: async (d: any) => { sent.push(d); return d } }
    const users = hotelWith([{ id: 'rosa', role: 'housekeeper', name: 'Rosa' }])

    await notifyTaskCompleted(notif, users, roomsPort, { hotelId: 'h1', roomId: 'r1', staffId: 'rosa' })

    expect(sent).toEqual([])
  })

  it('el push que falla no rompe el aviso in-app', async () => {
    const sent: any[] = []
    const notif = { create: async (d: any) => { sent.push(d); return d } }
    const push = { notifyUser: async () => { throw new Error('firebase down') } }
    const users = hotelWith([{ id: 'sup1', role: 'supervisor', name: 'S' }])

    await notifyTaskCompleted(notif, users, roomsPort, { hotelId: 'h1', staffId: 'rosa' }, push as any)

    expect(sent).toHaveLength(1) // el in-app quedó pese al push caído
  })
})
