# SPEC: Foundation Database

## Requirements

### REQ-1: Hotel table MUST have all MisterPlan fields

The `hotels` table SHALL be extended with the following columns:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| ownerName | TEXT | NULL | Owner name |
| ownerTaxId | TEXT | NULL | CIF/NIF/NIE |
| deviceEmail | TEXT | NULL | Email for device validation |
| accommodationType | TEXT | 'hotel' | 54 accommodation types |
| registrationNumber | TEXT | NULL | Legal registration number |
| website | TEXT | NULL | Hotel website URL |
| bookingEngineUrl | TEXT | NULL | Booking engine shareable link |
| phone2 | TEXT | NULL | Secondary phone |
| warningPhone | TEXT | NULL | Alert phone |
| secondaryCurrency | TEXT | NULL | Secondary currency for conversion |
| youtubeUrl | TEXT | NULL | YouTube video URL |
| starRating | TEXT | NULL | Star/key/triquel classification |
| onlineBookingStatus | TEXT | 'active' | active / availability_only / disabled |
| motorVersion | TEXT | 'v1' | v1 / v2 |
| latitude | REAL | NULL | Map latitude |
| longitude | REAL | NULL | Map longitude |
| province | TEXT | NULL | Province/state |
| municipality | TEXT | NULL | Municipality |
| locality | TEXT | NULL | City/locality |
| postalCode | TEXT | NULL | Postal code |
| cleaningType | TEXT | 'checkout' | checkout / daily |
| depositType | TEXT | 'none' | none / fixed / percentage |
| depositFixed | REAL | 0 | Fixed deposit amount |
| advanceType | TEXT | 'percentage' | percentage / fixed |
| advanceAmount | REAL | 0 | Advance payment amount |
| releaseHours | INTEGER | 0 | Release in hours |
| defaultPaymentMethod | TEXT | 'transfer' | transfer / pos / card / cash / paypal / bizum |
| requestReviews | INTEGER | 0 | Request reviews (boolean) |
| publishReviewScore | INTEGER | 0 | Publish review score (boolean) |
| publishReviewComments | INTEGER | 0 | Publish comments (boolean) |
| taxName | TEXT | 'ITBIS' | Tax name |
| taxRate | REAL | 18.0 | Tax rate percentage |
| descriptionJson | TEXT | NULL | Multilingual descriptions JSON |

#### Scenario: Hotel settings load with new fields
- **Given** a hotel exists with id "hotel-1"
- **When** GET /api/settings is called
- **Then** the response MUST include all new fields with their values or defaults

#### Scenario: Hotel settings save with new fields
- **Given** a hotel_admin is authenticated
- **When** PUT /api/settings/hotel is called with { latitude: 18.487, longitude: -69.875 }
- **Then** the hotel record MUST be updated with those values
- **And** the response MUST return the updated hotel

### REQ-2: Reservations table MUST have OTA + payment fields

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| externalLocator | TEXT | NULL | OTA locator |
| source | TEXT | 'direct' | direct / booking / expedia / airbnb / etc. |
| commission | REAL | 0 | Commission percentage |
| commissionAmount | REAL | 0 | Commission amount |
| paymentMethod | TEXT | NULL | transfer / pos / card / cash / etc. |
| deposit | REAL | 0 | Deposit paid |
| pendingAmount | REAL | 0 | Pending to collect |
| notes | TEXT | NULL | OTA channel comments |
| autoSendEnabled | INTEGER | 1 | Auto messages enabled |

#### Scenario: Reservation created from OTA
- **Given** a reservation comes from Expedia via Channel Manager
- **When** the reservation is ingested
- **Then** source MUST be "expedia"
- **And** externalLocator MUST store the OTA locator
- **And** commission MUST be stored if provided

### REQ-3: Amenities tables MUST exist

#### Table: hotel_amenities
```sql
CREATE TABLE hotel_amenities (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  amenityKey TEXT NOT NULL,          -- 'pool', 'ac', 'kitchen', etc.
  amenityCategory TEXT NOT NULL,     -- 'interior', 'exterior', 'environment', 'activities'
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT '',
  updatedAt TEXT DEFAULT '',
  UNIQUE(hotelId, amenityKey)
);
```

#### Table: room_amenities
```sql
CREATE TABLE room_amenities (
  id TEXT PRIMARY KEY,
  roomId TEXT NOT NULL,
  amenityKey TEXT NOT NULL,
  isShared INTEGER DEFAULT 0,        -- 0 = own, 1 = shared
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT '',
  updatedAt TEXT DEFAULT '',
  UNIQUE(roomId, amenityKey, isShared)
);
```

#### Scenario: Set hotel amenities
- **Given** a hotel_admin is authenticated
- **When** PUT /api/amenities/hotel with { amenities: ['pool', 'ac', 'kitchen'] }
- **Then** hotel_amenities table MUST have exactly those 3 active rows for the hotel
- **And** previously set amenities not in the list MUST be deactivated

#### Scenario: Get room amenities
- **Given** room "room-1" has amenities ['tv', 'minibar', 'ac']
- **When** GET /api/amenities/room/room-1
- **Then** response MUST return array with those 3 amenities with isActive = true

### REQ-4: Seasons + Rates tables MUST exist

#### Table: seasons
```sql
CREATE TABLE seasons (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  name TEXT NOT NULL,               -- 'baja', 'media', 'alta', 'especial'
  label TEXT,                       -- 'Temporada Baja'
  startDate TEXT,
  endDate TEXT,
  color TEXT,                       -- '#3b82f6'
  sortOrder INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT '',
  updatedAt TEXT DEFAULT '',
  UNIQUE(hotelId, name)
);
```

