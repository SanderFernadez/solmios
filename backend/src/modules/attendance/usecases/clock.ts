// attendance/usecases/clock.ts — Clock in/out logic

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { ValidationError, NotFoundError } from 'arckode-framework'
import type { AttendanceRecordDTO, AttendanceScheduleDTO, AttendanceConfigDTO, AttendanceReport } from '../types'
import { inDateRange } from '../../../shared/usecases/date-range'

export class ClockUseCase {
  constructor(
    private readonly recordRepo: RepositoryAdapter<AttendanceRecordDTO>,
    private readonly scheduleRepo: RepositoryAdapter<AttendanceScheduleDTO>,
    private readonly configRepo: RepositoryAdapter<AttendanceConfigDTO>,
    private readonly logger: Logger,
  ) {}

  async clockIn(employeeId: string, hotelId: string, method = 'pin', location?: string): Promise<AttendanceRecordDTO> {
    const today = new Date().toISOString().slice(0, 10)
    const existing = await this.recordRepo.findOne({ employeeId, date: today })
    if (existing?.clockIn) throw new ValidationError('Entrada ya registrada hoy')

    const now = new Date().toISOString()
    const config = await this.configRepo.findOne({ hotelId })
    const schedule = await this.getEmployeeSchedule(employeeId, hotelId)

    let status = 'present'
    if (schedule) {
      const [h, m] = schedule.startTime.split(':').map(Number)
      const grace = schedule.graceMinutes
      const startMin = h * 60 + m
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
      if (nowMin > startMin + grace) status = 'late'
    }

    if (existing) {
      return this.recordRepo.update(existing.id, { clockIn: now, status, method, location: location ?? null } as any) as Promise<AttendanceRecordDTO>
    }

    return this.recordRepo.create({ employeeId, hotelId, date: today, clockIn: now, status, method, location: location ?? null } as any)
  }

  async clockOut(employeeId: string, hotelId: string): Promise<AttendanceRecordDTO> {
    const today = new Date().toISOString().slice(0, 10)
    const record = await this.recordRepo.findOne({ employeeId, date: today })
    if (!record?.clockIn) throw new ValidationError('Debés fichar entrada primero')
    if (record.clockOut) throw new ValidationError('Salida ya registrada hoy')

    const now = new Date().toISOString()
    const clockIn = new Date(record.clockIn!)
    const hoursWorked = (new Date(now).getTime() - clockIn.getTime()) / 3600000

    const config = await this.configRepo.findOne({ hotelId })
    const schedule = await this.getEmployeeSchedule(employeeId, hotelId)

    let overtimeHours = 0
    let finalStatus = 'present'
    if (schedule && config?.overtimeEnabled) {
      const [sh, sm] = schedule.startTime.split(':').map(Number)
      const [eh, em] = schedule.endTime.split(':').map(Number)
      const standardMinutes = (eh * 60 + em) - (sh * 60 + sm) - schedule.breakMinutes
      const standardHours = standardMinutes / 60
      const otThreshold = schedule.overtimeThresholdMinutes / 60
      overtimeHours = Math.max(0, hoursWorked - standardHours - otThreshold)
      if (hoursWorked < standardHours - 0.5) finalStatus = 'early_departure'
    }

    return this.recordRepo.update(record.id, {
      clockOut: now, totalHours: Math.round(hoursWorked * 100) / 100,
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      status: finalStatus,
    } as any) as Promise<AttendanceRecordDTO>
  }

  async startBreak(employeeId: string): Promise<AttendanceRecordDTO> {
    const today = new Date().toISOString().slice(0, 10)
    const record = await this.recordRepo.findOne({ employeeId, date: today })
    if (!record?.clockIn) throw new ValidationError('Debés fichar entrada primero')
    if (record.breakStart && !record.breakEnd) throw new ValidationError('Descanso ya iniciado')
    return this.recordRepo.update(record.id, { breakStart: new Date().toISOString() } as any) as Promise<AttendanceRecordDTO>
  }

  async endBreak(employeeId: string): Promise<AttendanceRecordDTO> {
    const today = new Date().toISOString().slice(0, 10)
    const record = await this.recordRepo.findOne({ employeeId, date: today })
    if (!record?.breakStart) throw new ValidationError('Debés iniciar descanso primero')
    if (record.breakEnd) throw new ValidationError('Descanso ya finalizado')
    return this.recordRepo.update(record.id, { breakEnd: new Date().toISOString() } as any) as Promise<AttendanceRecordDTO>
  }

