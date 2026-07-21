// settings.ts — Ajustes de housekeeping por hotel (KV en la tabla `configuration`).
//
// Vive en `configuration` (no en una tabla nueva) para que lo que configura el
// admin llegue al dispositivo de la camarera y del supervisor, igual que las
// fotos requeridas y el checklist.

import type { RepositoryAdapter } from 'arckode-framework'

/** Con qué prueba la camarera que TERMINÓ la limpieza. Es excluyente. */
export type CompletionEvidence = 'photos' | 'video'

export const COMPLETION_EVIDENCE: readonly CompletionEvidence[] = ['photos', 'video']

/** Tope duro del video de evidencia. El cliente además corta la grabación acá. */
export const MAX_VIDEO_SECONDS_LIMIT = 120
export const DEFAULT_MAX_VIDEO_SECONDS = 30

/** Retención de evidencias multimedia (fotos/video). 0 = no se borra nunca. Default 35 días (#326). */
export const DEFAULT_EVIDENCE_RETENTION_DAYS = 35
export const MAX_EVIDENCE_RETENTION_DAYS = 3650   // 10 años: tope de sanidad

export interface HousekeepingSettings {
  /** Si está en true, el supervisor DEBE subir una foto de presencia para revisar. */
  requireSupervisorPhoto: boolean

  /**
   * Evidencia de FIN de limpieza: las fotos por área (como siempre) o UN video.
   * Excluyente. La foto de INICIO no la afecta: sigue siendo obligatoria en ambos
   * modos para poder arrancar.
   */
  completionEvidence: CompletionEvidence
  /** Duración máxima del video, en segundos. */
  maxVideoSeconds: number
  /**
   * Días que se conservan las evidencias multimedia antes de borrarse automáticamente (#326).
   * 0 = conservar para siempre (nunca borrar). El borrado toca SOLO el archivo: la tarea,
   * su rating y su historial quedan intactos.
   */
  evidenceRetentionDays: number
}

interface ConfigRow {
  id: string
  hotelId: string
  key: string
  value: string
}

const KEY = 'housekeeping_settings'
const DEFAULTS: HousekeepingSettings = {
  requireSupervisorPhoto: false,
  completionEvidence: 'photos',
  maxVideoSeconds: DEFAULT_MAX_VIDEO_SECONDS,
  evidenceRetentionDays: DEFAULT_EVIDENCE_RETENTION_DAYS,
}

export class HousekeepingSettingsUseCase {
  constructor(private readonly configRepo: RepositoryAdapter<ConfigRow>) {}

  async get(hotelId: string): Promise<HousekeepingSettings> {
    const rows = await this.configRepo.findMany({ hotelId, key: KEY })
    if (rows.length === 0) return { ...DEFAULTS }
    return this.parse(rows[0].value)
  }

  /** Merge parcial: solo pisa los flags que vienen en `patch`. */
  async update(hotelId: string, patch: Partial<HousekeepingSettings>): Promise<HousekeepingSettings> {
    const current = await this.get(hotelId)
    const next: HousekeepingSettings = {
      requireSupervisorPhoto:
        patch.requireSupervisorPhoto ?? current.requireSupervisorPhoto,
      completionEvidence: this.normalizeEvidence(
        patch.completionEvidence ?? current.completionEvidence,
      ),
      maxVideoSeconds: this.normalizeSeconds(
        patch.maxVideoSeconds ?? current.maxVideoSeconds,
      ),
      evidenceRetentionDays: this.normalizeRetentionDays(
        patch.evidenceRetentionDays ?? current.evidenceRetentionDays,
      ),
    }
    const rows = await this.configRepo.findMany({ hotelId, key: KEY })
    const value = JSON.stringify(next)
    if (rows.length > 0) {
      await this.configRepo.update(rows[0].id, { value } as Partial<Omit<ConfigRow, 'id'>>)
    } else {
      await this.configRepo.create({ hotelId, key: KEY, value } as Omit<ConfigRow, 'id'>)
    }
    return next
  }

  private normalizeEvidence(v: unknown): CompletionEvidence {
    return COMPLETION_EVIDENCE.includes(v as CompletionEvidence)
      ? (v as CompletionEvidence)
      : DEFAULTS.completionEvidence
  }

  private normalizeSeconds(v: unknown): number {
    const n = Math.trunc(Number(v))
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_VIDEO_SECONDS
    return Math.min(n, MAX_VIDEO_SECONDS_LIMIT)
  }

  private normalizeRetentionDays(v: unknown): number {
    const n = Math.trunc(Number(v))
    // 0 es válido y significa "no borrar nunca". Negativo o basura → default.
    if (!Number.isFinite(n) || n < 0) return DEFAULT_EVIDENCE_RETENTION_DAYS
    return Math.min(n, MAX_EVIDENCE_RETENTION_DAYS)
  }

  private parse(raw: unknown): HousekeepingSettings {
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
      return {
        requireSupervisorPhoto:
          obj?.requireSupervisorPhoto === true || obj?.requireSupervisorPhoto === 1,
        completionEvidence: this.normalizeEvidence(obj?.completionEvidence),
        maxVideoSeconds: this.normalizeSeconds(
          obj?.maxVideoSeconds ?? DEFAULT_MAX_VIDEO_SECONDS,
        ),
        evidenceRetentionDays: this.normalizeRetentionDays(
          obj?.evidenceRetentionDays ?? DEFAULT_EVIDENCE_RETENTION_DAYS,
        ),
      }
    } catch {
      return { ...DEFAULTS }
    }
  }
}
