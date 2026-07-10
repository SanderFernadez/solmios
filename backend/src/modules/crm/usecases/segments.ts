// crm/usecases/segments.ts — Reglas de segmentación. Funciones puras.
//
// El ORM NO entiende operadores de comparación: `buildWhere` (kernel/db/orm-utils.ts) emite
// `campo = ?` por cada filtro y empuja el valor crudo al bind. Un `{ $gte: 3 }` llegaba como objeto
// al driver y reventaba con `TypeError: Binding expected string, TypedArray, boolean, number,
// bigint or null`: pedir los huéspedes de un segmento con `minStays` o `minSpent` devolvía 500.
//
// Sólo la igualdad viaja al WHERE. Los umbrales se aplican acá, en memoria.

import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { GuestSegmentDTO, CreateSegmentDTO } from '../types'

export interface SegmentRules {
  tier?: string
  minStays?: number
  minSpent?: number
}

/** Las reglas se guardan como texto. Un JSON corrupto no debe tumbar el listado. */
export function parseRules(raw: string | null | undefined): SegmentRules {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as SegmentRules) : {}
  } catch {
    return {}
  }
}

/** Lo único que el ORM sabe traducir a SQL. El resto lo filtra `matchesRules`. */
export function equalityFilters(hotelId: string, rules: SegmentRules): Record<string, unknown> {
  const filters: Record<string, unknown> = { hotelId, active: 1 }
  if (rules.tier) filters.tier = rules.tier
  return filters
}

/** Un huésped pertenece al segmento sólo si cumple TODAS las reglas. Sin reglas, entran todos. */
export function matchesRules(guest: any, rules: SegmentRules): boolean {
  if (rules.tier && guest.tier !== rules.tier) return false
  if (rules.minStays !== undefined && Number(guest.totalStays ?? 0) < Number(rules.minStays)) return false
  if (rules.minSpent !== undefined && Number(guest.totalSpent ?? 0) < Number(rules.minSpent)) return false
  return true
}

export interface SegmentDeps {
  repo: RepositoryAdapter<GuestSegmentDTO>
  guestRepo: RepositoryAdapter<any>
  auth?: Auth
}

export class SegmentUseCase {
  constructor(private readonly deps: SegmentDeps) {}

  /** `count` nace en 0 y lo recalcula `list`: un segmento es dinámico, no un contador. */
  create(dto: CreateSegmentDTO): Promise<GuestSegmentDTO> {
    return this.deps.repo.create({ ...dto, count: 0, active: 1 } as any)
  }

  /**
   * El `count` de la tabla nunca se actualizaba: toda tarjeta decía "0 huéspedes". Es un dato
   * derivado — el próximo checkout lo desactualiza — así que se calcula al leer. Una sola query de
   * huéspedes para todos los segmentos, no una por segmento.
   */
  async list(hotelId: string): Promise<GuestSegmentDTO[]> {
    const segments = await this.deps.repo.findMany({ hotelId, active: 1 })
    if (segments.length === 0) return []

    const guests = await this.deps.guestRepo.findMany({ hotelId, active: 1 })
    return segments.map((s) => {
      const rules = parseRules(s.rules)
      return { ...s, count: guests.filter((g: any) => matchesRules(g, rules)).length }
    })
  }

  async guestsIn(hotelId: string, segmentId: string, role?: string): Promise<any[]> {
    const segment = await this.deps.repo.findById(segmentId)
    if (!segment) throw new NotFoundError('Segment not found')
    if (this.deps.auth) this.deps.auth.assertOwnership(segment.hotelId, hotelId, role, 'super_admin')

    // Los huéspedes son los del hotel DUEÑO del segmento, no los del que consulta: un super_admin
    // mirando un segmento ajeno debe ver ese hotel, no el suyo.
    const rules = parseRules(segment.rules)
    const guests = await this.deps.guestRepo.findMany(equalityFilters(segment.hotelId, rules))
    return guests.filter((g: any) => matchesRules(g, rules))
  }
}
