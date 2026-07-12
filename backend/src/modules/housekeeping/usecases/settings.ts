// settings.ts — Ajustes de housekeeping por hotel (KV en la tabla `configuration`).
//
// Hoy guarda un solo flag: si el supervisor debe tomar una foto para probar que
// está en la habitación al revisar. Vive en `configuration` (no en una tabla
// nueva) para que lo que configura el admin llegue al dispositivo del supervisor,
// igual que las fotos requeridas y el checklist.

import type { RepositoryAdapter } from 'arckode-framework'

export interface HousekeepingSettings {
  /** Si está en true, el supervisor DEBE subir una foto de presencia para revisar. */
  requireSupervisorPhoto: boolean
}

interface ConfigRow {
  id: string
  hotelId: string
  key: string
  value: string
}

const KEY = 'housekeeping_settings'
const DEFAULTS: HousekeepingSettings = { requireSupervisorPhoto: false }

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

  private parse(raw: unknown): HousekeepingSettings {
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
      return {
        requireSupervisorPhoto:
          obj?.requireSupervisorPhoto === true || obj?.requireSupervisorPhoto === 1,
      }
    } catch {
      return { ...DEFAULTS }
    }
  }
}
