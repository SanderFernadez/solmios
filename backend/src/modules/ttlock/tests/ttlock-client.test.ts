import { describe, it, expect, afterEach } from 'bun:test'
import { createHash } from 'node:crypto'
import { getAccessToken, addKeyboardPassword, deleteKeyboardPassword, randomPin } from '../../../services/ttlock-client'

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

/** Captura la última request que el cliente le manda a Sciener. */
function captureFetch(response: any) {
  const seen: { url: string; body: string } = { url: '', body: '' }
  globalThis.fetch = (async (url: any, init: any) => {
    seen.url = String(url)
    seen.body = String(init?.body ?? '')
    return new Response(JSON.stringify(response))
  }) as any
  return seen
}

describe('ttlock-client', () => {
  describe('randomPin — CSPRNG, no Math.random', () => {
    it('siempre son 6 dígitos numéricos (padding incluido)', () => {
      for (let i = 0; i < 5000; i++) {
        const pin = randomPin()
        expect(pin).toMatch(/^[0-9]{6}$/)
      }
    })

    it('el rango es 000000-999999 y cubre los extremos con leading zeros', () => {
      let sawLeadingZero = false
      let min = Infinity
      let max = -Infinity
      for (let i = 0; i < 20000; i++) {
        const pin = randomPin()
        expect(pin).toHaveLength(6)
        const n = Number(pin)
        expect(n).toBeGreaterThanOrEqual(0)
        expect(n).toBeLessThanOrEqual(999999)
        if (pin[0] === '0') sawLeadingZero = true
        if (n < min) min = n
        if (n > max) max = n
      }
      // El PIN es una credencial física: el rango completo incluye 0xxxxx (antes se
      // arrancaba en 100000 con Math.random). Verificamos que el padding preserva 6 dígitos.
      expect(sawLeadingZero).toBe(true)
    })
  })

  describe('getAccessToken', () => {
    it('manda el password como MD5 hex de 32 chars en minúsculas', async () => {
      const seen = captureFetch({ access_token: 'tok', refresh_token: 'ref' })
      await getAccessToken({ clientId: 'cid', clientSecret: 'sec', username: 'u@x.com', password: 'secreto123', region: 'eu' })
      const sent = new URLSearchParams(seen.body).get('password')!
      // La API rechaza el password plano: exige "32 chars, low case, md5 encrypted".
      expect(sent).toBe(createHash('md5').update('secreto123', 'utf8').digest('hex'))
      expect(sent).toMatch(/^[a-f0-9]{32}$/)
      expect(sent).not.toBe('secreto123')
    })

    it('no re-hashea un password que ya viene en MD5', async () => {
      const alreadyMd5 = createHash('md5').update('secreto123', 'utf8').digest('hex')
      const seen = captureFetch({ access_token: 'tok' })
      await getAccessToken({ clientId: 'cid', clientSecret: 'sec', username: 'u@x.com', password: alreadyMd5 })
      expect(new URLSearchParams(seen.body).get('password')).toBe(alreadyMd5)
    })

    it('usa el host de la región pedida', async () => {
      const seen = captureFetch({ access_token: 'tok' })
      await getAccessToken({ clientId: 'cid', clientSecret: 'sec', username: 'u@x.com', password: 'p', region: 'us' })
      expect(seen.url).toContain('api.us.sciener.com')
    })
  })

  describe('addKeyboardPassword', () => {
    it('pega al endpoint que existe (/v3/keyboardPwd/add), no al que da 404', async () => {
      const seen = captureFetch({ errcode: 0, keyboardPwdId: 555 })
      const r = await addKeyboardPassword({ clientId: 'cid', accessToken: 'tok', region: 'eu' }, 123, '654321', 1000, 2000)
      expect(seen.url).toContain('/v3/keyboardPwd/add')
      expect(seen.url).not.toContain('addKeyboardPassword')
      expect(r.keyboardPwdId).toBe('555')
    })

    it('por defecto entrega el PIN por gateway (addType=2), sin bluetooth', async () => {
      const seen = captureFetch({ errcode: 0, keyboardPwdId: 1 })
      await addKeyboardPassword({ clientId: 'cid', accessToken: 'tok' }, 123, '654321', 1000, 2000)
      expect(new URLSearchParams(seen.body).get('addType')).toBe('2')
    })

    it('respeta el addType configurado por el hotel', async () => {
      const seen = captureFetch({ errcode: 0, keyboardPwdId: 1 })
      await addKeyboardPassword({ clientId: 'cid', accessToken: 'tok', addType: 1 }, 123, '654321', 1000, 2000)
      expect(new URLSearchParams(seen.body).get('addType')).toBe('1')
    })

    it('propaga el error de TTLock en vez de fingir éxito', async () => {
      captureFetch({ errcode: 10003, errmsg: 'invalid token' })
      await expect(addKeyboardPassword({ clientId: 'cid', accessToken: 'bad' }, 1, '1', 1, 2)).rejects.toThrow(/TTLock/)
    })
  })

  describe('deleteKeyboardPassword', () => {
    it('borra el PIN en la cerradura física', async () => {
      const seen = captureFetch({ errcode: 0 })
      await deleteKeyboardPassword({ clientId: 'cid', accessToken: 'tok' }, 123, '999')
      const body = new URLSearchParams(seen.body)
      expect(seen.url).toContain('/v3/keyboardPwd/delete')
      expect(body.get('lockId')).toBe('123')
      expect(body.get('keyboardPwdId')).toBe('999')
      expect(body.get('deleteType')).toBe('2')
    })
  })

  // #240 — Reintento con backoff SOLO para fallos transitorios (red / 5xx),
  // nunca para errores permanentes (4xx) ni de negocio (errcode con HTTP 200).
  describe('reintento + backoff', () => {
    /** fetch que falla las primeras `failFirst` veces (throw/5xx) y luego responde OK. */
    function flakyFetch(mode: 'throw' | '5xx', failFirst: number, ok: any) {
      let calls = 0
      globalThis.fetch = (async () => {
        calls++
        if (calls <= failFirst) {
          if (mode === 'throw') throw new Error('ECONNRESET')
          return new Response('upstream down', { status: 503 })
        }
        return new Response(JSON.stringify(ok))
      }) as any
      return () => calls
    }

    it('reintenta ante caída de red (fetch tira) y termina OK al 3er intento', async () => {
      const getCalls = flakyFetch('throw', 2, { errcode: 0, keyboardPwdId: 777 })
      const r = await addKeyboardPassword({ clientId: 'cid', accessToken: 'tok' }, 1, '123456', 1, 2)
      expect(getCalls()).toBe(3)        // 2 fallos + 1 éxito
      expect(r.keyboardPwdId).toBe('777')
    })

    it('reintenta ante HTTP 5xx transitorio y termina OK', async () => {
      const getCalls = flakyFetch('5xx', 2, { errcode: 0, keyboardPwdId: 888 })
      const r = await addKeyboardPassword({ clientId: 'cid', accessToken: 'tok' }, 1, '123456', 1, 2)
      expect(getCalls()).toBe(3)
      expect(r.keyboardPwdId).toBe('888')
    })

    it('agota los reintentos (3) y propaga el error si la red nunca vuelve', async () => {
      const getCalls = flakyFetch('throw', 99, {})
      await expect(addKeyboardPassword({ clientId: 'cid', accessToken: 'tok' }, 1, '1', 1, 2)).rejects.toThrow(/ECONNRESET/)
      expect(getCalls()).toBe(3) // MAX_ATTEMPTS, no infinito
    })

    it('NO reintenta un error de NEGOCIO (errcode con HTTP 200): una sola llamada', async () => {
      let calls = 0
      globalThis.fetch = (async () => { calls++; return new Response(JSON.stringify({ errcode: 10003, errmsg: 'invalid token' })) }) as any
      await expect(addKeyboardPassword({ clientId: 'cid', accessToken: 'bad' }, 1, '1', 1, 2)).rejects.toThrow(/TTLock/)
      expect(calls).toBe(1) // token inválido es permanente: no tiene sentido reintentar
    })

    it('NO reintenta un HTTP 4xx (error de cliente permanente): una sola llamada', async () => {
      let calls = 0
      globalThis.fetch = (async () => { calls++; return new Response(JSON.stringify({ errcode: 0, keyboardPwdId: 1 }), { status: 400 }) }) as any
      await addKeyboardPassword({ clientId: 'cid', accessToken: 'tok' }, 1, '1', 1, 2)
      expect(calls).toBe(1)
    })
  })
})
