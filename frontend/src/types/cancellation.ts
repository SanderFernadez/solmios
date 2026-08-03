// types/cancellation.ts — Espejo frontend de los DTOs backend del módulo cancellation (F3 #627).
// El schema físico vive en backend/src/modules/cancellation/model.ts; acá solo el contract API.

/** Ámbito de aplicación de la política. F3 soporta base + channel. */
export type PolicyScope = 'base' | 'channel' | 'rate' | 'season'

/**
 * Tier de penalidad. deadlineHours = horas-mínimas-antes-del-checkIn para que aplique;
 * penaltyPercent = % del depósito a retener; refundable = si el huésped puede reclamar.
 */
export interface Tier {
  deadlineHours: number
  penaltyPercent: number
  refundable: boolean
  label?: string
}

/** Política de cancelación (una fila de cancellation_policies). */
export interface CancellationPolicy {
  id: string
  hotelId: string
  scope: PolicyScope
  scopeId: string
  name: string
  tiers: Tier[]
  priority: number
  active: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Presets de tiers por tipo (espejo de backend/src/shared/usecases/cancellation-math.ts
 * PRESET_TIERS). Duplicado acá porque el frontend no puede importar del backend; si cambián
 * los del backend, actualizar acá también. La fuente de verdad del cálculo es el backend.
 */
export const PRESET_TIERS: Record<string, Tier[]> = {
  flexible: [{ deadlineHours: 99_999, penaltyPercent: 0, refundable: true, label: 'Cancelación gratis' }],
  moderate: [
    { deadlineHours: 72, penaltyPercent: 0, refundable: true, label: 'Más de 72 h antes' },
    { deadlineHours: 0, penaltyPercent: 50, refundable: true, label: 'Menos de 72 h' },
  ],
  strict: [
    { deadlineHours: 168, penaltyPercent: 0, refundable: true, label: 'Más de 7 días antes' },
    { deadlineHours: 0, penaltyPercent: 100, refundable: true, label: 'Menos de 7 días' },
  ],
  non_refundable: [{ deadlineHours: 0, penaltyPercent: 100, refundable: false, label: 'No reembolsable' }],
}

export const PRESET_OPTIONS: { key: string; label: string; desc: string }[] = [
  { key: 'flexible', label: 'Flexible', desc: 'Cancelación gratis hasta el check-in' },
  { key: 'moderate', label: 'Moderada', desc: 'Gratis con +72 h; 50% si es menor' },
  { key: 'strict', label: 'Estricta', desc: 'Gratis con +7 días; 100% si es menor' },
  { key: 'non_refundable', label: 'No reembolsable', desc: '100% siempre, sin reembolso' },
]
