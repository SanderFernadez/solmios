// folios/usecases/folio-entries.ts — Alta de líneas en el folio: cargos y pagos.
// Extraído del service para mantenerlo < 200 líneas.
//
// Un pago se guarda como una línea más del folio, con `total` negativo: el saldo es la suma
// de todas las líneas (ver folio-math.computeTotals). Por eso ambos comparten esta forma.

import type { RepositoryAdapter, Auth, Logger } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { FolioDTO, FolioChargeDTO, PostChargeDTO, ApplyPaymentDTO, CurrentUser } from '../types'
import { taxRateFor, applyTax, computeTotals } from './folio-math'

/** Tolerancia de centavos al comparar un pago contra el saldo (errores de redondeo float). */
const BALANCE_EPSILON = 0.01

const now = () => new Date().toISOString()

export interface FolioEntriesDeps {
  folioRepo: RepositoryAdapter<FolioDTO>
  chargeRepo: RepositoryAdapter<FolioChargeDTO>
  configRepo: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  auth: Auth
  logger: Logger
}

/** Carga el folio, valida ownership y que esté abierto. */
async function assertOpenFolio(deps: FolioEntriesDeps, folioId: string, user: CurrentUser): Promise<FolioDTO> {
  const folio = await deps.folioRepo.findById(folioId)
  if (!folio) throw new NotFoundError('Folio no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(folio.hotelId, me?.hotelId ?? '', user.role, 'super_admin')
  if (folio.status !== 'open') throw new ValidationError('El folio no está abierto')
  return folio
}

export async function postCharge(
  deps: FolioEntriesDeps,
  folioId: string,
  dto: PostChargeDTO,
  user: CurrentUser,
): Promise<{ folio: FolioDTO; charge: FolioChargeDTO }> {
  const folio = await assertOpenFolio(deps, folioId, user)

  const qty = Number(dto.quantity) || 1
  const base = (Number(dto.amount) || 0) * qty
  if (base <= 0) throw new ValidationError('El monto del cargo debe ser positivo')

  const rate = await taxRateFor(deps.configRepo, folio.hotelId)
  const { tax, total } = applyTax(base, rate)
  const charge = await deps.chargeRepo.create({
    folioId, hotelId: folio.hotelId, description: dto.description,
    category: dto.category ?? 'other', kind: 'charge', quantity: qty,
    amount: base, taxes: tax, total, source: dto.source ?? 'manual', postedAt: now(),
  } as any)

  deps.logger.info('Cargo agregado al folio', {
    folioId, chargeId: charge.id, description: dto.description, base, tax, total,
  })
  return { folio, charge: charge as FolioChargeDTO }
}

export async function applyPayment(
  deps: FolioEntriesDeps,
  folioId: string,
  dto: ApplyPaymentDTO,
  user: CurrentUser,
): Promise<{ folio: FolioDTO; charge: FolioChargeDTO }> {
  const folio = await assertOpenFolio(deps, folioId, user)

  const amount = Number(dto.amount) || 0
  if (amount <= 0) throw new ValidationError('El monto del pago debe ser positivo')

  const charges = await deps.chargeRepo.findMany({ folioId })
  const { balance } = computeTotals(charges as FolioChargeDTO[])
  if (amount > balance + BALANCE_EPSILON) {
    throw new ValidationError(`El pago ($${amount}) excede el saldo pendiente ($${balance})`)
  }

  const charge = await deps.chargeRepo.create({
    folioId, hotelId: folio.hotelId,
    description: `Pago${dto.method ? ` (${dto.method})` : ''}${dto.reference ? ` · Ref ${dto.reference}` : ''}`,
    category: 'payment', kind: 'payment', quantity: 1, amount: -amount, taxes: 0,
    total: -amount, source: dto.method ?? 'manual', postedAt: now(),
  } as any)

  deps.logger.info('Pago aplicado al folio', {
    folioId, chargeId: charge.id, amount, method: dto.method ?? null,
    balanceBefore: balance, balanceAfter: balance - amount,
  })
  return { folio, charge: charge as FolioChargeDTO }
}
