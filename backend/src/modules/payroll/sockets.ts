// payroll/sockets.ts
import type { PayrollRunDTO } from './types'

export interface PayrollSockets {
  onRunCreated?: (run: PayrollRunDTO) => Promise<void>
  onRunApproved?: (run: PayrollRunDTO) => Promise<void>
  onRunPaid?: (run: PayrollRunDTO) => Promise<void>
}
