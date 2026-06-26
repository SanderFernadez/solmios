// bookingengine/model.ts — Schema de base de datos
// 3 tablas: BookingConfig (config widget), AvailabilityCache (stock diario), ConversionEvents (analytics)

import type { ModelDefinition, ORM } from 'arckode-framework'

export const BookingConfigModel: ModelDefinition = {
  table: 'booking_config',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    enabled: { type: 'boolean', default: true },
    theme: { type: 'string', default: 'navy' },
    position: { type: 'string', default: 'corner' },
    currency: { type: 'string', default: 'USD' },
    language: { type: 'string', default: 'es' },
    minNights: { type: 'number', default: 1 },
    maxNights: { type: 'number', default: 30 },
    cancellationPolicy: { type: 'string', default: 'flexible' },
    showComparison: { type: 'boolean', default: true },
    googleAdsEnabled: { type: 'boolean', default: false },
    whatsappConfirmation: { type: 'boolean', default: false },
    instantConfirmation: { type: 'boolean', default: true },
    stripeAccountId: { type: 'string', default: '' },
    allowedCountries: { type: 'json', default: [] },
  },
}

export const AvailabilityCacheModel: ModelDefinition = {
  table: 'availability_cache',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    roomType: { type: 'string', required: true },
    date: { type: 'string', required: true },
    totalRooms: { type: 'number', default: 0 },
    occupied: { type: 'number', default: 0 },
    blocked: { type: 'number', default: 0 },
    available: { type: 'number', default: 0 },
    price: { type: 'number', default: 0 },
    currency: { type: 'string', default: 'USD' },
  },
}

export const ConversionEventsModel: ModelDefinition = {
  table: 'conversion_events',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    sessionId: { type: 'string', required: true },
    event: { type: 'string', required: true },
    roomType: { type: 'string' },
    amount: { type: 'number' },
    source: { type: 'string' },
    utmSource: { type: 'string' },
    utmMedium: { type: 'string' },
    utmCampaign: { type: 'string' },
    device: { type: 'string' },
    country: { type: 'string' },
  },
}

export function registerBookingengineModels(orm: ORM): void {
  orm.define('BookingConfig', BookingConfigModel)
  orm.define('AvailabilityCache', AvailabilityCacheModel)
  orm.define('ConversionEvents', ConversionEventsModel)
}
