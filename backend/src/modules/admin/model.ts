import type { ModelDefinition, ORM } from 'arckode-framework'

export const PlansModel: ModelDefinition = {
  table: 'plans',
  fields: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    slug: { type: 'string', required: true },
    price: { type: 'number', required: true },
    currency: { type: 'string', default: 'USD' },
    description: { type: 'string' },
    features: { type: 'json' },
    limits: { type: 'json' },
    isActive: { type: 'number', default: 1 },
    sortOrder: { type: 'number', default: 0 },
  },
  timestamps: true,
}

export const AmenitiesCatalogModel: ModelDefinition = {
  table: 'amenities_catalog',
  fields: {
    id: { type: 'string', required: true },
    key: { type: 'string', required: true },
    label: { type: 'string', required: true },
    category: { type: 'string', default: 'interior' },
    icon: { type: 'string' },
    isActive: { type: 'number', default: 1 },
    sortOrder: { type: 'number', default: 0 },
  },
  timestamps: true,
}

export function registerAdminModels(orm: ORM): void {
  orm.define('Plans', PlansModel)
  orm.define('AmenitiesCatalog', AmenitiesCatalogModel)
}
