export interface TTLockSockets {
  onConfigUpdated?: (hotelId: string) => Promise<void>
  onLocksSynced?: (hotelId: string, count: number) => Promise<void>
  onCodeGenerated?: (data: { reservationId: string; codeId: string }) => Promise<void>
  onCodeRevoked?: (codeId: string) => Promise<void>
  onLockUpdated?: (lockId: string) => Promise<void>
}
