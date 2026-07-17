// canales/tests/channex-admin.test.ts — Config Channex a nivel plataforma (white-label).
// Invariantes: la API key NUNCA sale cruda (se enmascara); guardar con apiKey vacío NO borra la
// existente (solo cambia el entorno); el entorno se normaliza a staging|production.

import { describe, it, expect } from 'bun:test'
import { ChannexAdminService } from '../service-channex-admin'

/** ConfigUseCase falso con estado en memoria para getPlatformChannex/setPlatformChannex. */
function fakeConfig(initial: { apiKey?: string; environment?: string } | null = null) {
  let store = initial ? { ...initial } : null
  return {
    getPlatformChannex: async () => store,
    setPlatformChannex: async (patch: any) => { store = { ...(store || {}), ...patch } },
    _dump: () => store,
  } as any
}

const fakeChannex = { testApiKey: async () => ({ success: true, message: 'ok', environment: 'staging' }) } as any

describe('ChannexAdminService', () => {
  it('getStatus enmascara la key y nunca la devuelve cruda', async () => {
    const svc = new ChannexAdminService(fakeConfig({ apiKey: 'abcd1234efgh5678', environment: 'staging' }), fakeChannex)
    const st = await svc.getStatus()
    expect(st.hasKey).toBe(true)
    expect(st.keyMasked).toBe('abcd••••5678')
    expect(JSON.stringify(st)).not.toContain('abcd1234efgh5678')
  })

  it('sin config: hasKey=false y entorno por defecto staging', async () => {
    const svc = new ChannexAdminService(fakeConfig(null), fakeChannex)
    const st = await svc.getStatus()
    expect(st).toEqual({ environment: 'staging', hasKey: false, keyMasked: '' })
  })

  it('save con apiKey vacío NO borra la key existente (solo cambia entorno)', async () => {
    const cfg = fakeConfig({ apiKey: 'secretkey123456', environment: 'staging' })
    const svc = new ChannexAdminService(cfg, fakeChannex)
    const st = await svc.save({ apiKey: '', environment: 'production' })
    expect(st.hasKey).toBe(true)
    expect(st.environment).toBe('production')
    expect(cfg._dump().apiKey).toBe('secretkey123456') // intacta
  })

  it('save con apiKey nueva la reemplaza y la recorta', async () => {
    const cfg = fakeConfig(null)
    const svc = new ChannexAdminService(cfg, fakeChannex)
    await svc.save({ apiKey: '  newkeyABCDEFGH  ', environment: 'staging' })
    expect(cfg._dump().apiKey).toBe('newkeyABCDEFGH')
  })

  it('save ignora un entorno inválido', async () => {
    const cfg = fakeConfig({ apiKey: 'k12345678', environment: 'staging' })
    const svc = new ChannexAdminService(cfg, fakeChannex)
    await svc.save({ environment: 'hackerman' as any })
    expect(cfg._dump().environment).toBe('staging')
  })

  it('test delega en el cliente Channex', async () => {
    const svc = new ChannexAdminService(fakeConfig(null), fakeChannex)
    const r = await svc.test()
    expect(r.success).toBe(true)
  })
})
