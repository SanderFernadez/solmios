export interface ReportsSockets {
  onNightAuditCompleted?: (data: any) => Promise<void>
  onNoShowsMarked?: (count: number) => Promise<void>
}
