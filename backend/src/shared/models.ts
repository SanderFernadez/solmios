// shared/models.ts — Definiciones de modelos ORM compartidos.
// Estos modelos son usados por múltiples módulos o son cross-cutting concerns.
// Los modelos específicos de módulo viven en sus respectivos model.ts.

import type { ORM } from 'arckode-framework'

/**
 * Registra todos los modelos compartidos en el ORM.
 * Llamar una vez al inicio en composition-root.ts.
 */
export function registerSharedModels(orm: ORM): void {
  // ─── Configuration (key-value por hotel) ──────────────
  orm.define('Configuration', {
    table: 'configuration', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      hotelId: { type: 'string', required: true },
      key: { type: 'string', required: true, indexed: true },
      value: { type: 'json', default: {} },
    },
  })

  // ─── Plans (SaaS subscriptions) ──────────────────────
  orm.define('Plans', {
    table: 'plans', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      slug: { type: 'string', required: true, indexed: true },
      price: { type: 'number', required: true },
      currency: { type: 'string', default: 'USD' },
      description: { type: 'string', default: '' },
      features: { type: 'json', default: [] },
      limits: { type: 'json', default: { rooms: 30, users: 2, properties: 1 } },
      isActive: { type: 'number', default: 1 },
      sortOrder: { type: 'number', default: 0 },
    },
  })

  // ─── Amenities Catalog ───────────────────────────────
  orm.define('AmenitiesCatalog', {
    table: 'amenities_catalog', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      key: { type: 'string', required: true, indexed: true },
      label: { type: 'string', required: true },
      category: { type: 'string', default: 'interior' },
      icon: { type: 'string', default: '' },
      isActive: { type: 'number', default: 1 },
      sortOrder: { type: 'number', default: 0 },
    },
  })

  // ─── SyncLog (audit trail para sincronizaciones) ─────
  orm.define('SyncLog', {
    table: 'sync_log', timestamps: false,
    fields: {
      id: { type: 'string', required: true },
      hotelId: { type: 'string', required: true, indexed: true },
      channel: { type: 'string' },
      action: { type: 'string', required: true },
      status: { type: 'string', default: 'success' },
      details: { type: 'json', default: {} },
      createdAt: { type: 'string' },
    },
  })

  // ─── Rate Restrictions ───────────────────────────────
  orm.define('RateRestrictions', {
    table: 'rate_restrictions', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      hotelId: { type: 'string', required: true, indexed: true },
      roomType: { type: 'string', required: true },
      season: { type: 'string', required: true },
      minStay: { type: 'number', default: 0 },
      maxStay: { type: 'number', default: 0 },
      cta: { type: 'number', default: 0 },
      ctd: { type: 'number', default: 0 },
      closedToArrival: { type: 'number', default: 0 },
      closedToDeparture: { type: 'number', default: 0 },
    },
  })

  // ─── Email Queue ─────────────────────────────────────
  orm.define('EmailQueue', {
    table: 'email_queue', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      hotelId: { type: 'string', required: true, indexed: true },
      recipient: { type: 'string', required: true },
      subject: { type: 'string', required: true },
      html: { type: 'text', required: true },
      status: { type: 'string', default: 'pending' },
      attempts: { type: 'number', default: 0 },
      maxAttempts: { type: 'number', default: 3 },
      lastError: { type: 'string' },
      nextRetryAt: { type: 'string' },
      provider: { type: 'string' },
      relatedType: { type: 'string' },
      relatedId: { type: 'string' },
    },
  })

  // ─── Hotel Amenities ─────────────────────────────────
  orm.define('HotelAmenities', {
    table: 'hotel_amenities', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      hotelId: { type: 'string', required: true, indexed: true },
      amenityKey: { type: 'string', required: true },
      amenityCategory: { type: 'string', default: 'interior' },
      isActive: { type: 'boolean', default: true },
    },
  })

  // ─── Room Amenities ──────────────────────────────────
  orm.define('RoomAmenities', {
    table: 'room_amenities', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      roomId: { type: 'string', required: true, indexed: true },
      amenityKey: { type: 'string', required: true },
      isShared: { type: 'boolean', default: false },
      isActive: { type: 'boolean', default: true },
    },
  })

  // ─── Seasons ─────────────────────────────────────────
  orm.define('Seasons', {
    table: 'seasons', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      hotelId: { type: 'string', required: true, indexed: true },
      name: { type: 'string', required: true },
      label: { type: 'string', required: true },
      startDate: { type: 'string', required: true },
      endDate: { type: 'string', required: true },
      color: { type: 'string', default: '#3b82f6' },
      sortOrder: { type: 'number', default: 0 },
    },
  })

  // ─── Room Rates ──────────────────────────────────────
  orm.define('RoomRates', {
    table: 'room_rates', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      hotelId: { type: 'string', required: true, indexed: true },
      roomType: { type: 'string', required: true },
      occupancy: { type: 'number', required: true },
      season: { type: 'string', required: true },
      price: { type: 'number', required: true },
      basePrice: { type: 'number', default: 0 },
      percentage: { type: 'number', default: 0 },
      closed: { type: 'number', default: 0 },
    },
  })

  // LockDevices + LockCodes: definidos en modules/ttlock/model.ts (dueño canónico).
  // NO redefinir aquí — el último orm.define gana y descarta campos (anti-patrón mem 1805).

  // ─── Companions ──────────────────────────────────────
  orm.define('Companions', {
    table: 'companions', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      reservationId: { type: 'string', required: true, indexed: true },
      hotelId: { type: 'string', required: true, indexed: true },
      name: { type: 'string', required: true },
      documentType: { type: 'string' },
      documentNumber: { type: 'string' },
      nationality: { type: 'string' },
      birthDate: { type: 'string' },
      isMainGuest: { type: 'number', default: 0 },
    },
  })

  // ─── Reservation Addons ──────────────────────────────
  orm.define('ReservationAddons', {
    table: 'reservation_addons', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      reservationId: { type: 'string', required: true, indexed: true },
      hotelId: { type: 'string', required: true, indexed: true },
      description: { type: 'string', required: true },
      amount: { type: 'number', required: true },
      quantity: { type: 'number', default: 1 },
      kind: { type: 'string', default: 'service' },
      status: { type: 'string', default: 'pending' },
    },
  })

  // ─── Payment Requests ────────────────────────────────
  orm.define('PaymentRequests', {
    table: 'payment_requests', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      hotelId: { type: 'string', required: true, indexed: true },
      reservationId: { type: 'string', indexed: true },
      guestId: { type: 'string' },
      amount: { type: 'number', required: true },
      currency: { type: 'string', default: 'USD' },
      status: { type: 'string', default: 'pending' },
      description: { type: 'string' },
      sentTo: { type: 'string' },
      sentVia: { type: 'string', default: 'email' },
      stripeSessionId: { type: 'string' },
      stripePaymentUrl: { type: 'string' },
      paidAt: { type: 'string' },
    },
  })

  // ─── Room Blocks ─────────────────────────────────────
  orm.define('RoomBlocks', {
    table: 'room_blocks', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      hotelId: { type: 'string', required: true, indexed: true },
      roomId: { type: 'string', required: true, indexed: true },
      reason: { type: 'string', required: true },
      startDate: { type: 'string', required: true },
      endDate: { type: 'string', required: true },
      createdBy: { type: 'string' },
    },
  })

  // ─── Photo Requirements (housekeeping) ───────────────
  orm.define('PhotoRequirement', {
    table: 'photo_requirements', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      hotelId: { type: 'string', required: true, indexed: true },
      areaId: { type: 'string', required: true },
      areaName: { type: 'string', required: true },
      icon: { type: 'string', default: 'photo_library' },
      required: { type: 'number', default: 1 },
      tipText: { type: 'string', default: '' },
      roomType: { type: 'string', default: 'all' },
      active: { type: 'number', default: 1 },
    },
  })

  // ─── Supply Items (housekeeping) ─────────────────────
  orm.define('SupplyItem', {
    table: 'supply_items', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      hotelId: { type: 'string', required: true, indexed: true },
      roomType: { type: 'string', required: true },
      name: { type: 'string', required: true },
      quantity: { type: 'number', default: 1 },
      unit: { type: 'string', default: 'pieza' },
    },
  })

  // ─── Checklist Templates (housekeeping) ──────────────
  // La "lista de cosas" que el admin arma para la camarera. Ítems libres,
  // por hotel y tipo de habitación (roomType 'all' = para todas).
  orm.define('ChecklistTemplate', {
    table: 'checklist_templates', timestamps: true,
    fields: {
      id: { type: 'string', required: true },
      hotelId: { type: 'string', required: true, indexed: true },
      roomType: { type: 'string', default: 'all' },
      text: { type: 'string', required: true },
      sortOrder: { type: 'number', default: 0 },
      active: { type: 'number', default: 1 },
    },
  })
}
