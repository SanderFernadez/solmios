export interface DashboardSockets {
  onDashboardDataChanged?: () => Promise<void>
}
