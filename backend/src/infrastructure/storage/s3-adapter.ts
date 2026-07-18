// s3-adapter.ts — StorageAdapter contra un backend S3-compatible (Backblaze B2).
//
// Usa el cliente S3 NATIVO de Bun (`Bun.S3Client`), NO @aws-sdk/client-s3: el
// SDK de AWS rompe en runtime bajo Bun por la resolución de submódulos @smithy.
// El cliente nativo habla el mismo protocolo S3 y no agrega dependencias.
//
// Implementa la MISMA interfaz que LocalStorageAdapter, así que se swappea sin
// tocar los módulos. Se elige por env en composition-root: con credenciales de
// B2 se usa este; si no, el disco local.
import { S3Client } from 'bun'
import { extname } from 'node:path'
import type { StorageAdapter, FileUpload, StoredFile } from 'arckode-framework/modules/storage'

export interface S3StorageConfig {
  bucket: string
  /** Endpoint S3 del bucket, ej. `https://s3.us-east-005.backblazeb2.com`. */
  endpoint: string
  /** Región, ej. `us-east-005` (sale del endpoint). */
  region: string
  accessKeyId: string
  secretAccessKey: string
  /**
   * Base pública para servir los archivos. Con bucket PÚBLICO (o Cloudflare
   * adelante). Si no se pasa, se arma el virtual-hosted de B2:
   * `https://<bucket>.s3.<region>.backblazeb2.com`. Un bucket PRIVADO no sirve
   * con URL directa — haría falta firmar URLs (presigned), que hoy no se hace.
   */
  publicBaseUrl?: string
}

export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client
  private readonly publicBaseUrl: string

  constructor(cfg: S3StorageConfig) {
    this.client = new S3Client({
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      bucket: cfg.bucket,
      region: cfg.region,
      endpoint: cfg.endpoint,
    })
    const host = cfg.endpoint.replace(/^https?:\/\//, '')
    this.publicBaseUrl = (cfg.publicBaseUrl ?? `https://${cfg.bucket}.${host}`).replace(/\/+$/, '')
  }

  /** Misma convención que el adapter local: `<dir>/<timestamp>-<rand><ext>`. */
  keyFor(directory: string | undefined, originalName: string): string {
    const dir = directory ?? 'general'
    const ext = extname(originalName)
    return `${dir}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  }

  /**
   * URL prefirmada para que el CLIENTE suba el archivo DIRECTO al bucket.
   *
   * Es lo que hace posible subir un video: los archivos hoy viajan como base64
   * dentro del JSON, con tope de 10 MB de body — un video de 30 s no entra ni
   * cerca. Con esto el backend NO toca los bytes: solo firma un permiso temporal
   * y la app hace `PUT` contra Backblaze.
   */
  presignPut(
    key: string,
    opts: { contentType: string; expiresInSeconds?: number },
  ): string {
    return this.client.presign(key, {
      method: 'PUT',
      type: opts.contentType,
      expiresIn: opts.expiresInSeconds ?? 900,
    })
  }

  /**
   * URL firmada temporal para LEER un objeto. La evidencia en video de una
   * habitación no debe ser una URL pública adivinable/compartible: con esto el
   * bucket puede ser PRIVADO y el video se sirve solo a quien pide y por un rato.
   * Funciona igual si el bucket fuera público — por eso se prefiere sobre la URL
   * directa de `getUrl`.
   */
  presignGet(key: string, opts?: { expiresInSeconds?: number }): string {
    return this.client.presign(key, {
      method: 'GET',
      expiresIn: opts?.expiresInSeconds ?? 900,
    })
  }

  /**
   * Tamaño real del objeto en el bucket, o `null` si no existe.
   *
   * Los bytes de un video suben directo del celular a Backblaze, así que el
   * backend nunca los ve: cuando la app dice "ya lo subí", esta es la única
   * forma de comprobar que efectivamente llegó algo.
   */
  async statSize(key: string): Promise<number | null> {
    try {
      const stat = await this.client.stat(key)
      return typeof stat?.size === 'number' ? stat.size : null
    } catch {
      return null // no existe / sin permiso: para el caller es lo mismo
    }
  }

  /**
   * Lee un tramo del objeto sin bajarlo entero. Se usa para leer la cabecera y
   * el índice (`moov`) de un mp4 de decenas de MB moviendo apenas unos KB.
   */
  async readRange(key: string, start: number, end: number): Promise<Uint8Array | null> {
    try {
      const buf = await this.client.file(key).slice(start, end).arrayBuffer()
      return new Uint8Array(buf)
    } catch {
      return null
    }
  }

  async upload(file: FileUpload, directory?: string): Promise<StoredFile> {
    const key = this.keyFor(directory, file.originalName)
    await this.client.write(key, file.buffer, { type: file.mimeType })
    return {
      url: this.getUrl(key),
      path: key,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
    }
  }

  async delete(path: string): Promise<void> {
    // Idempotente: borrar algo que no existe no debe romper el request.
    await this.client.delete(path).catch(() => {})
  }

  getUrl(path: string): string {
    return `${this.publicBaseUrl}/${path}`
  }
}

/**
 * Lee la config de B2 del entorno. Devuelve `null` si falta cualquiera de las
 * variables requeridas → el caller cae al storage local (mismo patrón que
 * `DATABASE_URL` para elegir Postgres vs SQLite).
 */
export function s3ConfigFromEnv(): S3StorageConfig | null {
  const bucket = process.env.B2_BUCKET
  const endpoint = process.env.B2_ENDPOINT
  const region = process.env.B2_REGION
  const accessKeyId = process.env.B2_KEY_ID
  const secretAccessKey = process.env.B2_APP_KEY
  if (!bucket || !endpoint || !region || !accessKeyId || !secretAccessKey) return null
  return {
    bucket,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: process.env.B2_PUBLIC_BASE_URL || undefined,
  }
}
