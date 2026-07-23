// treasury/usecases/suppliers-crud.ts — CRUD de proveedores (TES-4). Multi-tenant + ownership.
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { SupplierDTO, CreateSupplierDTO, UpdateSupplierDTO, CurrentUser } from '../types'

export interface SuppliersDeps {
  suppliers: RepositoryAdapter<SupplierDTO>
  userRepo: RepositoryAdapter<any>
  auth: Auth
}

export async function listSuppliers(deps: SuppliersDeps, user: CurrentUser): Promise<SupplierDTO[]> {
  const hotelId = user.role === 'super_admin' ? undefined : (user.hotelId ?? '__none__')
  return deps.suppliers.findMany(hotelId ? { hotelId } : {})
}

export async function createSupplier(deps: SuppliersDeps, dto: CreateSupplierDTO, user: CurrentUser): Promise<SupplierDTO> {
  const hotelId = user.role === 'super_admin' ? (dto.hotelId || user.hotelId || '') : (user.hotelId || '')
  if (!hotelId) throw new ValidationError('Sin hotel asignado')
  return deps.suppliers.create({ ...dto, hotelId, active: dto.active ?? 1 } as Omit<SupplierDTO, 'id'>)
}

export async function updateSupplier(deps: SuppliersDeps, id: string, dto: UpdateSupplierDTO, user: CurrentUser): Promise<SupplierDTO> {
  const existing = await deps.suppliers.findById(id)
  if (!existing) throw new NotFoundError('Proveedor no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  const item = await deps.suppliers.update(id, dto as Partial<Omit<SupplierDTO, 'id'>>)
  if (!item) throw new NotFoundError('Proveedor no encontrado')
  return item
}

export async function deleteSupplier(deps: SuppliersDeps, id: string, user: CurrentUser): Promise<void> {
  const existing = await deps.suppliers.findById(id)
  if (!existing) throw new NotFoundError('Proveedor no encontrado')
  const me = await deps.userRepo.findById(user.id)
  deps.auth.assertOwnership(existing.hotelId, (me as any)?.hotelId ?? '', user.role, 'super_admin')
  const deleted = await deps.suppliers.delete(id)
  if (!deleted) throw new NotFoundError('Proveedor no encontrado')
}
