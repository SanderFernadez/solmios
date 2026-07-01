// mantenimiento/usecases/timings.ts — Timer: start/complete con máquina de estados
import type { RepositoryAdapter } from 'arckode-framework'
import { NotFoundError, ValidationError } from 'arckode-framework'
import type { MantenimientoDTO } from '../types'
import { assertOwnership } from '../helpers'

// Máquina de estados. 'resolved' ahora es alcanzable desde open/in_progress/waiting
// (antes era zombie: figuraba en el enum pero ninguna transición llegaba a él).
// Flujo típico: open → in_progress → resolved → closed  (resolved = arreglado, closed = confirmado).
const STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'resolved', 'closed'],
  in_progress: ['waiting', 'resolved', 'closed'],
  waiting: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed', 'open'],
  closed: ['open'],
}

export function assertTransition(from: string | undefined, to: string): void {
  const allowed = STATUS_TRANSITIONS[from ?? 'open']
  if (!allowed || !allowed.includes(to)) {
    throw new ValidationError(`Transición de estado inválida: ${from ?? '∅'} → ${to}`)
  }
}

export class TimingsUseCase {
  constructor(
    private readonly repo: RepositoryAdapter<MantenimientoDTO>,
    private readonly onUpdated: (item: MantenimientoDTO) => Promise<void>,
    private readonly invalidate: (hotelId?: string) => Promise<void>,
  ) {}

  async start(id: string, currentUser: { id: string; role: string; hotelId?: string }): Promise<MantenimientoDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Ticket de mantenimiento no encontrado')
    assertOwnership(existing.hotelId, currentUser)
    if (existing.status !== 'open') {
      throw new ValidationError('Solo se pueden iniciar órdenes en estado abierto')
    }
    const now = new Date().toISOString()
    const item = await this.repo.update(id, { status: 'in_progress', startTime: now } as any)
    if (!item) throw new NotFoundError('Ticket de mantenimiento no encontrado')
    await this.onUpdated(item)
    await this.invalidate(existing.hotelId)
    return item
  }

  async complete(id: string, currentUser: { id: string; role: string; hotelId?: string }, notes?: string): Promise<MantenimientoDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundError('Ticket de mantenimiento no encontrado')
    assertOwnership(existing.hotelId, currentUser)
    assertTransition(existing.status, 'closed')
    const now = new Date().toISOString()
    const update: Record<string, any> = { status: 'closed', endTime: now, resolvedDate: now }
    if (notes) update.notes = notes
    const item = await this.repo.update(id, update as any)
    if (!item) throw new NotFoundError('Ticket de mantenimiento no encontrado')
    await this.onUpdated(item)
    await this.invalidate(existing.hotelId)
    return item
  }
}