  async manualRecord(employeeId: string, hotelId: string, data: { clockIn: string; clockOut?: string; notes?: string }, approvedBy: string): Promise<AttendanceRecordDTO> {
    const today = data.clockIn.slice(0, 10)
    const existing = await this.recordRepo.findOne({ employeeId, date: today })

    // Compute hours if both clockIn and clockOut provided
    let totalHours: number | null = null
    let overtimeHours = 0
    if (data.clockIn && data.clockOut) {
      const clockInMs = new Date(data.clockIn).getTime()
      const clockOutMs = new Date(data.clockOut).getTime()
      totalHours = Math.round(((clockOutMs - clockInMs) / 3600000) * 100) / 100
      const config = await this.configRepo.findOne({ hotelId })
      const schedule = await this.getEmployeeSchedule(employeeId, hotelId)
      if (schedule && config?.overtimeEnabled) {
        const [sh, sm] = schedule.startTime.split(':').map(Number)
        const [eh, em] = schedule.endTime.split(':').map(Number)
        const standardMinutes = (eh * 60 + em) - (sh * 60 + sm) - schedule.breakMinutes
        const standardHours = standardMinutes / 60
        const otThreshold = schedule.overtimeThresholdMinutes / 60
        overtimeHours = Math.max(0, totalHours - standardHours - otThreshold)
      }
    }

    const patch: any = {
      clockIn: data.clockIn, clockOut: data.clockOut ?? null,
      method: 'manual', notes: data.notes ?? null, approvedBy,
    }
    if (totalHours !== null) {
      patch.totalHours = totalHours
      patch.overtimeHours = Math.round(overtimeHours * 100) / 100
    }

    if (existing) {
      return this.recordRepo.update(existing.id, patch) as Promise<AttendanceRecordDTO>
    }
    return this.recordRepo.create({
      employeeId, hotelId, date: today, ...patch,
    } as any)
  }

  async getToday(employeeId: string, hotelId?: string): Promise<AttendanceRecordDTO | null> {
    const today = new Date().toISOString().slice(0, 10)
    const filters: Record<string, unknown> = { employeeId, date: today }
    if (hotelId) filters.hotelId = hotelId
    return this.recordRepo.findOne(filters)
  }

  async list(hotelId: string, from?: string, to?: string, employeeId?: string): Promise<AttendanceRecordDTO[]> {
    // El rango NO va al findMany: el ORM bindea `{ $gte }` crudo y rompe. Se acota en memoria.
    const filters: Record<string, any> = { hotelId }
    if (employeeId) filters.employeeId = employeeId
    const records = await this.recordRepo.findMany(filters)
    return inDateRange(records, 'date', from, to)
  }

  /**
   * Asistencia por empleado para el motor de evaluación (#321): a-tiempo / ausente / tarde.
   * `date` es 'YYYY-MM-DD' → `from`/`to` deben venir en el mismo formato (los provee el motor).
   */
  async getStaffAttendance(hotelId: string, from: string, to: string): Promise<{ employeeId: string; present: number; absent: number; late: number }[]> {
    const all = await this.recordRepo.findMany({ hotelId })
    const records = inDateRange(all, 'date', from, to)
    const byEmployee = new Map<string, { present: number; absent: number; late: number }>()
    for (const r of records) {
      const acc = byEmployee.get(r.employeeId) ?? { present: 0, absent: 0, late: 0 }
      if (r.status === 'absent') acc.absent += 1
      else if (r.status === 'late') acc.late += 1
      else if (r.clockIn) acc.present += 1
      byEmployee.set(r.employeeId, acc)
    }
    return [...byEmployee.entries()].map(([employeeId, v]) => ({ employeeId, ...v }))
  }

  async getReport(hotelId: string, from: string, to: string): Promise<AttendanceReport[]> {
    const all = await this.recordRepo.findMany({ hotelId })
    const records = inDateRange(all, 'date', from, to)
    const byEmployee = new Map<string, { days: number; hours: number; ot: number; abs: number; late: number }>()

    for (const r of records) {
      if (!byEmployee.has(r.employeeId)) byEmployee.set(r.employeeId, { days: 0, hours: 0, ot: 0, abs: 0, late: 0 })
      const e = byEmployee.get(r.employeeId)!
      if (r.clockIn) { e.days++; e.hours += r.totalHours ?? 0; e.ot += r.overtimeHours }
      if (r.status === 'absent') e.abs++
      if (r.status === 'late') e.late++
    }

    return Array.from(byEmployee.entries()).map(([employeeId, d]) => ({
      employeeId, daysWorked: d.days, hoursWorked: Math.round(d.hours * 100) / 100,
      overtimeHours: Math.round(d.ot * 100) / 100, absences: d.abs, lateArrivals: d.late,
    }))
  }

  private async getEmployeeSchedule(employeeId: string, hotelId: string): Promise<AttendanceScheduleDTO | null> {
    const config = await this.configRepo.findOne({ hotelId })
    // @ignore IDOR_RISK — schedule lookup via config
    if (config?.defaultScheduleId) return this.scheduleRepo.findById(config.defaultScheduleId)
    const schedules = await this.scheduleRepo.findMany({ hotelId, active: 1 })
    return schedules[0] ?? null
  }
}
