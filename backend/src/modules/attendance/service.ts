// attendance/service.ts
import type { RepositoryAdapter, Logger, CacheAdapter, Auth } from 'arckode-framework'
import { NotFoundError, AuthError } from 'arckode-framework'
import type {
  AttendanceRecordDTO, AttendanceScheduleDTO, CreateAttendanceScheduleDTO,
  AttendanceConfigDTO, AttendanceReport, AttendanceQuery,
} from './types'
import type { AttendanceSockets } from './sockets'
import { ClockUseCase } from './usecases/clock'
import { accumulateSockets } from '../../shared/utils/accumulate-sockets'

export class AttendanceService {
  private sockets: AttendanceSockets = {}
  private clock: ClockUseCase

  constructor(
    recordRepo: RepositoryAdapter<AttendanceRecordDTO>,
    private readonly scheduleRepo: RepositoryAdapter<AttendanceScheduleDTO>,
    private readonly configRepo: RepositoryAdapter<AttendanceConfigDTO>,
    private readonly logger: Logger,
    cache: CacheAdapter,
    private readonly auth?: Auth,
  ) {
    this.clock = new ClockUseCase(recordRepo, scheduleRepo, configRepo, logger)
  }

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
    await this.scheduleRepo.update(id, { active: 0 } as any)
  }

  // ─── Config ───────────────────────────────────────────
  async getConfig(hotelId: string) { const existing = await this.configRepo.findOne({ hotelId }); if (existing) return existing; return this.configRepo.create({ hotelId } as any) }
  async updateConfig(hotelId: string, data: Partial<AttendanceConfigDTO>) { const config = await this.getConfig(hotelId); return this.configRepo.update(config.id, data as any) as Promise<AttendanceConfigDTO> }
}
