// attendance/controller.ts
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { AttendanceService } from './service'
import { CreateScheduleSchema, ManualRecordSchema } from './validators/schema'

export class AttendanceController {
  constructor(private readonly service: AttendanceService, private readonly logger: Logger) {}

  async clockIn(req: HttpRequest) {
    const b = req.body as Record<string, any>
    const hotelId = (req as any).user?.hotelId; const employeeId = b.employeeId ?? (req as any).userId
    return { status: 201, body: await this.service.clockIn(employeeId, hotelId, b.method) }
  }
  async clockOut(req: HttpRequest) {
    const b = req.body as Record<string, any>
    return { status: 200, body: await this.service.clockOut(b.employeeId ?? (req as any).userId, (req as any).user?.hotelId) }
  }
  async startBreak(req: HttpRequest) {
    const b = req.body as Record<string, any>
    return { status: 200, body: await this.service.startBreak(b.employeeId ?? (req as any).userId) }
  }
  async endBreak(req: HttpRequest) {
    const b = req.body as Record<string, any>
    return { status: 200, body: await this.service.endBreak(b.employeeId ?? (req as any).userId) }
  }
  async manualRecord(req: HttpRequest) {
    const b = validateSchema(ManualRecordSchema, req.body) as any
    return { status: 201, body: await this.service.manualRecord(b.employeeId, (req as any).user?.hotelId, { clockIn: b.clockIn, clockOut: b.clockOut, notes: b.notes }, (req as any).userId) }
  }
  async getToday(req: HttpRequest) { return { status: 200, body: await this.service.getToday(req.params.employeeId) } }
  async listRecords(req: HttpRequest) { const q = req.query as any; q.hotelId = (req as any).user?.hotelId ?? q.hotelId; return { status: 200, body: await this.service.listRecords(q) } }
  async getReport(req: HttpRequest) { const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId; const { from, to } = req.query as any; return { status: 200, body: await this.service.getReport(hotelId, from, to) } }

  async createSchedule(req: HttpRequest) {
    const data = validateSchema(CreateScheduleSchema, req.body) as any
    data.hotelId = (req as any).user?.hotelId ?? data.hotelId
    return { status: 201, body: await this.service.createSchedule(data) }
  }
  async getSchedule(req: HttpRequest) { return { status: 200, body: await this.service.getSchedule(req.params.id) } }
  async listSchedules(req: HttpRequest) { return { status: 200, body: await this.service.listSchedules((req as any).user?.hotelId ?? (req.query as any).hotelId) } }
  async deleteSchedule(req: HttpRequest) { await this.service.deleteSchedule(req.params.id); return { status: 204, body: null } }

  async getConfig(req: HttpRequest) { const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId; if (!hotelId) return { status: 400, body: { error: 'hotelId requerido' } }; return { status: 200, body: await this.service.getConfig(hotelId) } }
  async updateConfig(req: HttpRequest) { const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId; if (!hotelId) return { status: 400, body: { error: 'hotelId requerido' } }; return { status: 200, body: await this.service.updateConfig(hotelId, req.body as any) } }

  async biometricRecord(req: HttpRequest) {
    const b = req.body as Record<string, any>
    if (b.type === 'clock_in') return { status: 201, body: await this.service.clockIn(b.employeeId, b.hotelId, 'fingerprint') }
    if (b.type === 'clock_out') return { status: 200, body: await this.service.clockOut(b.employeeId, b.hotelId) }
    return { status: 400, body: { error: 'Unknown event type' } }
  }
}
