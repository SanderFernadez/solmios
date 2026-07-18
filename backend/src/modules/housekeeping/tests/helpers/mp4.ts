// Constructor de mp4 mínimos para los tests: ftyp + mdat + moov(mvhd + sample
// entry), con el índice al final como lo escribe la cámara de un celular.
export function box(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length)
  new DataView(out.buffer).setUint32(0, out.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(payload, 8)
  return out
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

function mvhd(seconds: number): Uint8Array {
  const p = new Uint8Array(100)
  const dv = new DataView(p.buffer)
  dv.setUint32(12, 600) // timescale
  dv.setUint32(16, Math.round(seconds * 600)) // duration
  return box('mvhd', p)
}

function sampleEntry(codec: string, width: number, height: number): Uint8Array {
  const p = new Uint8Array(70)
  const dv = new DataView(p.buffer)
  dv.setUint16(24, width)
  dv.setUint16(26, height)
  return box(codec, p)
}

export function makeMp4(opts: {
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
    concat(mvhd(opts.seconds), sampleEntry(opts.codec ?? 'avc1', opts.width ?? 1280, opts.height ?? 720)),
  )
  return opts.moovAtStart ? concat(ftyp, moov, mdat) : concat(ftyp, mdat, moov)
}

/** S3 falso que sirve un buffer en memoria por rangos, como Backblaze. */
export function fakeS3(file: Uint8Array | null): any {
  return {
    statSize: async () => (file ? file.length : null),
    readRange: async (_k: string, start: number, end: number) =>
      file ? file.subarray(start, Math.min(end, file.length)) : null,
    presignGet: (p: string) => `signed://${p}`,
  }
}
