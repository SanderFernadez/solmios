// pricing/service-calendar.ts — Overrides por FECHA del planning (extraídos de service.ts para no
// convertirlo en God Object): la fila "Días Mínimos" (estadía mínima por fecha) y la "Asignación de
// temporadas" (temporada por fecha, estilo MrPlan). Delega en los usecases; sin lógica propia.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import {
  listDateRestrictions, upsertDateRestrictions,
  type DateRestrictionRow, type DateRestrictionInput,
} from './usecases/date-restrictions'
import {
  listSeasonAssignments, assignSeason,
  type SeasonAssignmentRow, type AssignSeasonInput,
} from './usecases/season-assignments'

export class PricingCalendarService {
  constructor(
    private readonly dateRestrictionsRepo: RepositoryAdapter<any>,
    private readonly seasonAssignmentsRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
  ) {}

  // ── Días Mínimos por fecha ──
  listDateRestrictions(hotelId: string, from?: string, to?: string): Promise<DateRestrictionRow[]> {
    return listDateRestrictions(this.dateRestrictionsRepo, hotelId, from, to)
  }

  updateDateRestrictions(hotelId: string, items: DateRestrictionInput[]): Promise<number> {
    return upsertDateRestrictions(this.dateRestrictionsRepo, hotelId, items)
  }

  // ── Temporada por fecha ──
  listSeasonAssignments(hotelId: string, from?: string, to?: string): Promise<SeasonAssignmentRow[]> {
    return listSeasonAssignments(this.seasonAssignmentsRepo, hotelId, from, to)
  }

  assignSeason(hotelId: string, input: AssignSeasonInput): Promise<number> {
    this.logger.info('Asignando temporada por fecha', { hotelId, from: input.from, to: input.to, season: input.season })
    return assignSeason(this.seasonAssignmentsRepo, hotelId, input)
  }
}
