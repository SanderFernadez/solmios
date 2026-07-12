// empleados/usecases/leave-config.ts — Time Off a nivel Odoo:
// tipos de ausencia configurables, asignaciones por empleado/año, días festivos, saldo y calendario.
//
// El saldo (balance) se CALCULA, no se persiste: allocated (asignación o maxDaysPerYear) − usado
// (licencias aprobadas del año). Los días de una licencia se cuentan como días calendario del rango
// MENOS los festivos que caen dentro (un hotel opera fines de semana, así que no se excluyen sábados/domingos).

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type {
  LeaveTypeDTO, CreateLeaveTypeDTO,
  LeaveAllocationDTO, CreateLeaveAllocationDTO,
  PublicHolidayDTO, CreatePublicHolidayDTO,
  LeaveBalanceDTO, LeaveRequestDTO,
} from '../types'

const MS_PER_DAY = 86_400_000

/** Tipos por defecto que se siembran la primera vez que un hotel abre la config de licencias. */
const DEFAULT_TYPES: Omit<CreateLeaveTypeDTO, 'hotelId'>[] = [
  { code: 'vacation', name: 'Vacaciones', color: '#0891b2', paid: true, maxDaysPerYear: 15 },
  { code: 'sick_leave', name: 'Licencia médica', color: '#dc2626', paid: true, maxDaysPerYear: 0 },
  { code: 'permission', name: 'Permiso', color: '#f59e0b', paid: false, maxDaysPerYear: 0 },
  { code: 'maternity', name: 'Maternidad/Paternidad', color: '#8b5cf6', paid: true, maxDaysPerYear: 0 },
  { code: 'other', name: 'Otro', color: '#64748b', paid: false, maxDaysPerYear: 0 },
]

/** Cuenta días de un rango [start,end] inclusive, descontando festivos (fecha exacta o recurrente MM-DD). */
export function countLeaveDays(start: string, end: string, exactHolidays: Set<string>, recurringHolidays: Set<string>): number {
  const s = new Date(start + 'T00:00:00Z')
  const e = new Date(end + 'T00:00:00Z')
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e.getTime() < s.getTime()) return 0
  let count = 0
  for (let t = s.getTime(); t <= e.getTime(); t += MS_PER_DAY) {
    const iso = new Date(t).toISOString().slice(0, 10)
    if (exactHolidays.has(iso) || recurringHolidays.has(iso.slice(5))) continue
    count++
  }
  return count
}

export class LeaveConfigUseCase {
  constructor(
    private readonly typeRepo: RepositoryAdapter<LeaveTypeDTO>,
    private readonly allocationRepo: RepositoryAdapter<LeaveAllocationDTO>,
    private readonly holidayRepo: RepositoryAdapter<PublicHolidayDTO>,
    private readonly leaveRepo: RepositoryAdapter<LeaveRequestDTO>,
    private readonly logger: Logger,
  ) {}

  // ── Tipos de ausencia ───────────────────────────────────
  async listTypes(hotelId: string): Promise<LeaveTypeDTO[]> {
    const existing = await this.typeRepo.findMany({ hotelId, active: 1 })
    if (existing.length) return existing
    // Primera vez: sembrar los defaults para que la UI nunca aparezca vacía.
    for (const t of DEFAULT_TYPES) {
      await this.typeRepo.create({ ...t, hotelId, paid: t.paid ? 1 : 0, requiresApproval: 1, active: 1 } as any)
    }
    return this.typeRepo.findMany({ hotelId, active: 1 })
  }

  async createType(dto: CreateLeaveTypeDTO): Promise<LeaveTypeDTO> {
    if (!dto.code || !dto.name) throw new ValidationError('code y name son obligatorios')
    return this.typeRepo.create({
      ...dto,
      color: dto.color ?? '#0891b2',
      paid: dto.paid === false ? 0 : 1,
      requiresApproval: dto.requiresApproval === false ? 0 : 1,
      maxDaysPerYear: dto.maxDaysPerYear ?? 0,
      active: 1,
    } as any)
  }

  async updateType(id: string, hotelId: string, data: Partial<CreateLeaveTypeDTO>): Promise<LeaveTypeDTO> {
    // findOne con hotelId → scoped por hotel: imposible tocar el tipo de otro hotel (anti-IDOR).
    const t = await this.typeRepo.findOne({ id, hotelId })
    if (!t) throw new NotFoundError('Tipo de ausencia no encontrado')
    const patch: Record<string, unknown> = { ...data }
    if (typeof data.paid === 'boolean') patch.paid = data.paid ? 1 : 0
    if (typeof data.requiresApproval === 'boolean') patch.requiresApproval = data.requiresApproval ? 1 : 0
    return this.typeRepo.update(id, patch as any) as Promise<LeaveTypeDTO>
  }

