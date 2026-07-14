import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { ConflictError, NotFoundError } from 'arckode-framework'
import type { FacturasDTO } from '../types'
import { assertOwnership } from './billing'
import { generateCreditNote, type CreditNoteResult } from './credit-note'
import { auditSafely, type AuditPort } from './audit'
import { invalidateFacturasCaches } from './cache'

export interface CreditNoteFlowDeps {
  repo: RepositoryAdapter<FacturasDTO>
  userRepo: RepositoryAdapter<any>
  auth: Auth
  logger: Logger
  cache: CacheAdapter
  auditPort: AuditPort | null
  onUpdated?: (invoice: FacturasDTO) => Promise<void> | void
}

/**
 * Anula una factura emitiendo una nota de crédito.
 *
 * Es la única vía para dar de baja una factura con efectos contables: borrarla dejaría el libro
 * de ventas sin respaldo y un hueco en el numerador. Por eso deja rastro en el audit log.
 */
export async function creditNoteFlow(
  deps: CreditNoteFlowDeps,
  id: string,
  reason: string,
  user: { id: string; role?: string },
): Promise<CreditNoteResult> {
  deps.logger.info('Generando nota de crédito', { id })

  const inv = await deps.repo.findById(id)
  if (!inv) throw new NotFoundError('Factura no encontrada')
  await assertOwnership(deps.userRepo, deps.auth, inv.hotelId, user.id, user.role)
  if (inv.status === 'cancelled') throw new ConflictError('La factura ya está cancelada')

  const result = await generateCreditNote(deps.repo, inv, reason, user.id)
  deps.logger.info('Nota de crédito generada', {
    id, invoiceNumber: inv.invoiceNumber, amount: inv.amount, reason,
  })

  await auditSafely(deps.auditPort, deps.logger, {
    hotelId: inv.hotelId, userId: user.id, action: 'invoice.credit_note', entityId: id,
    detail: `${inv.invoiceNumber} · ${inv.amount} ${inv.currency} · motivo: ${reason}`,
  })

  await deps.onUpdated?.(result.originalInvoice)
  await invalidateFacturasCaches(deps.cache, inv.hotelId)
  return result
}
