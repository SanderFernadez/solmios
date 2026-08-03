// services/cancellationPolicies.service.ts — API client para políticas de cancelación (F3 #627).
// fetch SOLO acá (regla: nunca fetch en componentes). Los endpoints viven en el módulo
// backend `cancellation` (index.ts) con guard settings:view/edit.
import { http } from './http'
import type { CancellationPolicy, Tier } from '@/types/cancellation'

export interface UpsertOverridePayload {
  scope: 'channel'
  scopeId: string
  tiers: Tier[]
  name?: string
  priority?: number
}

export const CancellationPoliciesService = {
  /** Lista todas las políticas del hotel (base primero, luego overrides). */
  async list(): Promise<CancellationPolicy[]> {
    const res = await http.get<{ data: CancellationPolicy[] }>('/cancellation-policies')
    return res?.data ?? []
  },

  /** Upsert de la política base (scope='base'). */
  async upsertBase(tiers: Tier[], name?: string): Promise<CancellationPolicy> {
    return http.put('/cancellation-policies/base', { tiers, name })
  },

  /** Upsert de un override por canal (scope='channel'). */
  async upsertOverride(payload: UpsertOverridePayload): Promise<CancellationPolicy> {
    return http.post('/cancellation-policies/override', payload)
  },

  /** Borra una política por id. */
  async remove(id: string): Promise<{ success: boolean }> {
    return http.delete(`/cancellation-policies/${id}`)
  },
}
