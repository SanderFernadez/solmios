// Convierte los videos de limpieza que ya están en el bucket y el navegador no
// puede reproducir (los grabados en HEVC antes de que el servidor convirtiera).
//
//   bun run scripts/transcode-existing-videos.ts            # lista qué haría
//   bun run scripts/transcode-existing-videos.ts --apply    # convierte
//
// Idempotente: saltea lo que ya está en H.264, así que se puede volver a correr.
// Va directo contra Postgres, como el resto de los scripts de mantenimiento.
import { Pool } from 'pg'
import { S3StorageAdapter, s3ConfigFromEnv } from '../src/infrastructure/storage/s3-adapter'
import { probeMp4 } from '../src/modules/housekeeping/usecases/mp4-probe'
import { VideoTranscoder } from '../src/modules/housekeeping/usecases/transcode'
import type { VideoEvidence } from '../src/modules/housekeeping/types'

const APPLY = process.argv.includes('--apply')
const BYTES_PER_MB = 1024 * 1024

const s3cfg = s3ConfigFromEnv()
if (!s3cfg) {
  console.error('Faltan las credenciales de B2 (B2_BUCKET, B2_ENDPOINT, …). Nada que hacer.')
  process.exit(1)
}
const s3 = new S3StorageAdapter(s3cfg)

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

/**
 * Lo mínimo que el conversor necesita del repositorio: escribir el video de una
 * tarea. La columna es JSON, así que se serializa a mano.
 */
const repo = {
  update: async (id: string, patch: { video: VideoEvidence }) => {
    await pool.query('UPDATE housekeeping SET video = $1 WHERE id = $2', [
      JSON.stringify(patch.video),
      id,
    ])
    return {} as never
  },
} as never

const transcoder = new VideoTranscoder(repo, s3, {
  info: (m, meta) => console.log(m, meta),
  error: (m, meta) => console.error(m, meta),
})

const { rows } = await pool.query(
  "SELECT id, video FROM housekeeping WHERE video IS NOT NULL AND video::text <> 'null'",
)
console.log(`Tareas con video: ${rows.length}`)

let convertidos = 0
let saltados = 0
let fallidos = 0

for (const row of rows) {
  const video: VideoEvidence = typeof row.video === 'string' ? JSON.parse(row.video) : row.video
  const short = String(row.id).slice(0, 8)
  if (!video?.path) {
    console.log(`  ✗ ${short} — el registro no tiene path`)
    fallidos++
    continue
  }

  const probe = await probeMp4(s3, video.path)
  if (!probe) {
    console.log(`  ✗ ${short} — el objeto no está en el bucket (${video.path})`)
    fallidos++
    continue
  }
  if (probe.playableInBrowser) {
    console.log(`  · ${short} — ya es ${probe.codec}, se saltea`)
    saltados++
    continue
  }

  const mb = (probe.sizeBytes / BYTES_PER_MB).toFixed(1)
  console.log(`  → ${short} — ${probe.codec} ${probe.width}×${probe.height}, ${mb} MB, ${probe.durationSeconds.toFixed(1)}s`)
  if (!APPLY) continue

  // Se le pasa lo que dice el ARCHIVO, no lo guardado en la tarea: estos videos
  // son anteriores a que se registraran codec y dimensiones.
  const ok = await transcoder.run(String(row.id), {
    ...video,
    codec: probe.codec,
    width: probe.width,
    height: probe.height,
    sizeBytes: probe.sizeBytes,
    playableInBrowser: false,
  })
  if (ok) convertidos++
  else fallidos++
}

console.log(
  APPLY
    ? `\nListo — convertidos: ${convertidos} · ya estaban bien: ${saltados} · fallidos: ${fallidos}`
    : `\nSimulación. Volvé a correr con --apply para convertir. (ya estaban bien: ${saltados})`,
)
await pool.end()
process.exit(0)
