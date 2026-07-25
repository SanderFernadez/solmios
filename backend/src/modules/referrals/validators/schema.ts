import type { ValidationRule } from 'arckode-framework'

export const UpdateReferralProgramSchema: Record<string, ValidationRule> = {
  enabled: { type: 'boolean' as const },
  programName: { type: 'string' as const, max: 100 },
  activeMonthsRequired: { type: 'number' as const, min: 1, max: 60 },
  requirePaidStatus: { type: 'boolean' as const },
  referredRewardValue: { type: 'number' as const, min: 0, max: 100 },
  maxAccumulatedMonths: { type: 'number' as const, min: 0, max: 240 },
  creditExpiresMonths: { type: 'number' as const, min: 0, max: 240 },
  clawbackWindowDays: { type: 'number' as const, min: 0, max: 365 },
}

export const CreateReferralTierSchema: Record<string, ValidationRule> = {
  fromCount: { type: 'number' as const, required: true, min: 1, max: 1000 },
  monthsGranted: { type: 'number' as const, required: true, min: 0, max: 60 },
  sortOrder: { type: 'number' as const, min: 0 },
}

export const UpdateReferralTierSchema: Record<string, ValidationRule> = {
  fromCount: { type: 'number' as const, min: 1, max: 1000 },
  monthsGranted: { type: 'number' as const, min: 0, max: 60 },
  sortOrder: { type: 'number' as const, min: 0 },
}
