// shared/tests/async-lock.test.ts — DT-11
import { describe, it, expect } from 'bun:test'
import { withLock } from '../utils/async-lock'

describe('withLock (DT-11)', () => {
  it('dos llamadas con la MISMA key se serializan: la segunda arranca recién cuando la primera termina', async () => {
    const order: string[] = []
    const first = withLock('k1', async () => {
      order.push('first-start')
      await new Promise((r) => setTimeout(r, 20))
      order.push('first-end')
      return 'a'
    })
    const second = withLock('k1', async () => {
      order.push('second-start')
      return 'b'
    })
    await Promise.all([first, second])
    expect(order).toEqual(['first-start', 'first-end', 'second-start'])
  })

  it('llamadas con keys DISTINTAS corren en paralelo, sin esperarse entre sí', async () => {
    const order: string[] = []
    const a = withLock('key-a', async () => {
      order.push('a-start')
      await new Promise((r) => setTimeout(r, 20))
      order.push('a-end')
    })
    const b = withLock('key-b', async () => {
      order.push('b-start')
      order.push('b-end')
    })
    await Promise.all([a, b])
    // b (sin espera) termina antes que a (con delay) — no se bloquean por tener key distinta.
    expect(order.indexOf('b-end')).toBeLessThan(order.indexOf('a-end'))
  })

  it('si la primera función rechaza, la segunda igual corre (no queda el lock trabado)', async () => {
    const order: string[] = []
    const first = withLock('k2', async () => {
      order.push('first')
      throw new Error('boom')
    })
    const second = withLock('k2', async () => {
      order.push('second')
      return 'ok'
    })
    await expect(first).rejects.toThrow('boom')
    await expect(second).resolves.toBe('ok')
    expect(order).toEqual(['first', 'second'])
  })

  it('el resultado de cada llamada es el propio, no se mezcla con el de otra en la misma key', async () => {
    const results = await Promise.all([
      withLock('k3', async () => 1),
      withLock('k3', async () => 2),
      withLock('k3', async () => 3),
    ])
    expect(results).toEqual([1, 2, 3])
  })
})
