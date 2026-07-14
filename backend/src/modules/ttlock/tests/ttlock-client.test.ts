import { describe, it, expect, afterEach } from 'bun:test'
import { createHash } from 'node:crypto'
import { getAccessToken, addKeyboardPassword, deleteKeyboardPassword } from '../../../services/ttlock-client'

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
})
