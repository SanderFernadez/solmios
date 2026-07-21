// evidence-retention-cron.ts — Corre la purga de evidencias vencidas por hotel (#326).
//
// Cada corrida, por cada hotel:
//   1) Avisa al admin de las evidencias que están por vencer (aviso previo, regla del issue).
//   2) Borra las que ya vencieron (purgeExpiredEvidence).
//
// El aviso va ANTES del borrado para que el admin/cliente alcance a descargar. Se corre diario;
// no depende de operadores de fecha del repo (portable SQLite/PG).

import {
  purgeExpiredEvidence, isExpired, evidencePaths,
  type EvidenceTask, type RetentionRepo, type RetentionStorage,
} from '../../modules/housekeeping/usecases/evidence-retention'

const MS_PER_DAY = 86_400_000
/** Cuántos días antes del vencimiento se avisa al admin. */
const WARN_DAYS = 3

interface NotifyPort {
  create(
    dto: { hotelId: string; type?: string; title: string; message?: string },
    user: { id: string; role: string; hotelId?: string },
  ): Promise<unknown>
}

export interface EvidenceRetentionResult {
  hotels: number
  tasksPurged: number
  filesDeleted: number
  warned: number
}

/**
 * @param getRetentionDays  días de retención del hotel (0 = nunca borrar). Sale de HousekeepingSettings.
 * @param nowMs             inyectable para test; en prod, Date.now() al momento de correr.
 */
export function createEvidenceRetentionCron(
  orm: { findMany(model: string, filter: Record<string, unknown>): Promise<any[]> },
  resolveModule: (name: string) => any,
  storage: RetentionStorage | undefined,
  getRetentionDays: (hotelId: string) => Promise<number>,
  logger: { info: (...a: any[]) => void; warn: (...a: any[]) => void },
  nowMs: () => number = () => Date.now(),
): () => Promise<EvidenceRetentionResult> {
  return async (): Promise<EvidenceRetentionResult> => {
    const result: EvidenceRetentionResult = { hotels: 0, tasksPurged: 0, filesDeleted: 0, warned: 0 }
    if (!storage) {
      // Sin storage (disco local sin S3) no hay bucket que limpiar; se sale sin ruido.
      return result
    }
    try {
      const hotels = await orm.findMany('Hotels', {})
      const now = nowMs()
      const notificaciones = safeResolve(resolveModule, 'notificaciones') as NotifyPort | null
      const repo: RetentionRepo = {
        findMany: (f) => orm.findMany('Housekeeping', f) as Promise<EvidenceTask[]>,
        update: (id, patch) => updateTask(resolveModule, orm, id, patch),
      }

      for (const hotel of hotels) {
        const hotelId = hotel.id as string
        const retentionDays = await getRetentionDays(hotelId).catch(() => 0)
        if (retentionDays <= 0) continue
        result.hotels++

        // 1) Aviso previo: las que vencen dentro de WARN_DAYS pero todavía no vencieron.
        if (notificaciones) {
          const soon = await countExpiringSoon(orm, hotelId, retentionDays, now)
          if (soon > 0) {
            await notificaciones.create(
              {
                hotelId, type: 'housekeeping',
                title: 'Evidencias por vencer',
                message: `${soon} evidencia(s) de limpieza se eliminarán en los próximos ${WARN_DAYS} días. Descargá lo que necesites conservar.`,
              },
              { id: 'system', role: 'super_admin', hotelId },
            ).catch((e) => logger.warn('evidence-retention: aviso previo falló', e))
            result.warned += soon
          }
        }

        // 2) Purga de lo ya vencido.
        const purged = await purgeExpiredEvidence(repo, storage, hotelId, retentionDays, now, logger)
        result.tasksPurged += purged.tasksPurged
        result.filesDeleted += purged.filesDeleted
      }

      if (result.tasksPurged > 0 || result.warned > 0) {
        logger.info('evidence-retention-cron completado', result)
      }
    } catch (e) {
      logger.warn('evidence-retention-cron falló', e)
    }
    return result
  }
}

function safeResolve(resolveModule: (n: string) => any, name: string): any | null {
  try { return resolveModule(name) } catch { return null }
}

/** Actualiza la tarea de housekeeping vaciando su evidencia, vía el ORM directo (system op). */
async function updateTask(
  _resolveModule: (n: string) => any,
  orm: any,
  id: string,
  patch: Record<string, unknown>,
): Promise<unknown> {
  return orm.update('Housekeeping', id, patch)
}

/** Cuántas evidencias vencen dentro de WARN_DAYS pero AÚN no vencieron (ventana de aviso). */
async function countExpiringSoon(
  orm: { findMany(model: string, filter: Record<string, unknown>): Promise<any[]> },
  hotelId: string,
  retentionDays: number,
  now: number,
): Promise<number> {
  const tasks = (await orm.findMany('Housekeeping', { hotelId })) as EvidenceTask[]
  const warnFrom = now + WARN_DAYS * MS_PER_DAY   // "como si hoy fueran +WARN_DAYS días"
  let count = 0
  for (const t of tasks) {
    if (evidencePaths(t).length === 0) continue
    // vence dentro de la ventana: no vencida hoy, pero sí lo estaría en WARN_DAYS.
    if (!isExpired(t, retentionDays, now) && isExpired(t, retentionDays, warnFrom)) count++
  }
  return count
}
