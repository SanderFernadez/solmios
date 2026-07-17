import { http } from './http'

export interface Channel {
  id?: string
  name: string
  type: string
  conectado: boolean
  activo?: boolean
  bookings?: number
  ultimaSync?: string
  otaCode?: string
  icono?: string
  color?: string
  descripcion?: string
}

export interface ChannelStatus {
  data: Channel[]
  connectedCount: number
  pendingBookings: number
  syncEnabled: boolean
  lastSync: string | null
  channexPropertyId: string | null
}

export interface TestConnectionResult {
  success: boolean
  message: string
  details?: unknown
}

export interface MappingDetail {
  id: number
  title: string
  rates?: MappingRate[]
  max_children?: number | null
}

export interface MappingRate {
  id: number
  title: string
  pricing: string
  max_persons: number
  occupancies: number[]
  readonly?: boolean
}

export interface MappingResult {
  success: boolean
  rooms: MappingDetail[]
  error?: string
}

export interface GroupItem {
  id: string
  name: string
}

export interface OTAConnectPayload {
  hotelId: string
  channel: string
  title: string
  groupId: string
  propertyId: string
  ratePlans: {
    ratePlanId: string
    roomTypeCode: number
    ratePlanCode: number
    occupancy: number
    pricingType: string
    primaryOcc?: boolean
  }[]
  settings?: Record<string, unknown>
}

export interface OTAConnectResult {
  success: boolean
  message: string
  channelId?: string
  steps?: { test: boolean; mapping: boolean; create: boolean; activate: boolean }
}

export const ChannelService = {
  async status(hotelId?: string): Promise<ChannelStatus> {
    const query = hotelId ? `?hotelId=${hotelId}` : ''
    return http.get<ChannelStatus>(`/channels${query}`)
  },

  async sync(hotelId?: string): Promise<{ success: boolean; message: string; channexPropertyId?: string }> {
    return http.post('/channels/sync', hotelId ? { hotelId } : {})
  },

  async testConnection(hotelId: string, channel: string, otaHotelId: string): Promise<TestConnectionResult> {
    return http.post('/channels/test-connection', { hotelId, channel, hotel_id: otaHotelId })
  },

  async mappingDetails(hotelId: string, channel: string, otaHotelId: string): Promise<MappingResult> {
    return http.get(`/channels/mapping-details?hotelId=${hotelId}&channel=${channel}&hotel_id=${otaHotelId}`)
  },

  async groups(hotelId?: string): Promise<GroupItem[]> {
    const query = hotelId ? `?hotelId=${hotelId}` : ''
    return http.get(`/channels/groups${query}`)
  },

  async connect(payload: OTAConnectPayload): Promise<OTAConnectResult> {
    return http.post('/channels/connect', payload)
  },

  async deactivate(hotelId: string, channelId: string): Promise<{ success: boolean; message: string }> {
    return http.post(`/channels/${channelId}/deactivate`, { hotelId })
  },

  async bookings(hotelId?: string): Promise<{ data: any[]; total: number }> {
    const query = hotelId ? `?hotelId=${hotelId}` : ''
    return http.get(`/channels/bookings${query}`)
  },

  async ingestBookings(hotelId?: string): Promise<any> {
    return http.post('/channels/bookings/ingest', hotelId ? { hotelId } : {})
  },

  async iframeToken(hotelId?: string, username?: string): Promise<{ token: string; iframeUrl: string }> {
    const q = new URLSearchParams()
    if (hotelId) q.set('hotelId', hotelId)
    if (username) q.set('username', username)
    return http.get(`/channels/iframe-token?${q.toString()}`)
  },

  async detail(channelId: string): Promise<any> {
    return http.get(`/channels/${channelId}/detail`)
  },

  async syncLog(hotelId?: string): Promise<any> {
    return http.get(`/channels/sync-log${hotelId ? `?hotelId=${hotelId}` : ''}`)
  },
}
