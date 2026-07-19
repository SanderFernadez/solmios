// La foto del desperfecto viaja como data URL dentro del JSON.
//
// El handler leía `req.file`, que el router del framework nunca completa: TODA
// subida respondía 400 "Archivo requerido" y no se podía adjuntar una foto a una
// orden desde el panel. Estos casos fijan el contrato para que no vuelva.
import { describe, it, expect } from 'bun:test'
import { MantenimientoController } from '../controller'
import type { MantenimientoService } from '../service'
import type { Logger } from 'arckode-framework'

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function setup() {
  const calls: any[] = []
  const service = {
    addPhoto: async (id: string, file: any, type: string) => {
      calls.push({ id, file, type })
      return { id, photos: [{ url: 'https://bucket/foto.png' }] }
    },
  } as unknown as MantenimientoService
  const logger = { info() {}, error() {} } as unknown as Logger
  return { controller: new MantenimientoController(service, logger), calls }
}

const req = (body: unknown) => ({ user: { id: 'u1', hotelId: 'h1' }, params: { id: 't1' }, body }) as any

describe('MantenimientoController.addPhoto', () => {
  it('acepta la foto como data URL y la decodifica a bytes', async () => {
    const { controller, calls } = setup()
    const res = await controller.addPhoto(req({ photo: PNG_1X1, fileName: 'rota.png', type: 'before' }))
    expect(res.status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(calls[0].file.mimeType).toBe('image/png')
    expect(calls[0].file.originalName).toBe('rota.png')
    expect(calls[0].file.buffer.length).toBeGreaterThan(0)
    expect(calls[0].type).toBe('before')
  })

  it('sin nombre de archivo, inventa uno con la extensión correcta', async () => {
    const { controller, calls } = setup()
    await controller.addPhoto(req({ photo: PNG_1X1, type: 'after' }))
    expect(calls[0].file.originalName).toBe('foto.png')
  })

  it('rechaza algo que no es una data URL', async () => {
    const { controller, calls } = setup()
    const res = await controller.addPhoto(req({ photo: 'https://ejemplo.com/foto.png', type: 'before' }))
    expect(res.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('rechaza un archivo que no es imagen (un PDF no sirve de evidencia)', async () => {
    const { controller, calls } = setup()
    const res = await controller.addPhoto(req({ photo: 'data:application/pdf;base64,JVBERi0=', type: 'before' }))
    expect(res.status).toBe(400)
    expect((res.body as any).error).toContain('imagen')
    expect(calls).toHaveLength(0)
  })
})
