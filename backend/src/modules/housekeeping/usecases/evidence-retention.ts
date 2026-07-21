// evidence-retention.ts — Purga de evidencias multimedia vencidas (#326).
//
// Regla: pasados N días desde que la tarea se completó, las fotos/video de evidencia se borran
// del bucket automáticamente. Lo que se elimina es SOLO el archivo — la tarea, su rating, su
// nota y todo su historial quedan intactos: se vacían los campos `photos`/`video` del registro.
//
// El cliente puede descargar la evidencia en cualquier momento antes del vencimiento (ya existe
// el presign GET). Y el admin recibe un aviso previo (ver evidence-retention-cron).
//
// N = 0 significa "conservar para siempre": no se purga nada. Es la salida de emergencia para un
// hotel que necesita guardar la evidencia por obligación legal.

const MS_PER_DAY = 86_400_000

export interface EvidenceTask {
  id: string
  hotelId?: string
  completedDate?: string | null
  createdAt?: string | null
  photos?: Array<{ path?: string }> | null
  video?: { path?: string } | null
}

export interface RetentionRepo {
  findMany(filter: Record<string, unknown>): Promise<EvidenceTask[]>
  update(id: string, patch: Record<string, unknown>): Promise<unknown>
}

export interface RetentionStorage {
  delete(path: string): Promise<void>
}

export interface PurgeResult {
  tasksPurged: number
  filesDeleted: number
}

/** Fecha de referencia de la evidencia: cuándo se completó la tarea (o, si falta, cuándo se creó). */
function evidenceDate(task: EvidenceTask): number | null {
  const raw = task.completedDate || task.createdAt
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

/** Paths de todos los archivos de evidencia de una tarea (fotos + video), sin vacíos. */
export function evidencePaths(task: EvidenceTask): string[] {
  const paths: string[] = []
  for (const p of task.photos ?? []) if (p?.path) paths.push(p.path)
  if (task.video?.path) paths.push(task.video.path)
  return paths
}

/** ¿Venció la evidencia de esta tarea, según los días de retención? (retentionDays 0 = nunca). */
export function isExpired(task: EvidenceTask, retentionDays: number, nowMs: number): boolean {
  if (retentionDays <= 0) return false
  const date = evidenceDate(task)
  if (date === null) return false
  return nowMs - date > retentionDays * MS_PER_DAY
}

/**
 * Purga la evidencia vencida de un hotel. No lanza por un archivo que no se pueda borrar
 * (storage.delete es idempotente); si igual falla, se registra y se sigue con el resto — pero el
 * campo se vacía solo si el borrado no tiró: no queremos declarar "sin archivo" algo que sigue vivo.
 */
export async function purgeExpiredEvidence(
  repo: RetentionRepo,
  storage: RetentionStorage,
  hotelId: string,
  retentionDays: number,
  nowMs: number,
  log?: { warn: (msg: string, e?: unknown) => void },
): Promise<PurgeResult> {
  if (retentionDays <= 0) return { tasksPurged: 0, filesDeleted: 0 }

  // Solo tareas ya completadas/inspeccionadas tienen evidencia. El filtro amplio + isExpired en JS
  // evita depender de operadores de fecha del repo (no portables entre SQLite/PG).
  const tasks = await repo.findMany({ hotelId })
  let tasksPurged = 0
  let filesDeleted = 0

  for (const task of tasks) {
    if (!isExpired(task, retentionDays, nowMs)) continue
    const paths = evidencePaths(task)
    if (paths.length === 0) continue

    let ok = true
    for (const path of paths) {
      try {
        await storage.delete(path)
        filesDeleted++
      } catch (e) {
        ok = false
        log?.warn?.(`No se pudo borrar la evidencia ${path} de la tarea ${task.id}`, e)
      }
    }
    // Se vacían los campos SOLO si todo se borró: así una purga a medias se reintenta el próximo día.
    if (ok) {
      await repo.update(task.id, { photos: [], video: null })
      tasksPurged++
    }
  }

  return { tasksPurged, filesDeleted }
}
