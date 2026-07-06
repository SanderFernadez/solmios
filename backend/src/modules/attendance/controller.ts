// attendance/controller.ts
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { AttendanceService } from './service'
import { CreateScheduleSchema, ManualRecordSchema, ClockInSchema, ClockOutSchema, BiometricRecordSchema, UpdateConfigSchema } from './validators/schema'

export class AttendanceController {
  constructor(private readonly service: AttendanceService, private readonly logger: Logger) {}

  async clockIn(req: HttpRequest) {
    const b = validateSchema(ClockInSchema, req.body) as any
    const hotelId = (req as any).user?.hotelId; const employeeId = b.employeeId ?? (req as any).userId
    return { status: 201, body: await this.service.clockIn(employeeId, hotelId, b.method) }
  }
  async clockOut(req: HttpRequest) {
    const b = validateSchema(ClockOutSchema, req.body) as any
    return { status: 200, body: await this.service.clockOut(b.employeeId ?? (req as any).userId, (req as any).user?.hotelId) }
  }
  async startBreak(req: HttpRequest) {
    const b = validateSchema(ClockOutSchema, req.body) as any
    return { status: 200, body: await this.service.startBreak(b.employeeId ?? (req as any).userId) }
  }
  async endBreak(req: HttpRequest) {
    const b = validateSchema(ClockOutSchema, req.body) as any
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
  async updateConfig(req: HttpRequest) {
    const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId
    if (!hotelId) return { status: 400, body: { error: 'hotelId requerido' } }
    const data = validateSchema(UpdateConfigSchema, req.body)
    return { status: 200, body: await this.service.updateConfig(hotelId, data) }
  }

  async biometricRecord(req: HttpRequest) {
    // Webhook de lector biométrico (ZKTeco). No hay JWT de usuario — se autentica
    // con una device key compartida (patrón env-secret, como STRIPE_WEBHOOK_SECRET).
    // Fail-closed: sin ATTENDANCE_BIOMETRIC_KEY configurada, el endpoint queda cerrado.
    const expected = process.env.ATTENDANCE_BIOMETRIC_KEY
    const provided = (req.headers as any)?.['x-device-key'] || (req.headers as any)?.['x-api-key']
    if (!expected || provided !== expected) {
      return { status: 401, body: { error: 'Device key inválida o no configurada' } }
    }
    const b = validateSchema(BiometricRecordSchema, req.body) as any
    if (b.type === 'clock_in') return { status: 201, body: await this.service.clockIn(b.employeeId, b.hotelId, 'fingerprint') }
    if (b.type === 'clock_out') return { status: 200, body: await this.service.clockOut(b.employeeId, b.hotelId) }
    return { status: 400, body: { error: 'Unknown event type' } }
  }
}
