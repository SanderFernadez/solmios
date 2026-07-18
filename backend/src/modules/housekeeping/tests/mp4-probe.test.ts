// Verifica que la ficha técnica salga del ARCHIVO y no de lo que declara la app.
// El caso que motivó esto: videos declarados de 15 s cuyo mp4 duraba 0.6 s.
import { describe, it, expect } from 'bun:test'
import { probeMp4 } from '../usecases/mp4-probe'
import type { S3StorageAdapter } from '../../../infrastructure/storage/s3-adapter'

function box(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length)
  new DataView(out.buffer).setUint32(0, out.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(payload, 8)
  return out
}

/** mvhd v0 con la duración expresada como `duration / timescale`. */
function mvhd(durationUnits: number, timescale: number): Uint8Array {
  const p = new Uint8Array(100)
  const dv = new DataView(p.buffer)
  dv.setUint32(0, 0) // version 0 + flags
  dv.setUint32(4, 0) // creation
  dv.setUint32(8, 0) // modification
  dv.setUint32(12, timescale)
  dv.setUint32(16, durationUnits)
  return box('mvhd', p)
}

/** Entrada de muestra de video con su codec y resolución. */
function sampleEntry(codec: string, width: number, height: number): Uint8Array {
  const p = new Uint8Array(70)
  const dv = new DataView(p.buffer)
  // SampleEntry: reserved[6] + dataRefIndex[2] = 8, luego VisualSampleEntry:
  // preDefined[2] + reserved[2] + preDefined[12] = 16. Recién ahí width/height.
  dv.setUint16(24, width)
  dv.setUint16(26, height)
  return box(codec, p)
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

/** mp4 con el `moov` al final, como lo escribe la cámara de un celular. */
function makeMp4(opts: {
  seconds: number
  codec?: string
  width?: number
  height?: number
  mdatBytes?: number
  moovAtStart?: boolean
}): Uint8Array {
  const ftyp = box('ftyp', new TextEncoder().encode('isom' + '\0'.repeat(12)))
  const mdat = box('mdat', new Uint8Array(opts.mdatBytes ?? 1024))
  const moov = box(
    'moov',
    concat(
      mvhd(Math.round(opts.seconds * 600), 600),
      sampleEntry(opts.codec ?? 'avc1', opts.width ?? 1280, opts.height ?? 720),
    ),
  )
  return opts.moovAtStart ? concat(ftyp, moov, mdat) : concat(ftyp, mdat, moov)
}

/** S3 falso que sirve un buffer en memoria por rangos, como Backblaze. */
function fakeS3(file: Uint8Array | null): S3StorageAdapter {
  return {
    statSize: async () => (file ? file.length : null),
    readRange: async (_k: string, start: number, end: number) =>
      file ? file.subarray(start, Math.min(end, file.length)) : null,
  } as unknown as S3StorageAdapter
}

describe('probeMp4', () => {
  it('lee la duración real, el codec y la resolución del archivo', async () => {
    const probe = await probeMp4(fakeS3(makeMp4({ seconds: 15 })), 'p.mp4')
    expect(probe).not.toBeNull()
    expect(probe!.durationSeconds).toBeCloseTo(15, 2)
    expect(probe!.codec).toBe('avc1')
    expect(probe!.width).toBe(1280)
    expect(probe!.height).toBe(720)
    expect(probe!.playableInBrowser).toBe(true)
  })

  it('la grabación cortada delata su duración real, no la declarada', async () => {
    const probe = await probeMp4(fakeS3(makeMp4({ seconds: 0.6 })), 'p.mp4')
    expect(probe!.durationSeconds).toBeCloseTo(0.6, 2)
  })

  it('marca HEVC como no reproducible en el navegador', async () => {
    const probe = await probeMp4(fakeS3(makeMp4({ seconds: 15, codec: 'hvc1' })), 'p.mp4')
    expect(probe!.codec).toBe('hvc1')
    expect(probe!.playableInBrowser).toBe(false)
  })

  it('lee igual el índice esté al principio o al final del archivo', async () => {
    const alPrincipio = await probeMp4(fakeS3(makeMp4({ seconds: 15, moovAtStart: true })), 'p.mp4')
    expect(alPrincipio!.durationSeconds).toBeCloseTo(15, 2)
  })

  it('un objeto que no llegó al bucket devuelve null', async () => {
    expect(await probeMp4(fakeS3(null), 'p.mp4')).toBeNull()
  })

  it('un archivo cortado a la mitad (sin índice) devuelve null', async () => {
    const completo = makeMp4({ seconds: 15, mdatBytes: 4096 })
    const cortado = completo.subarray(0, 2000) // se perdió el moov y parte del mdat
    expect(await probeMp4(fakeS3(cortado), 'p.mp4')).toBeNull()
  })
})
