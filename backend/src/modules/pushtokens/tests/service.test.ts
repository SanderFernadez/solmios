// pushtokens/tests/service.test.ts — Tests del servicio
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { PushTokensService } from '../service'
import type { PushNotification, PushSendResult, PushTokenDTO, PushUser } from '../types'

// silentLogger es una factory function — SIEMPRE llamarla con ()
const log = silentLogger()

const rosa: PushUser = { id: 'u1', hotelId: 'h1' }
const carlos: PushUser = { id: 'u2', hotelId: 'h1' }

function row(over: Partial<PushTokenDTO>): PushTokenDTO {
  return {
    id: 'p1', hotelId: 'h1', userId: 'u1', token: 'tok-1', platform: 'android',
    createdAt: '', updatedAt: '', ...over,
  }
}

/** Repo en memoria que respeta los filtros exactos, como el ORM real. */
function repoWith(rows: PushTokenDTO[]) {
  const store = [...rows]
  const deleted: string[] = []
  const created: any[] = []
  const updated: any[] = []

  const repo = {
    findMany: async (f: any) =>
      store.filter((r) => Object.entries(f ?? {}).every(([k, v]) => (r as any)[k] === v)),
    findById: async (id: string) => store.find((r) => r.id === id) ?? null,
    create: async (d: any) => {
      const r = row({ id: `new-${created.length}`, ...d })
      created.push(r)
      store.push(r)
      return r
    },
    update: async (id: string, d: any) => {
      const i = store.findIndex((r) => r.id === id)
      if (i < 0) return null
      store[i] = { ...store[i], ...d }
      updated.push({ id, ...d })
      return store[i]
    },
    delete: async (id: string) => {
      deleted.push(id)
      const i = store.findIndex((r) => r.id === id)
      if (i >= 0) store.splice(i, 1)
      return true
    },
  } as unknown as RepositoryAdapter<PushTokenDTO>

  return { repo, deleted, created, updated }
}

/** Sender de mentira: contesta lo que se le diga y anota a quién le escribió. */
function senderThat(reply: (token: string) => PushSendResult) {
  const sent: Array<{ token: string; notification: PushNotification }> = []
  return {
    sent,
    sender: {
      send: async (token: string, notification: PushNotification) => {
        sent.push({ token, notification })
        return reply(token)
      },
    },
  }
}

const aviso: PushNotification = { title: 'Rosa', body: 'llegué al 302' }

describe('PushTokensService.register', () => {
  it('guarda el token de un teléfono nuevo', async () => {
    const { repo, created } = repoWith([])
    const svc = new PushTokensService(repo, log)

    await svc.register({ token: 'tok-9', platform: 'android' }, rosa)

    expect(created[0]).toMatchObject({ userId: 'u1', hotelId: 'h1', token: 'tok-9', platform: 'android' })
  })

  it('no duplica si el mismo usuario vuelve a registrar el mismo token', async () => {
    const { repo, created } = repoWith([row({ token: 'tok-1', userId: 'u1' })])
    const svc = new PushTokensService(repo, log)

    await svc.register({ token: 'tok-1' }, rosa)

    expect(created).toHaveLength(0)
  })

  // El turno noche cierra sesión y entra la camarera de la mañana en el MISMO
  // teléfono: si el token siguiera a nombre del anterior, le llegarían sus avisos.
  it('el token cambia de dueño cuando entra otra persona en el mismo teléfono', async () => {
    const { repo, updated, created } = repoWith([row({ id: 'p1', token: 'tok-1', userId: 'u1' })])
    const svc = new PushTokensService(repo, log)

    await svc.register({ token: 'tok-1' }, carlos)

    expect(created).toHaveLength(0)
    expect(updated[0]).toMatchObject({ id: 'p1', userId: 'u2' })
  })

  // SEGURIDAD cross-tenant: un usuario de OTRO hotel que conoce el token opaco NO
  // puede robárselo reasignándolo a su hotelId. El token ajeno es invisible acá.
  it('nunca reasigna un token que pertenece a otro hotel', async () => {
    const attacker: PushUser = { id: 'evil', hotelId: 'h2' }
    const { repo, updated, created } = repoWith([row({ id: 'p1', token: 'tok-1', userId: 'u1', hotelId: 'h1' })])
    const svc = new PushTokensService(repo, log)

    await svc.register({ token: 'tok-1' }, attacker)

    // La fila original de h1 queda intacta...
    expect(updated).toHaveLength(0)
    // ...y el token se registra como NUEVO, scoped al hotel del atacante (nunca cruza tenants).
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ token: 'tok-1', userId: 'evil', hotelId: 'h2' })
  })

  it('sin platform lo guarda en null, no lo inventa', async () => {
    const { repo, created } = repoWith([])
    const svc = new PushTokensService(repo, log)

    await svc.register({ token: 'tok-9' }, rosa)

    expect(created[0].platform).toBeNull()
  })
})

