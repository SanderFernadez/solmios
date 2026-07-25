// referrals/usecases/program-settings.ts — Config global del programa (PLAN-REFERIDOS.md §2).
// Mismo patrón que admin/usecases/subscription-settings.ts: 1 fila en `configuration`
// (hotelId='platform', key='referral_program'), no una tabla nueva.
import type { RepositoryAdapter } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import type { ReferralProgram } from '../types'

export const DEFAULT_REFERRAL_PROGRAM: ReferralProgram = {
  enabled: false,
  programName: 'Cómo crece SOLMI OS',
  activeMonthsRequired: 3,
  requirePaidStatus: true,
  referredRewardValue: 100,
  maxAccumulatedMonths: 12,
  creditExpiresMonths: 12,
  clawbackWindowDays: 30,
}

const PROGRAM_KEY = 'referral_program'
const PLATFORM = 'platform'

async function readRaw(configRepo: RepositoryAdapter<any>): Promise<{ row: any; value: Partial<ReferralProgram> }> {
  const rows = await configRepo.findMany({ hotelId: PLATFORM, key: PROGRAM_KEY })
  const row = (rows as any[])?.[0]
  const value = row ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) : {}
  return { row, value: value && typeof value === 'object' ? value : {} }
}

export async function getReferralProgram(configRepo: RepositoryAdapter<any>): Promise<ReferralProgram> {
  const { value } = await readRaw(configRepo)
  return { ...DEFAULT_REFERRAL_PROGRAM, ...value }
}

export async function setReferralProgram(
  configRepo: RepositoryAdapter<any>, patch: Partial<ReferralProgram>,
): Promise<ReferralProgram> {
  const { row, value } = await readRaw(configRepo)
  const next: ReferralProgram = { ...DEFAULT_REFERRAL_PROGRAM, ...value }
  for (const k of Object.keys(DEFAULT_REFERRAL_PROGRAM) as (keyof ReferralProgram)[]) {
    if (patch[k] !== undefined) (next as any)[k] = patch[k]
  }
  if (next.activeMonthsRequired < 1) throw new ValidationError('activeMonthsRequired debe ser >= 1')
  if (next.clawbackWindowDays < 0) throw new ValidationError('clawbackWindowDays debe ser >= 0')
  if (next.referredRewardValue < 0 || next.referredRewardValue > 100) throw new ValidationError('referredRewardValue debe estar entre 0 y 100')
  if (next.maxAccumulatedMonths != null && next.maxAccumulatedMonths < 0) throw new ValidationError('maxAccumulatedMonths debe ser >= 0')
  if (row) await configRepo.update(row.id, { value: next })
  else await configRepo.create({ id: crypto.randomUUID(), hotelId: PLATFORM, key: PROGRAM_KEY, value: next })
  return next
}
