// attendance/service.ts
import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type {
  AttendanceRecordDTO, AttendanceScheduleDTO, CreateAttendanceScheduleDTO,
  AttendanceConfigDTO, AttendanceReport, AttendanceQuery,
  ShiftAssignmentDTO, CreateShiftAssignmentDTO,
} from './types'
import type { AttendanceSockets } from './sockets'
import { ClockUseCase } from './usecases/clock'
import { ShiftAssignmentUseCase } from './usecases/shift-assignments'
import { accumulateSockets } from '../../shared/utils/accumulate-sockets'

export class AttendanceService {
  private sockets: AttendanceSockets = {}
  private clock: ClockUseCase
  private shifts: ShiftAssignmentUseCase

  constructor(
    recordRepo: RepositoryAdapter<AttendanceRecordDTO>,
    private readonly scheduleRepo: RepositoryAdapter<AttendanceScheduleDTO>,
    private readonly configRepo: RepositoryAdapter<AttendanceConfigDTO>,
    private readonly logger: Logger,
    cache: CacheAdapter,
    private readonly auth?: Auth,
    assignmentRepo?: RepositoryAdapter<ShiftAssignmentDTO>,
    profileRepo?: RepositoryAdapter<{ id: string; hotelId: string }>,
  ) {
    this.clock = new ClockUseCase(recordRepo, scheduleRepo, configRepo, logger)
    this.shifts = new ShiftAssignmentUseCase(assignmentRepo as any, scheduleRepo as any, profileRepo as any, logger)
  }

  // ─── Calendario de Turnos ─────────────────────────────
  async listShiftAssignments(hotelId: string, from?: string, to?: string, employeeId?: string) { return this.shifts.list(hotelId, from, to, employeeId) }
  async assignShift(dto: CreateShiftAssignmentDTO) { return this.shifts.assign(dto) }
  async removeShiftAssignment(id: string, hotelId: string) { return this.shifts.remove(id, hotelId) }

  setSockets(s: Partial<AttendanceSockets>): void {
    accumulateSockets(this.sockets, s)
  }

  // ─── Clock ────────────────────────────────────────────
  async clockIn(employeeId: string, hotelId: string, method?: string, location?: string) { return this.clock.clockIn(employeeId, hotelId, method, location) }
  async clockOut(employeeId: string, hotelId: string) { return this.clock.clockOut(employeeId, hotelId) }
  async startBreak(employeeId: string) { return this.clock.startBreak(employeeId) }
  async endBreak(employeeId: string) { return this.clock.endBreak(employeeId) }
  async manualRecord(employeeId: string, hotelId: string, data: { clockIn: string; clockOut?: string; notes?: string }, approvedBy: string) { return this.clock.manualRecord(employeeId, hotelId, data, approvedBy) }
  async getToday(employeeId: string, hotelId?: string) { return this.clock.getToday(employeeId, hotelId) }
  async listRecords(query: AttendanceQuery) { return this.clock.list(query.hotelId ?? '', query.from, query.to, query.employeeId) }
  async getReport(hotelId: string, from: string, to: string) { return this.clock.getReport(hotelId, from, to) }

  /** Resumen de asistencia de HOY para el dashboard (#198): presentes (con fichaje) y tardanzas. */
  async getTodaySummary(hotelId: string): Promise<{ present: number; late: number }> {
    const today = new Date().toISOString().slice(0, 10)
    const records = await this.clock.list(hotelId, today, today)
    const present = new Set(records.filter((r) => r.clockIn).map((r) => r.employeeId)).size
    const late = records.filter((r) => r.status === 'late').length
    return { present, late }
  }

  // ─── Schedules ────────────────────────────────────────
  async createSchedule(dto: CreateAttendanceScheduleDTO) { return this.scheduleRepo.create({ ...dto, active: 1 } as any) }
  async getSchedule(id: string, hotelId?: string) {
    const s = await this.scheduleRepo.findById(id)
    if (!s) throw new NotFoundError('Schedule not found')
    if (hotelId && s.hotelId !== hotelId) throw new AuthError('Not authorized to view this schedule')
    this.auth?.assertOwnership(s.hotelId, hotelId ?? s.hotelId, undefined, 'super_admin')
    return s
  }
  async listSchedules(hotelId: string) { return this.scheduleRepo.findMany({ hotelId, active: 1 }) }
  async deleteSchedule(id: string, hotelId?: string) {
    const s = await this.scheduleRepo.findById(id)
    if (!s) throw new NotFoundError('Schedule not found')
    if (hotelId && s.hotelId !== hotelId) throw new AuthError('Not authorized to delete this schedule')
    this.auth?.assertOwnership(s.hotelId, hotelId ?? s.hotelId, undefined, 'super_admin')
    await this.scheduleRepo.update(id, { active: 0 } as any)
  }

  // ─── Config ───────────────────────────────────────────
  async getConfig(hotelId: string) { const existing = await this.configRepo.findOne({ hotelId }); if (existing) return existing; return this.configRepo.create({ hotelId } as any) }
  async updateConfig(hotelId: string, data: Partial<AttendanceConfigDTO>) { const config = await this.getConfig(hotelId); return this.configRepo.update(config.id, data as any) as Promise<AttendanceConfigDTO> }
}
