// compras/usecases/requisitions.ts — Requisiciones (COM-1). Ciclo draft→submitted→approved|rejected.
// Solo se edita en draft. La aprobación la gatea el permiso de la ruta (purchasing:edit).
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError, ConflictError } from 'arckode-framework'
import type { RequisitionDTO, RequisitionItemDTO, RequisitionStatus, CurrentUser } from '../types'
import { nextNumber } from './number'

export interface RequisitionDeps {
  requisitions: RepositoryAdapter<RequisitionDTO>
  reqItems: RepositoryAdapter<RequisitionItemDTO>
  config: RepositoryAdapter<any>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}

export interface RequisitionLineInput { inventoryItemId?: string; description: string; quantity?: number; unit?: string; notes?: string }
export interface CreateRequisitionInput { notes?: string; items?: RequisitionLineInput[] }

function hotelOf(u: CurrentUser): string { const h = u.hotelId || ''; if (!h) throw new ValidationError('Sin hotel asignado'); return h }

async function loadOwned(deps: RequisitionDeps, id: string, user: CurrentUser): Promise<RequisitionDTO> {
  const req = await deps.requisitions.findById(id)
  if (!req) throw new NotFoundError('Requisición no encontrada')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(req.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  return req
}

function assertDraft(req: RequisitionDTO): void {
  if (req.status !== 'draft') throw new ConflictError('La requisición ya no está en borrador')
}

async function buildLine(hotelId: string, requisitionId: string, l: RequisitionLineInput): Promise<Omit<RequisitionItemDTO, 'id'>> {
  if (!l.description?.trim()) throw new ValidationError('Cada línea necesita una descripción')
  const qty = Number(l.quantity ?? 1)
  if (!Number.isFinite(qty) || qty <= 0) throw new ValidationError('La cantidad debe ser > 0')
  return { hotelId, requisitionId, inventoryItemId: l.inventoryItemId || undefined, description: l.description.trim(), quantity: qty, unit: l.unit?.trim() || 'unit', notes: l.notes } as Omit<RequisitionItemDTO, 'id'>
}

export async function listRequisitions(deps: RequisitionDeps, query: { status?: string } | undefined, user: CurrentUser): Promise<{ data: RequisitionDTO[]; total: number }> {
  const hotelId = hotelOf(user)
  const filters: any = { hotelId }
  if (query?.status) filters.status = query.status
  const data = (await deps.requisitions.findMany(filters)) as RequisitionDTO[]
  data.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  return { data, total: data.length }
}

export async function getRequisition(deps: RequisitionDeps, id: string, user: CurrentUser): Promise<RequisitionDTO & { items: RequisitionItemDTO[] }> {
  const req = await loadOwned(deps, id, user)
  const items = (await deps.reqItems.findMany({ requisitionId: id })) as RequisitionItemDTO[]
  return { ...req, items }
}

export async function createRequisition(deps: RequisitionDeps, dto: CreateRequisitionInput, user: CurrentUser): Promise<RequisitionDTO & { items: RequisitionItemDTO[] }> {
  const hotelId = hotelOf(user)
  const number = await nextNumber(deps.config, hotelId, 'REQ', 'requisition')
  const req = await deps.requisitions.create({ hotelId, number, status: 'draft', requestedBy: user.id } as Omit<RequisitionDTO, 'id'>)
  const items: RequisitionItemDTO[] = []
  for (const l of dto.items ?? []) items.push(await deps.reqItems.create(await buildLine(hotelId, req.id, l)))
  return { ...req, items }
}

export async function addLine(deps: RequisitionDeps, id: string, l: RequisitionLineInput, user: CurrentUser): Promise<RequisitionItemDTO> {
  const req = await loadOwned(deps, id, user); assertDraft(req)
  return deps.reqItems.create(await buildLine(req.hotelId, req.id, l))
}

export async function removeLine(deps: RequisitionDeps, id: string, lineId: string, user: CurrentUser): Promise<void> {
  const req = await loadOwned(deps, id, user); assertDraft(req)
  const line = await deps.reqItems.findOne({ id: lineId })
  if (!line || line.requisitionId !== id) throw new NotFoundError('Línea no encontrada')
  await deps.reqItems.delete(lineId)
}

const TRANSITIONS: Record<RequisitionStatus, RequisitionStatus[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: [],
  rejected: [],
}

export async function transition(deps: RequisitionDeps, id: string, to: RequisitionStatus, user: CurrentUser): Promise<RequisitionDTO> {
  const req = await loadOwned(deps, id, user)
  if (!TRANSITIONS[req.status]?.includes(to)) throw new ConflictError(`Transición inválida: ${req.status} → ${to}`)
  if (to === 'submitted') {
    const items = await deps.reqItems.findMany({ requisitionId: id })
    if (!items.length) throw new ValidationError('La requisición no tiene líneas')
  }
  const patch: any = { status: to }
  if (to === 'approved' || to === 'rejected') patch.approvedBy = user.id
  const updated = await deps.requisitions.update(id, patch)
  if (!updated) throw new NotFoundError('Requisición no encontrada')
  return updated
}

/**
 * Enviar la PROPIA requisición a aprobación (draft→submitted). Ruta separada gateada por
 * `purchasing:create` (no `edit`): quien solo puede crear/solicitar también debe poder mandar su
 * borrador a revisión — segregación de funciones (quien pide ≠ quien aprueba). Restringido al
 * creador: si otro usuario con solo `create` intentara enviar la requisición de un tercero, se
 * rechaza (para eso está `transition`, gateado por `edit`, que sí puede operar sobre cualquiera).
 */
export async function submitOwn(deps: RequisitionDeps, id: string, user: CurrentUser): Promise<RequisitionDTO> {
  const req = await loadOwned(deps, id, user)
  if (req.requestedBy && req.requestedBy !== user.id) throw new ConflictError('Solo quien creó la requisición puede enviarla a aprobación')
  return transition(deps, id, 'submitted', user)
}

export async function deleteRequisition(deps: RequisitionDeps, id: string, user: CurrentUser): Promise<void> {
  const req = await loadOwned(deps, id, user); assertDraft(req)
  const items = (await deps.reqItems.findMany({ requisitionId: id })) as RequisitionItemDTO[]
  for (const it of items) await deps.reqItems.delete(it.id)
  await deps.requisitions.delete(id)
}
