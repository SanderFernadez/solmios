// usecases/qscanpro-webhook.ts — Webhook receptor de QScanPro (document scan).
// Endpoint público (POST /api/webhooks/qscanpro): la autoridad NO es un JWT de usuario,
// sino el connection_code que el hotel configuró en Settings → Integraciones → QScanPro
// (guardado en Configuration key 'qscanpro_connection_code'). Patrón análogo al webhook
// de Stripe (payment-requests/usecases/stripe-webhook.ts).
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { AuthError, NotFoundError, ValidationError } from 'arckode-framework'

export interface QScanProWebhookBody {
  /** Hash público de la reserva (= reservations.preCheckinHash). */
  reservationHash: string
  /** Token de seguridad: debe coincidir con Configuration.qscanpro_connection_code del hotel. */
  connection_code: string
  documentType?: string
  documentNumber?: string
  documentUrl?: string
}

export interface QScanProWebhookDeps {
  reservationRepo: RepositoryAdapter<any>
  guestRepo: RepositoryAdapter<any>
  configRepo: RepositoryAdapter<any>
  logger: Logger
}

/**
 * Procesa la notificación de QScanPro cuando un huésped escanea su documento:
 * 1. Valida reservationHash + connection_code.
 * 2. Actualiza el guest con documentType/documentNumber/documentUrl.
 * 3. Marca reservation.documentScanned = true.
 * Lanza ValidationError/NotFoundError/AuthError para que el framework mapee a 400/404/401.
 */
export async function handleQScanProWebhook(
  body: QScanProWebhookBody,
  deps: QScanProWebhookDeps,
): Promise<{ success: true; message: string; reservationId: string }> {
  const { reservationRepo, guestRepo, configRepo, logger } = deps
  const { reservationHash, connection_code, documentType, documentNumber, documentUrl } = body ?? {}

  if (!reservationHash || !connection_code) {
    throw new ValidationError('reservationHash y connection_code son requeridos')
  }

  // 1. Resolver reserva desde el hash público de pre-checkin
  const reservation = (await reservationRepo.findMany({ preCheckinHash: reservationHash }))[0]
  if (!reservation) {
    throw new NotFoundError('Reserva no encontrada para ese hash')
  }

  // 2. Validar connection_code contra la config del hotel
  const config = (await configRepo.findMany({
    hotelId: reservation.hotelId,
    key: 'qscanpro_connection_code',
  }))[0]
  // Configuration.value es json → puede guardarse como string o como { code }. Cubrir ambos.
  const stored = config?.value
  const expected = typeof stored === 'string' ? stored : (stored?.code ?? stored)
  if (!expected || expected !== connection_code) {
    logger.warn('QScanPro webhook: connection_code inválido', { reservationId: reservation.id })
    throw new AuthError('No autorizado')
  }

  // 3. Actualizar guest con los datos del documento escaneado
  if (reservation.guestId && (documentNumber || documentType || documentUrl)) {
    const patch: Record<string, unknown> = {}
    if (documentNumber) patch.document = documentNumber
    if (documentType) patch.documentType = documentType
    if (documentUrl) patch.documentUrl = documentUrl
    await guestRepo.update(reservation.guestId, patch)
  }

  // 4. Marcar la reserva como document_scanned
  await reservationRepo.update(reservation.id, { documentScanned: true })

  logger.info('QScanPro: documento recibido', { reservationId: reservation.id, documentType })
  return { success: true, message: 'Documento procesado', reservationId: reservation.id }
}
