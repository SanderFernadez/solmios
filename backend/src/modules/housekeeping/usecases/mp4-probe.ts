// mp4-probe.ts — Lee la ficha técnica REAL de un video que ya está en el bucket.
//
// Por qué existe: los bytes del video no pasan por el backend (la app los sube
// directo a Backblaze con una URL prefirmada) y después la app *dice* cuánto
// dura. Esa palabra no vale: en producción aparecieron videos declarados de 15 s
// cuyo archivo dura 0.6 s — la grabación se cortó y la evidencia quedó vacía,
// pero la tarea figuraba completa igual.
//
// Un mp4 es una lista de "boxes" (tamaño de 4 bytes + tipo de 4 bytes). El
// índice está en el box `moov`, que las cámaras de celular escriben AL FINAL
// (después del `mdat` con los bytes crudos). Leyendo unos pocos KB con range
// requests se saca la duración real, el codec y la resolución, sin bajar los
// 40 MB del archivo.
import type { S3StorageAdapter } from '../../../infrastructure/storage/s3-adapter'

export interface Mp4Probe {
  /** Duración real que declara el índice del archivo, en segundos. */
  durationSeconds: number
  /** Tamaño real del objeto en el bucket. */
  sizeBytes: number
  /** `avc1` (H.264), `hvc1`/`hev1` (HEVC), o null si no se pudo determinar. */
  codec: string | null
  width: number | null
  height: number | null
  /**
   * `false` para HEVC: Chrome y Firefox de escritorio NO decodifican H.265 en
   * mp4, así que el panel muestra un cuadro negro. El video igual se guarda —
   * bloquear la subida dejaría a la camarera sin poder cerrar la habitación por
   * un problema de codec del teléfono.
   */
  playableInBrowser: boolean
}

/** Codecs que el navegador reproduce sin ayuda. */
const BROWSER_CODECS = new Set(['avc1', 'avc3'])

/** Cuánto se lee de una para el índice. Un `moov` de 15 s ronda los 3–7 KB. */
const TAIL_BYTES = 256 * 1024

/** Tope de boxes a recorrer: un mp4 sano tiene 3 o 4 arriba de todo. */
const MAX_TOP_LEVEL_BOXES = 24

const td = new TextDecoder('latin1')

function u32(b: Uint8Array, o: number): number {
  return ((b[o]! << 24) >>> 0) + (b[o + 1]! << 16) + (b[o + 2]! << 8) + b[o + 3]!
}
function u16(b: Uint8Array, o: number): number {
  return (b[o]! << 8) + b[o + 1]!
}
function u64(b: Uint8Array, o: number): number {
  return u32(b, o) * 2 ** 32 + u32(b, o + 4)
}
function boxType(b: Uint8Array, o: number): string {
  return td.decode(b.subarray(o + 4, o + 8))
}

/**
 * Recorre los boxes de arriba de todo hasta dar con el `moov` y se lo trae.
 * Devuelve también si hubo que ir al final del archivo a buscarlo.
 */
async function readMoov(
  s3: S3StorageAdapter,
  path: string,
  size: number,
): Promise<Uint8Array | null> {
  let offset = 0
  for (let i = 0; i < MAX_TOP_LEVEL_BOXES && offset < size; i++) {
    const head = await s3.readRange(path, offset, offset + 16)
    if (!head || head.length < 8) return null

    let boxSize = u32(head, 0)
    const type = boxType(head, 0)
    let headerSize = 8
    if (boxSize === 1) {
      if (head.length < 16) return null
      boxSize = u64(head, 8)
      headerSize = 16
    } else if (boxSize === 0) {
      // "hasta el final del archivo": solo válido en el último box.
      boxSize = size - offset
    }
    // Un box que se pasa del tamaño real = archivo cortado a la mitad.
    if (boxSize < headerSize || offset + boxSize > size) return null

    if (type === 'moov') {
      return s3.readRange(path, offset, offset + Math.min(boxSize, TAIL_BYTES))
    }
    offset += boxSize
  }
  return null
}

/** Duración en segundos desde el `mvhd`, que es el primer hijo del `moov`. */
function durationFromMvhd(moov: Uint8Array): number | null {
  // El mvhd arranca justo después del header del moov (8 bytes).
  for (let o = 8; o + 8 <= moov.length; ) {
    const boxSize = u32(moov, o)
    if (boxSize < 8) return null
    if (boxType(moov, o) === 'mvhd') {
      const version = moov[o + 8]!
      // v0: version+flags(4) creation(4) modification(4) timescale(4) duration(4)
      // v1: version+flags(4) creation(8) modification(8) timescale(4) duration(8)
      const base = o + 8 + 4
      const timescale = version === 1 ? u32(moov, base + 16) : u32(moov, base + 8)
      const duration = version === 1 ? u64(moov, base + 20) : u32(moov, base + 12)
      if (!timescale) return null
      return duration / timescale
    }
    o += boxSize
  }
  return null
}

/**
 * Codec y resolución del track de video. En vez de bajar por toda la jerarquía
 * (trak→mdia→minf→stbl→stsd) se busca la entrada de muestra por su tipo: es
 * inequívoca y sobrevive a variantes de estructura entre teléfonos.
 */
function videoTrackInfo(moov: Uint8Array): Pick<Mp4Probe, 'codec' | 'width' | 'height'> {
  const KNOWN = ['avc1', 'avc3', 'hvc1', 'hev1']
  for (let o = 4; o + 32 <= moov.length; o++) {
    const type = td.decode(moov.subarray(o, o + 4))
    if (!KNOWN.includes(type)) continue
    // VisualSampleEntry, desde el fin del header del box (o+4): reserved[6] +
    // dataRefIndex[2] + preDefined[2] + reserved[2] + preDefined[12] = 24 bytes,
    // y recién ahí width[2] y height[2].
    const width = u16(moov, o + 28)
    const height = u16(moov, o + 30)
    if (width > 0 && height > 0) return { codec: type, width, height }
  }
  return { codec: null, width: null, height: null }
}

/**
 * Ficha técnica del video que está en el bucket. `null` si el objeto no existe,
 * está vacío o no tiene un índice legible — que es exactamente el caso de una
 * subida cortada, y por eso el caller lo trata como "no llegó".
 */
export async function probeMp4(s3: S3StorageAdapter, path: string): Promise<Mp4Probe | null> {
  const sizeBytes = await s3.statSize(path)
  if (!sizeBytes || sizeBytes <= 0) return null

  const moov = await readMoov(s3, path, sizeBytes)
  if (!moov) return null

  const durationSeconds = durationFromMvhd(moov)
  if (durationSeconds === null || !Number.isFinite(durationSeconds)) return null

  const { codec, width, height } = videoTrackInfo(moov)
  return {
    durationSeconds,
    sizeBytes,
    codec,
    width,
    height,
    playableInBrowser: codec ? BROWSER_CODECS.has(codec) : true,
  }
}
