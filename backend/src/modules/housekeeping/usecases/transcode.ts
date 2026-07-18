// transcode.ts — Convierte a H.264 el video que el navegador no puede decodificar.
//
// Los teléfonos graban la evidencia en HEVC (H.265): un iPhone lo reproduce sin
// problema, pero Chrome de escritorio NO trae decodificador de H.265 — ni con el
// `<video>` nativo ni por WebCodecs, así que ningún reproductor web lo arregla.
// El supervisor abría la limpieza y veía una pantalla negra, sin siquiera un
// error: el navegador lee el contenedor y la duración, y devuelve 0×0 píxeles.
//
// Por eso la conversión pasa acá. De paso resuelve el otro problema: las
// grabaciones venían a 42 Mbps (~80 MB por 15 s) y las subidas se cortaban a la
// mitad; a 720p el archivo queda en pocos MB.
//
// Corre FUERA del request: la camarera confirma su video y sigue trabajando.
import type { RepositoryAdapter } from 'arckode-framework'
import { unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { HousekeepingDTO, VideoEvidence } from '../types'
import type { S3StorageAdapter } from '../../../infrastructure/storage/s3-adapter'
import { probeMp4 } from './mp4-probe'

/** Alto máximo de salida. 720p alcanza de sobra para verificar una limpieza. */
const TARGET_HEIGHT = 720

/**
 * Calidad constante de x264. 26 da un archivo chico manteniendo legible el
 * detalle (una mancha, una toalla mal puesta), que es para lo que se mira.
 */
const CRF = '26'

/** Tope de duración del proceso. Un video de 15 s tarda segundos; si se va a
 *  minutos es que algo se colgó y no vale la pena retener el proceso. */
const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000

export interface TranscodeLogger {
  info?(msg: string, meta?: unknown): void
  error?(msg: string, meta?: unknown): void
}

export class VideoTranscoder {
  constructor(
    private readonly repo: RepositoryAdapter<HousekeepingDTO>,
    private readonly s3: S3StorageAdapter,
    private readonly logger?: TranscodeLogger,
  ) {}

  /**
   * Dispara la conversión sin bloquear a quien llamó. Devuelve de inmediato:
   * el resultado se ve cuando la tarea se recarga.
   */
  scheduleIfNeeded(taskId: string, video: VideoEvidence): void {
    if (video.playableInBrowser !== false) return
    void this.run(taskId, video).catch((err) => {
      this.logger?.error?.('[transcode] falló', { taskId, err: String(err) })
    })
  }

  /**
   * Convierte y reemplaza el video de la tarea.
   *
   * El original se borra recién al final: si algo falla en el medio, la
   * evidencia sigue estando (sin poder verse en el panel, pero descargable) en
   * vez de desaparecer.
   */
  async run(taskId: string, video: VideoEvidence): Promise<boolean> {
    if (!video.path) return false
    const stamp = `${taskId}-${video.path.split('/').pop() ?? 'video'}`
    const inPath = join(tmpdir(), `hk-in-${stamp}`)
    const outPath = join(tmpdir(), `hk-out-${stamp}.mp4`)

    try {
      await this.mark(taskId, { ...video, transcoding: true })

      const bytes = await this.s3.readAll(video.path)
      if (!bytes?.length) throw new Error('el objeto no está en el bucket')
      await Bun.write(inPath, bytes)

      await this.runFfmpeg(inPath, outPath)

      const out = await Bun.file(outPath).arrayBuffer()
      if (!out.byteLength) throw new Error('ffmpeg no produjo salida')

      // Clave nueva: el original se conserva hasta confirmar que la copia subió.
      const newKey = video.path.replace(/(\.[a-z0-9]+)?$/i, '') + '-web.mp4'
      await this.s3.putAt(newKey, new Uint8Array(out), 'video/mp4')

      const probe = await probeMp4(this.s3, newKey)
      const updated: VideoEvidence = {
        ...video,
        url: this.s3.getUrl(newKey),
        path: newKey,
        mimeType: 'video/mp4',
        sizeBytes: probe?.sizeBytes ?? out.byteLength,
        codec: probe?.codec ?? 'avc1',
        width: probe?.width ?? null,
        height: probe?.height ?? TARGET_HEIGHT,
        durationSeconds: probe?.durationSeconds
          ? Math.round(probe.durationSeconds)
          : video.durationSeconds,
        playableInBrowser: true,
        transcoding: false,
        originalCodec: video.codec ?? null,
      }
      await this.mark(taskId, updated)

      await this.s3.delete(video.path).catch(() => {})
      this.logger?.info?.('[transcode] listo', {
        taskId, de: video.sizeBytes, a: updated.sizeBytes, codec: video.codec,
      })
      return true
    } catch (err) {
      // Se deja el video original marcado como no reproducible: el panel ofrece
      // descargarlo, que es mejor que perderlo o dejarlo "procesando" para siempre.
      await this.mark(taskId, { ...video, transcoding: false }).catch(() => {})
      this.logger?.error?.('[transcode] falló', { taskId, err: String(err) })
      return false
    } finally {
      await unlink(inPath).catch(() => {})
      await unlink(outPath).catch(() => {})
    }
  }

  /**
   * `-movflags +faststart` mueve el índice al principio: sin eso el navegador
   * tiene que bajar el archivo entero antes de mostrar el primer cuadro, que es
   * el otro motivo por el que los videos "se quedaban cargando".
   */
  private async runFfmpeg(inPath: string, outPath: string): Promise<void> {
    const proc = Bun.spawn([
      'ffmpeg', '-y', '-loglevel', 'error',
      '-i', inPath,
      '-vf', `scale=-2:'min(${TARGET_HEIGHT},ih)'`, // no agranda un video ya chico
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', CRF,
      '-pix_fmt', 'yuv420p',                        // compatibilidad amplia
      '-c:a', 'aac', '-b:a', '96k',
      '-movflags', '+faststart',
      outPath,
    ], { stdout: 'pipe', stderr: 'pipe' })

    const timer = setTimeout(() => proc.kill(), FFMPEG_TIMEOUT_MS)
    try {
      const code = await proc.exited
      if (code !== 0) {
        const err = await new Response(proc.stderr).text()
        throw new Error(`ffmpeg salió ${code}: ${err.slice(0, 300)}`)
      }
    } finally {
      clearTimeout(timer)
    }
  }

  private async mark(taskId: string, video: VideoEvidence): Promise<void> {
    await this.repo.update(taskId, { video } as any)
  }
}
