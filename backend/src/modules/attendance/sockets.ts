// attendance/sockets.ts
import type { AttendanceRecordDTO } from './types'

export interface AttendanceSockets {
  onClockIn?: (record: AttendanceRecordDTO) => Promise<void>
  onClockOut?: (record: AttendanceRecordDTO) => Promise<void>
}
