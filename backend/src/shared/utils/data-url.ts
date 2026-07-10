// shared/utils/data-url.ts — Decodifica un data URL base64 a bytes.
//
// La app manda las fotos como `data:image/jpeg;base64,...` en JSON, porque es lo
// que sale de `image_picker` sin armar un multipart a mano.

export interface DecodedDataUrl {
  buffer: Buffer
  mimeType: string
  /** Extensión derivada del mime: `image/jpeg` → `jpeg`. */
  ext: string
}

/** `data:<mime>;base64,<data>` → bytes. `null` si no tiene esa forma. */
export function parseDataUrl(dataUrl: string): DecodedDataUrl | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/s)
  if (!m) return null
  const mimeType = m[1]!
  const buffer = Buffer.from(m[2]!, 'base64')
  const ext = (mimeType.split('/')[1] ?? 'bin').split(';')[0]!
  return { buffer, mimeType, ext }
}

/** ¿Es una imagen? Un avatar que resulta ser un PDF no se puede mostrar. */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}