describe('PushTokensService.unregister', () => {
  it('borra el token propio', async () => {
    const { repo, deleted } = repoWith([row({ id: 'p1', token: 'tok-1', userId: 'u1' })])
    await new PushTokensService(repo, log).unregister('tok-1', rosa)

    expect(deleted).toEqual(['p1'])
  })

  it('nunca borra el token de otro', async () => {
    const { repo, deleted } = repoWith([row({ id: 'p1', token: 'tok-1', userId: 'u2' })])
    await new PushTokensService(repo, log).unregister('tok-1', rosa)

    expect(deleted).toEqual([])
  })
})

describe('PushTokensService.notifyUser', () => {
  it('sin credenciales de Firebase no manda nada, y no explota', async () => {
    const { repo } = repoWith([row({ userId: 'u1' })])
    const svc = new PushTokensService(repo, log)

    expect(svc.enabled).toBe(false)
    expect(await svc.notifyUser('u1', 'h1', aviso)).toBe(0)
  })

  it('le escribe a todos los teléfonos de la persona', async () => {
    const { repo } = repoWith([
      row({ id: 'p1', token: 'tok-1', userId: 'u1' }),
      row({ id: 'p2', token: 'tok-2', userId: 'u1' }),
      row({ id: 'p3', token: 'tok-3', userId: 'u2' }),
    ])
    const { sender, sent } = senderThat(() => 'sent')
    const svc = new PushTokensService(repo, log)
    svc.setSender(sender)

    const delivered = await svc.notifyUser('u1', 'h1', aviso)

    expect(delivered).toBe(2)
    expect(sent.map((s) => s.token)).toEqual(['tok-1', 'tok-2'])
  })

  it('no cruza hoteles', async () => {
    const { repo } = repoWith([row({ token: 'tok-1', userId: 'u1', hotelId: 'h2' })])
    const { sender, sent } = senderThat(() => 'sent')
    const svc = new PushTokensService(repo, log)
    svc.setSender(sender)

    await svc.notifyUser('u1', 'h1', aviso)

    expect(sent).toEqual([])
  })

  // Si no se borran, la tabla se llena de teléfonos que ya no existen.
  it('borra el token que FCM rechaza por muerto', async () => {
    const { repo, deleted } = repoWith([
      row({ id: 'p1', token: 'muerto', userId: 'u1' }),
      row({ id: 'p2', token: 'vivo', userId: 'u1' }),
    ])
    const { sender } = senderThat((t) => (t === 'muerto' ? 'invalidToken' : 'sent'))
    const svc = new PushTokensService(repo, log)
    svc.setSender(sender)

    const delivered = await svc.notifyUser('u1', 'h1', aviso)

    expect(delivered).toBe(1)
    expect(deleted).toEqual(['p1'])
  })

  // El mensaje ya está guardado: que Firebase falle no puede tirar el request.
  it('un error de red no se propaga', async () => {
    const { repo } = repoWith([row({ userId: 'u1' })])
    const svc = new PushTokensService(repo, log)
    svc.setSender({ send: async () => { throw new Error('sin red') } })

    expect(await svc.notifyUser('u1', 'h1', aviso)).toBe(0)
  })
})

describe('PushTokensService.notifyHotel', () => {
  it('le avisa a todo el hotel menos a quien escribió', async () => {
    const { repo } = repoWith([
      row({ id: 'p1', token: 'tok-1', userId: 'u1' }),
      row({ id: 'p2', token: 'tok-2', userId: 'u2' }),
      row({ id: 'p3', token: 'tok-3', userId: 'u3' }),
    ])
    const { sender, sent } = senderThat(() => 'sent')
    const svc = new PushTokensService(repo, log)
    svc.setSender(sender)

    const delivered = await svc.notifyHotel('h1', aviso, 'u1')

    expect(delivered).toBe(2)
    expect(sent.map((s) => s.token).sort()).toEqual(['tok-2', 'tok-3'])
  })

  it('a alguien con dos teléfonos le llega a los dos, y una sola vez por cada uno', async () => {
    const { repo } = repoWith([
      row({ id: 'p1', token: 'tok-1', userId: 'u2' }),
      row({ id: 'p2', token: 'tok-2', userId: 'u2' }),
    ])
    const { sender, sent } = senderThat(() => 'sent')
    const svc = new PushTokensService(repo, log)
    svc.setSender(sender)

    await svc.notifyHotel('h1', aviso, 'u1')

    expect(sent.map((s) => s.token)).toEqual(['tok-1', 'tok-2'])
  })
})
