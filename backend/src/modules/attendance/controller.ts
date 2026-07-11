// attendance/controller.ts
import type { HttpRequest, Logger } from 'arckode-framework'
import { validateSchema } from 'arckode-framework'
import type { AttendanceService } from './service'
import { CreateScheduleSchema, ManualRecordSchema, ClockInSchema, ClockOutSchema, BiometricRecordSchema, UpdateConfigSchema, CreateShiftAssignmentSchema } from './validators/schema'
import { hasPermission } from '../../shared/permissions'
import { resolveAttendanceTarget, type EmployeeProfileFinder } from '../../shared/usecases/resolve-employee'

/**
 * `hotelId` es obligatorio en el schema del turno pero el cliente no lo manda: sale del token. Se
 * inyectaba DESPUÉS de `validateSchema` → crear un turno desde el frontend daba 400. Va antes.
 */
const withHotelId = (req: HttpRequest): Record<string, unknown> => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const fromReq = (req as any).user?.hotelId ?? (req.query as any)?.hotelId
  return { ...body, hotelId: fromReq ?? body.hotelId }
}

export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
    private readonly logger: Logger,
    private readonly profiles: EmployeeProfileFinder,
  ) {}

  /**
   * A quién se le imputa el fichaje. Antes leía `req.userId` —que no existe— así que sin
   * `employeeId` en el body escribía un registro con el campo vacío. Y aceptaba cualquier
   * `employeeId`: se podía fichar por otro.
   */
  private async target(req: HttpRequest, requested?: string): Promise<string> {
    const user = (req as any).user
    const canActForOthers = hasPermission(user?.permissions ?? [], 'attendance', 'edit')
    return resolveAttendanceTarget(this.profiles, user ?? {}, requested, canActForOthers)
  }

  async clockIn(req: HttpRequest) {
    const b = validateSchema(ClockInSchema, req.body) as any
    const hotelId = (req as any).user?.hotelId
    return { status: 201, body: await this.service.clockIn(await this.target(req, b.employeeId), hotelId, b.method) }
  }
  async clockOut(req: HttpRequest) {
    const b = validateSchema(ClockOutSchema, req.body) as any
    return { status: 200, body: await this.service.clockOut(await this.target(req, b.employeeId), (req as any).user?.hotelId) }
  }
  async startBreak(req: HttpRequest) {
    const b = validateSchema(ClockOutSchema, req.body) as any
    return { status: 200, body: await this.service.startBreak(await this.target(req, b.employeeId)) }
  }
  async endBreak(req: HttpRequest) {
    const b = validateSchema(ClockOutSchema, req.body) as any
    return { status: 200, body: await this.service.endBreak(await this.target(req, b.employeeId)) }
  }
  async manualRecord(req: HttpRequest) {
    const b = validateSchema(ManualRecordSchema, req.body) as any
    return { status: 201, body: await this.service.manualRecord(b.employeeId, (req as any).user?.hotelId, { clockIn: b.clockIn, clockOut: b.clockOut, notes: b.notes }, (req as any).userId) }
  }
  async getToday(req: HttpRequest) { return { status: 200, body: await this.service.getToday(req.params.employeeId, (req as any).user?.hotelId) } }
  async listRecords(req: HttpRequest) { const q = req.query as any; q.hotelId = (req as any).user?.hotelId ?? q.hotelId; return { status: 200, body: await this.service.listRecords(q) } }
  async getReport(req: HttpRequest) { const hotelId = (req as any).user?.hotelId ?? (req.query as any).hotelId; const { from, to } = req.query as any; return { status: 200, body: await this.service.getReport(hotelId, from, to) } }

  async createSchedule(req: HttpRequest) {
    const data = validateSchema(CreateScheduleSchema, withHotelId(req)) as any
    return { status: 201, body: await this.service.createSchedule(data) }
  }
  async getSchedule(req: HttpRequest) { return { status: 200, body: await this.service.getSchedule(req.params.id, (req as any).user?.hotelId) } }
  async listSchedules(req: HttpRequest) { return { status: 200, body: await this.service.listSchedules((req as any).user?.hotelId ?? (req.query as any).hotelId) } }
  async deleteSchedule(req: HttpRequest) { await this.service.deleteSchedule(req.params.id, (req as any).user?.hotelId); return { status: 204, body: null } }

  // ─── Calendario de Turnos ─────────────────────────────
  async listShiftAssignments(req: HttpRequest) {
    const q = req.query as any
    const hotelId = (req as any).user?.hotelId ?? q.hotelId
    return { status: 200, body: await this.service.listShiftAssignments(hotelId, q.from, q.to, q.employeeId) }
  }
  async assignShift(req: HttpRequest) {
    const data = validateSchema(CreateShiftAssignmentSchema, withHotelId(req)) as any
    return { status: 201, body: await this.service.assignShift(data) }
  }
  async removeShiftAssignment(req: HttpRequest) {
    await this.service.removeShiftAssignment(req.params.id, (req as any).user?.hotelId)
    return { status: 204, body: null }
  }

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
    // Validate hotelId against registered device hotel (prevents cross-tenant clock-in via stolen key)
    const allowedHotelId = process.env.ATTENDANCE_BIOMETRIC_HOTEL_ID
    if (allowedHotelId && b.hotelId !== allowedHotelId) {
      return { status: 403, body: { error: 'Device not authorized for this hotel' } }
    }
    if (b.type === 'clock_in') return { status: 201, body: await this.service.clockIn(b.employeeId, b.hotelId, 'fingerprint') }
    if (b.type === 'clock_out') return { status: 200, body: await this.service.clockOut(b.employeeId, b.hotelId) }
    return { status: 400, body: { error: 'Unknown event type' } }
  }
}