#### Table: room_rates
```sql
CREATE TABLE room_rates (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  roomType TEXT NOT NULL,           -- 'single', 'double', 'suite', 'family'
  occupancy INTEGER NOT NULL,       -- 1, 2, 3, 4 persons
  season TEXT NOT NULL,             -- 'baja', 'media', 'alta', 'especial'
  price REAL NOT NULL,
  createdAt TEXT DEFAULT '',
  updatedAt TEXT DEFAULT '',
  UNIQUE(hotelId, roomType, occupancy, season)
);
```

#### Scenario: Load rate matrix
- **Given** hotel has 3 room types (single, double, suite) × 2 occupancies × 4 seasons
- **When** GET /api/rates?hotelId=hotel-1
- **Then** response MUST return 24 rate entries (3×2×4)

#### Scenario: Save rate matrix
- **Given** hotel_admin is authenticated
- **When** PUT /api/rates with array of { roomType, occupancy, season, price }
- **Then** all entries MUST be upserted
- **And** response MUST confirm count of saved rates

### REQ-5: Lock tables MUST exist

#### Table: lock_devices
```sql
CREATE TABLE lock_devices (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  roomId TEXT,                       -- NULL if common area lock
  ttlockLockId TEXT,                 -- TTLock API lock ID
  name TEXT,                         -- 'Puerta Habitación 101'
  mac TEXT,                          -- MAC address
  batteryLevel INTEGER,              -- 0-100
  status TEXT DEFAULT 'offline',     -- online / offline / low_battery
  createdAt TEXT DEFAULT '',
  updatedAt TEXT DEFAULT ''
);
```

#### Table: lock_codes
```sql
CREATE TABLE lock_codes (
  id TEXT PRIMARY KEY,
  lockId TEXT NOT NULL,
  reservationId TEXT,
  code TEXT,                         -- The actual passcode
  codeType TEXT,                     -- 'time' / 'permanent' / 'one_time'
  startDate TEXT,                    -- Check-in datetime
  endDate TEXT,                      -- Check-out datetime
  status TEXT DEFAULT 'pending',     -- pending / generated / sent / expired / deleted
  ttlockKeyboardPwdId TEXT,         -- TTLock API reference
  sentVia TEXT,                      -- 'email' / 'whatsapp' / 'manual'
  sentAt TEXT,
  createdAt TEXT DEFAULT '',
  updatedAt TEXT DEFAULT ''
);
```

#### Scenario: Lock device mapped to room
- **Given** lock device "lock-1" exists with ttlockLockId "12345"
- **When** it's mapped to room "room-101"
- **Then** lock_devices.roomId MUST be "room-101"

### REQ-6: Auto-messages + companions tables MUST exist

#### Table: auto_messages
```sql
CREATE TABLE auto_messages (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  title TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  emailSubject TEXT,                 -- Multilingual JSON
  emailBody TEXT,                    -- Multilingual JSON
  whatsappBody TEXT,                 -- Multilingual JSON
  channel TEXT DEFAULT 'email',      -- email / whatsapp / both
  triggerEvent TEXT NOT NULL,        -- 'reservation_created' / 'pre_checkin_X_days' / 'checkin_day' / 'checkout_day' / 'post_stay_X_days'
  triggerOffset INTEGER DEFAULT 0,   -- Days before/after event
  variables TEXT,                    -- JSON array of variable keys
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT '',
  updatedAt TEXT DEFAULT ''
);
```

#### Table: companions
```sql
CREATE TABLE companions (
  id TEXT PRIMARY KEY,
  reservationId TEXT NOT NULL,
  name TEXT NOT NULL,
  documentType TEXT,                 -- 'passport' / 'dni' / 'license'
  documentNumber TEXT,
  nationality TEXT,
  birthDate TEXT,
  isMainGuest INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT '',
  updatedAt TEXT DEFAULT ''
);
```

#### Table: message_logs
```sql
CREATE TABLE message_logs (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  reservationId TEXT,
  messageId TEXT,                    -- Reference to auto_messages
  messageType TEXT,                  -- 'email' / 'whatsapp'
  status TEXT,                       -- 'sent' / 'failed' / 'pending'
  recipient TEXT,                    -- email or phone
  response TEXT,                     -- API response
  sentAt TEXT,
  createdAt TEXT DEFAULT ''
);
```

### REQ-7: New backend modules MUST be created

Each module MUST follow arckode-framework structure:
```
src/modules/{module}/
├── index.ts          (APPEND-ONLY exports)
├── model.ts          (ORM model definition)
├── types.ts          (API types/DTOs)
├── service.ts        (RepositoryAdapter<T> based)
├── controller.ts     (validateSchema on POST/PUT)
├── sockets.ts        (real-time if needed)
└── validators.ts     (Zod schemas)
```

Modules to create:
1. `cerraduras` — Lock devices + codes
2. `temporadas` — Seasons + rates
3. `amenities` — Hotel + room amenities
4. `auto-messages` — Scheduled messages
5. `companions` — Reservation companions
6. `payment-links` — Payment requests

#### Scenario: Module passes arckode analyze
- **Given** all new modules are created
- **When** `bun run node_modules/arckode-framework/bin/arckode.js analyze` runs
- **Then** result MUST be "✅ VÁLIDO — sin violaciones"
