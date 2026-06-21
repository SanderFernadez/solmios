# SPEC — M02: Channel Manager

**Suite**: Ventas & Web
**Prioridad**: P0
**Complejidad**: Alta
**Integración**: Channex PMS API

---

## Descripción

Sincronización bidireccional automática con todas las OTAs a través de Channex. Actualiza disponibilidad, tarifas y restricciones en tiempo real. Previene sobreventas con bloqueo automático.

---

## Funcionalidades

### 1. Conexión con OTAs
- Booking.com
- Airbnb
- Expedia
- Agoda
- Trip.com
- Google Hotel Ads
- + cualquier OTA compatible con Channex

### 2. Sincronización
- Disponibilidad en tiempo real
- Tarifas por tipo de habitación
- Restricciones (mínimo noches, cerrada, cerrada llegada/salida)
- Bloqueo automático al reservar en cualquier canal

### 3. Mapping
- Mapa de habitaciones locales ↔ Channex
- Mapa de tarifas locales ↔ Channex
- Sincronización de fotos y descripciones

### 4. Panel de Control
- Estado de conexión por OTA
- Última sincronización
- Errores y reintentos
- Logs de cambios

---

## Modelo de Datos

```typescript
interface ChannelMapping {
  id: UUID
  hotelId: UUID
  localRoomType: string
  channexRoomTypeId: string
  channelName: string
  channelRoomName: string
  isActive: boolean
}

interface SyncLog {
  id: UUID
  hotelId: UUID
  channel: string
  action: 'availability' | 'rate' | 'restriction' | 'reservation'
  status: 'success' | 'error' | 'pending'
  request: JSON
  response?: JSON
  errorMessage?: string
  createdAt: Date
}

interface ChannelReservation {
  id: UUID
  hotelId: UUID
  channel: string
  channelReservationId: string
  guestName: string
  checkIn: Date
  checkOut: Date
  roomType: string
  totalAmount: number
  currency: string
  status: 'new' | 'mapped' | 'error'
  rawData: JSON
}
```

---

## Endpoints

```
GET    /channels                        # Lista de canales configurados
POST   /channels/connect                # Conectar nuevo canal
DELETE /channels/:id/disconnect         # Desconectar canal

GET    /channels/sync-status            # Estado de sincronización
POST   /channels/sync/force             # Forzar sync manual

GET    /channels/mappings               # Mapeo habitaciones
POST   /channels/mappings               # Crear mapeo
PUT    /channels/mappings/:id           # Actualizar mapeo

GET    /channels/logs                   # Logs de sincronización
GET    /channels/reservations           # Reservas entrantes de OTAs

POST   /webhooks/channex               # Webhook de Channex
```

---

## Integración Channex

### Configuración
```typescript
const CHANNEX_CONFIG = {
  baseUrl: 'https://staging.channex.io/v1',  // Test
  // baseUrl: 'https://api.channex.io/v1',   // Production
  apiKey: process.env.CHANNEX_API_KEY,
  propertyId: process.env.CHANNEX_PROPERTY_ID,
}
```

### Webhook Handler
```typescript
// POST /webhooks/channex
// Channex envía eventos de:
// - reservation.created
// - reservation.modified
// - reservation.cancelled
// - availability.changed
```

### Sync Flow
```
Local → Channex:
  1. Cambio en disponibilidad/tarifa en PMS
  2. Connector envía update a Channex API
  3. Channex propaga a todas las OTAs conectadas
  4. Log de sincronización

Channex → Local:
  1. OTA recibe reserva
  2. Channex procesa y envía webhook
  3. Connector crea reserva local
  4. Bloqueo automático de disponibilidad
  5. Confirmación a OTA via Channex
```

---

## Reglas de Negocio

1. La disponibilidad local SIEMPRE tiene prioridad sobre la remota
2. Si hay conflicto de tarifas, gana la tarifa más alta
3. Las reservas de OTA se crean en estado `pending` hasta confirmación manual o automática
4. Reintentos automáticos: 3 intentos con backoff exponencial
5. Si Channex falla por > 5 min, alerta al administrador
6. No se puede modificar mapeo de habitación con reservas activas
