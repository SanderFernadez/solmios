# SPEC — M01: PMS Central

**Suite**: Core PMS
**Prioridad**: P0
**Complejidad**: Alta

---

## Descripción

Centro de control que unifica toda la operación hotelera en tiempo real. Reservas, recepción, rack de disponibilidad, facturación y gestión de huéspedes en una sola pantalla.

---

## Funcionalidades

### 1. Dashboard Principal
- Ocupación actual (% y números)
- Llegadas y salidas del día
- Ingresos del día / mes / año
- Alertas activas (incidencias, pagos pendientes)
- Gráfico de ocupación próximos 7 días

### 2. Rack de Disponibilidad
- Vista calendario (día / semana / mes)
- Colores por estado: ✅ Disponible, 🔴 Ocupada, 🟡 Pendiente, 🔵 En limpieza, ⚫ Fuera de servicio
- Drag & drop para mover reservas
- Filtros: tipo habitación, piso, estado

### 3. Gestión de Reservas
- Crear reserva rápida (2 clicks)
- Reservas individuales, grupales, corporativas
- Modificar fechas / habitación
- Cancelar con política de cancelación
- Notas internas por reserva

### 4. Check-In / Check-Out
- Check-in digital con firma
- Asignación automática de habitación
- Check-out con resumen de cargos
- Impresión de folio

### 5. Folio / Cuenta del Huésped
- Cargos por noche, servicios, minibar
- Pagos parciales y totales
- Transferencia de cargos entre habitaciones
- Cierre y apertura de folio

---

## Modelo de Datos

```typescript
interface Reservation {
  id: UUID
  hotelId: UUID
  guestId: UUID
  roomId: UUID
  checkIn: Date
  checkOut: Date
  adults: number
  children: number
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
  source: 'direct' | 'phone' | 'whatsapp' | 'booking' | 'expedia' | 'agoda' | 'other'
  channelReservationId?: string
  notes?: string
  totalAmount: number
  depositAmount: number
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded'
  createdBy: UUID
  createdAt: Date
  updatedAt: Date
}

interface RoomFolio {
  id: UUID
  reservationId: UUID
  items: FolioItem[]
  total: number
}

interface FolioItem {
  id: UUID
  description: string
  amount: number
  type: 'room' | 'service' | 'minibar' | 'tax' | 'discount'
  createdAt: Date
}
```

---

## Endpoints

```
GET    /reservations                    # Listar (con filtros)
POST   /reservations                    # Crear
GET    /reservations/:id                # Detalle
PATCH  /reservations/:id                # Actualizar
DELETE /reservations/:id                # Cancelar

POST   /reservations/:id/check-in       # Check-in
POST   /reservations/:id/check-out      # Check-out

GET    /rooms/rack                      # Rack de disponibilidad
GET    /rooms?status=available&date=X   # Habitaciones disponibles

GET    /folio/:reservationId            # Folio del huésped
POST   /folio/:reservationId/items      # Agregar cargo
POST   /folio/:reservationId/payments   # Registrar pago
```

---

## UI Components

| Componente | Ubicación | Descripción |
|-----------|-----------|-------------|
| DashboardStats | features/core-pms/ | KPIs del día |
| ReservationRack | features/core-pms/ | Calendario de disponibilidad |
| ReservationForm | features/core-pms/ | Crear/editar reserva |
| CheckInWizard | features/core-pms/ | Flujo de check-in |
| CheckOutSummary | features/core-pms/ | Resumen al salir |
| RoomFolio | features/core-pms/ | Cuenta del huésped |
| GuestSearch | features/core-pms/ | Buscar huésped existente |

---

## Reglas de Negocio

1. No se puede check-in antes de la hora de check-in del hotel (default: 15:00)
2. No se puede check-out después de la hora de check-out (default: 12:00)
3. Una habitación no puede tener 2 reservas superpuestas
4. Cancelaciones con menos de 24h pueden tener cargo (configurable por hotel)
5. El folio se cierra automáticamente al hacer check-out
6. Los pagos con tarjeta generan token para cargos futuros
