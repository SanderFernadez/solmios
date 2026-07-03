import type { ModelDefinition, ORM } from 'arckode-framework'

export const SeasonsModel: ModelDefinition = {
  table: 'seasons',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true },
    name: { type: 'string', required: true },
    label: { type: 'string' },
    startDate: { type: 'string' },
    endDate: { type: 'string' },
    color: { type: 'string', default: '#3b82f6' },
    sortOrder: { type: 'number', default: 0 },
  },
  timestamps: true,
}

export const RoomRatesModel: ModelDefinition = {
  table: 'room_rates',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true },
    roomType: { type: 'string', required: true },
    occupancy: { type: 'number', default: 2 },
    season: { type: 'string', required: true },
    basePrice: { type: 'number', default: 0 },
    percentage: { type: 'number', default: 0 },
    price: { type: 'number', default: 0 },
    closed: { type: 'number', default: 0 },
  },
  timestamps: true,
}

export const RoomBlocksModel: ModelDefinition = {
  table: 'room_blocks',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true },
    roomId: { type: 'string', required: true },
    reason: { type: 'string' },
    startDate: { type: 'string', required: true },
    endDate: { type: 'string', required: true },
    createdBy: { type: 'string' },
  },
  timestamps: true,
}

export const RateRestrictionsModel: ModelDefinition = {
  table: 'rate_restrictions',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true },
    roomType: { type: 'string', required: true },
    season: { type: 'string', required: true },
    minStay: { type: 'number', default: 0 },
    maxStay: { type: 'number', default: 0 },
    cta: { type: 'number', default: 0 },
    ctd: { type: 'number', default: 0 },
    closedToArrival: { type: 'number', default: 0 },
    closedToDeparture: { type: 'number', default: 0 },
  },
  timestamps: true,
}

export function registerPricingModels(orm: ORM): void {
  orm.define('Seasons', SeasonsModel)
  orm.define('RoomRates', RoomRatesModel)
  orm.define('RoomBlocks', RoomBlocksModel)
  orm.define('RateRestrictions', RateRestrictionsModel)
}
