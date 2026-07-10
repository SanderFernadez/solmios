// attendance/index.ts — PUERTA PÚBLICA
import { createModule, OrmRepository } from 'arckode-framework'
import { registerAttendanceModels } from './model'
import { AttendanceService } from './service'
import { AttendanceController } from './controller'
import type { AttendanceRecordDTO, AttendanceScheduleDTO, AttendanceConfigDTO } from './types'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'

export { AttendanceService }
export type { AttendanceRecordDTO, AttendanceScheduleDTO, AttendanceConfigDTO, AttendanceReport, AttendanceQuery } from './types'
export type { AttendanceSockets } from './sockets'

export function AttendanceModule() {
  return createModule({
    name: 'attendance', version: '1.0.0',
    description: 'Asistencia — fichaje digital, horarios, reportes',

    contract: {
      name: 'attendance', version: '1.0.0',
      description: 'Ponche digital + horarios',
      actions: ['clockIn','clockOut','startBreak','endBreak','manualRecord','getToday','listRecords','getReport','createSchedule','listSchedules','deleteSchedule','getConfig','updateConfig'],
      events: ['onClockIn','onClockOut'],
      tables: ['attendance_records','attendance_schedules','attendance_config'],
      dependencies: [],
      rules: ['No importar de otros módulos'],
    },

    create({ logger, orm, cache, router, auth }) {
      if (!auth) throw new Error('attendance: auth dependency required')
      registerAttendanceModels(orm)

      const recordRepo = new OrmRepository<AttendanceRecordDTO>(orm, 'AttendanceRecord')
      const scheduleRepo = new OrmRepository<AttendanceScheduleDTO>(orm, 'AttendanceSchedule')
      const configRepo = new OrmRepository<AttendanceConfigDTO>(orm, 'AttendanceConfig')
      // Cross-table, no cross-module: el fichaje se imputa al perfil de empleado del token.
      const profileRepo = new OrmRepository<{ id: string }>(orm, 'EmployeeProfile')

      const log = logger.child('attendance')
      const service = new AttendanceService(recordRepo, scheduleRepo, configRepo, log, cache, auth)
      const controller = new AttendanceController(service, log, profileRepo)

      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const guard = createPermissionGuard(auth, roleRepo)

      // Clock — fichar es una acción del propio empleado, no administrar usuarios. Antes pedía
      // `users:create`, que solo tiene hotel_admin: ninguna camarera ni recepcionista podía fichar.
      router.post('/api/attendance/clock-in', guard('attendance', 'create'), (req) => controller.clockIn(req))
      router.post('/api/attendance/clock-out', guard('attendance', 'create'), (req) => controller.clockOut(req))
      router.post('/api/attendance/break/start', guard('attendance', 'create'), (req) => controller.startBreak(req))
      router.post('/api/attendance/break/end', guard('attendance', 'create'), (req) => controller.endBreak(req))
      // Corregir un fichaje ajeno sí es una acción de supervisión.
      router.post('/api/attendance/manual', guard('attendance', 'edit'), (req) => controller.manualRecord(req))
      router.get('/api/attendance/today/:employeeId', guard('attendance', 'view'), (req) => controller.getToday(req))
      router.get('/api/attendance/records', guard('attendance', 'view'), (req) => controller.listRecords(req))
      router.get('/api/attendance/report', guard('attendance', 'view'), (req) => controller.getReport(req))

      // Schedules — armar el turno de otro es supervisión, no autoservicio.
      router.post('/api/attendance/schedules', guard('attendance', 'edit'), (req) => controller.createSchedule(req))
      router.get('/api/attendance/schedules', guard('attendance', 'view'), (req) => controller.listSchedules(req))
      router.get('/api/attendance/schedules/:id', guard('attendance', 'view'), (req) => controller.getSchedule(req))
      router.delete('/api/attendance/schedules/:id', guard('attendance', 'edit'), (req) => controller.deleteSchedule(req))

      // Config
      router.get('/api/attendance/config', guard('attendance', 'view'), (req) => controller.getConfig(req))
      router.put('/api/attendance/config', guard('attendance', 'edit'), (req) => controller.updateConfig(req))

      // Biometric device webhook (ZKTeco / fingerprint — public, key-protected)
      router.post('/api/attendance/biometric', (req) => controller.biometricRecord(req))

      log.info('Módulo attendance listo — 3 tablas, 15 endpoints')
      return service
    },
  })
}