  async deleteType(id: string, hotelId: string): Promise<void> {
    const t = await this.typeRepo.findOne({ id, hotelId })
    if (!t) throw new NotFoundError('Tipo de ausencia no encontrado')
    await this.typeRepo.update(id, { active: 0 } as any) // soft-delete: no romper licencias históricas
  }

  // ── Asignaciones ────────────────────────────────────────
  async listAllocations(hotelId: string, employeeId?: string, year?: number): Promise<LeaveAllocationDTO[]> {
    const filters: Record<string, unknown> = { hotelId }
    if (employeeId) filters.employeeId = employeeId
    if (year) filters.year = year
    return this.allocationRepo.findMany(filters)
  }

  async createAllocation(dto: CreateLeaveAllocationDTO): Promise<LeaveAllocationDTO> {
    if (!dto.employeeId || !dto.leaveTypeId) throw new ValidationError('employeeId y leaveTypeId son obligatorios')
    if (!(dto.days > 0)) throw new ValidationError('days debe ser positivo')
    return this.allocationRepo.create({ ...dto } as any)
  }

  async deleteAllocation(id: string, hotelId: string): Promise<void> {
    const a = await this.allocationRepo.findOne({ id, hotelId })
    if (!a) throw new NotFoundError('Asignación no encontrada')
    await this.allocationRepo.delete(id)
  }

  // ── Días festivos ───────────────────────────────────────
  async listHolidays(hotelId: string, year?: number): Promise<PublicHolidayDTO[]> {
    const all = await this.holidayRepo.findMany({ hotelId })
    if (!year) return all
    const y = String(year)
    return all.filter((h) => h.recurring === 1 || String(h.date).slice(0, 4) === y)
  }

  async createHoliday(dto: CreatePublicHolidayDTO): Promise<PublicHolidayDTO> {
    if (!dto.date || !dto.name) throw new ValidationError('date y name son obligatorios')
    return this.holidayRepo.create({ ...dto, recurring: dto.recurring ? 1 : 0 } as any)
  }

  async deleteHoliday(id: string, hotelId: string): Promise<void> {
    const h = await this.holidayRepo.findOne({ id, hotelId })
    if (!h) throw new NotFoundError('Festivo no encontrado')
    await this.holidayRepo.delete(id)
  }

  /** Sets de festivos (exactos + recurrentes MM-DD) para el cálculo de días. */
  async holidaySets(hotelId: string): Promise<{ exact: Set<string>; recurring: Set<string> }> {
    const holidays = await this.holidayRepo.findMany({ hotelId })
    const exact = new Set<string>()
    const recurring = new Set<string>()
    for (const h of holidays) {
      if (h.recurring === 1) recurring.add(String(h.date).slice(5))
      else exact.add(String(h.date))
    }
    return { exact, recurring }
  }

  // ── Saldo por tipo (calculado) ──────────────────────────
  async getBalance(hotelId: string, employeeId: string, year: number): Promise<LeaveBalanceDTO[]> {
    const [types, allocations, leaves] = await Promise.all([
      this.listTypes(hotelId),
      this.allocationRepo.findMany({ hotelId, employeeId, year }),
      this.leaveRepo.findMany({ hotelId, employeeId }),
    ])
    const yStr = String(year)
    const leavesThisYear = leaves.filter((l) => String(l.startDate).slice(0, 4) === yStr)

    return types.map((t) => {
      const allocated = allocations
        .filter((a) => a.leaveTypeId === t.id)
        .reduce((s, a) => s + Number(a.days), 0) || Number(t.maxDaysPerYear) || 0
      // Matchea por leaveTypeId nuevo O por el `type` string legacy (=code).
      const matches = (l: LeaveRequestDTO): boolean => l.leaveTypeId === t.id || l.type === t.code
      const used = leavesThisYear.filter((l) => matches(l) && l.status === 'approved').reduce((s, l) => s + Number(l.days), 0)
      const pending = leavesThisYear.filter((l) => matches(l) && l.status === 'pending').reduce((s, l) => s + Number(l.days), 0)
      return {
        leaveTypeId: t.id, code: t.code, name: t.name, color: t.color,
        allocated, used, pending, remaining: allocated - used,
      }
    })
  }

  // ── Calendario de ausencias (rango) ─────────────────────
  async getCalendar(hotelId: string, from: string, to: string): Promise<LeaveRequestDTO[]> {
    const leaves = await this.leaveRepo.findMany({ hotelId })
    // Solapan el rango [from,to] y no están rechazadas.
    return leaves.filter((l) =>
      l.status !== 'rejected' &&
      String(l.startDate) <= to &&
      String(l.endDate) >= from,
    )
  }
}
