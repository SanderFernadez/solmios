import type { AdminAnalyticsDTO, MonitoringDTO } from './types'

export interface AdminSockets {
  onPlanCreated?: (data: any) => Promise<void>
  onPlanUpdated?: (data: any) => Promise<void>
  onPlanDeleted?: (id: string) => Promise<void>
  onAmenityCatalogCreated?: (data: any) => Promise<void>
  onAmenityCatalogUpdated?: (data: any) => Promise<void>
  onAmenityCatalogDeleted?: (id: string) => Promise<void>
}
