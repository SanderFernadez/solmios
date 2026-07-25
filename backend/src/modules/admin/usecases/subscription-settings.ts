// admin/usecases/subscription-settings.ts — Config global Grupo B/C de PLAN-SUSCRIPCIONES.md
// (recordatorio, gracia, anti-recuperación, tope de descuento manual). Mismo patrón que
// getModuleState/setModuleState (admin/usecases/modules.ts): 1 fila en `configuration`
// (hotelId='platform', key='subscription_settings'), no una tabla nueva.
import type { RepositoryAdapter } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'

export interface SubscriptionSettings {
  reminderDaysBefore: number
  gracePeriodDays: number
  founderChurnBlocksReturn: boolean
  maxManualDiscountPct: number
}

export const DEFAULT_SUBSCRIPTION_SETTINGS: SubscriptionSettings = {
  reminderDaysBefore: 5,
  gracePeriodDays: 5,
  founderChurnBlocksReturn: true,
  maxManualDiscountPct: 100,
}

const SETTINGS_KEY = 'subscription_settings'
const PLATFORM = 'platform'

async function readRaw(configRepo: RepositoryAdapter<any>): Promise<{ row: any; value: Partial<SubscriptionSettings> }> {
  const rows = await configRepo.findMany({ hotelId: PLATFORM, key: SETTINGS_KEY })
  const row = (rows as any[])?.[0]
  const value = row ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) : {}
  return { row, value: value && typeof value === 'object' ? value : {} }
}

export async function getSubscriptionSettings(configRepo: RepositoryAdapter<any>): Promise<SubscriptionSettings> {
  const { value } = await readRaw(configRepo)
  return { ...DEFAULT_SUBSCRIPTION_SETTINGS, ...value }
}

export async function setSubscriptionSettings(
  configRepo: RepositoryAdapter<any>, patch: Partial<SubscriptionSettings>,
): Promise<SubscriptionSettings> {
  const { row, value } = await readRaw(configRepo)
  const next: SubscriptionSettings = { ...DEFAULT_SUBSCRIPTION_SETTINGS, ...value }
  for (const k of Object.keys(DEFAULT_SUBSCRIPTION_SETTINGS) as (keyof SubscriptionSettings)[]) {
    if (patch[k] !== undefined) (next as any)[k] = patch[k]
  }
  if (next.reminderDaysBefore < 0 || next.gracePeriodDays < 0 || next.maxManualDiscountPct < 0 || next.maxManualDiscountPct > 100) {
    throw new ValidationError('Valores fuera de rango: días >= 0, maxManualDiscountPct entre 0 y 100')
  }
  if (row) await configRepo.update(row.id, { value: next })
  else await configRepo.create({ id: crypto.randomUUID(), hotelId: PLATFORM, key: SETTINGS_KEY, value: next })
  return next
}
