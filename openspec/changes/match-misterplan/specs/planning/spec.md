# SPEC: Planning Visual (Drag & Drop Calendar)

## Requirements

### REQ-1: Planning MUST show a resource calendar

The planning page at `/panel/planning` MUST display a FullCalendar resource-timeline view with:
- **Rows**: One per room (grouped by type: Standar, Familiar, Premium)
- **Columns**: Days of the month
- **Events**: Reservations as colored blocks
- **Blocks**: Room blocks (maintenance, etc.) as gray blocks

#### Scenario: View monthly planning
- **Given** hotel has 14 rooms across 3 types
- **When** hotel_admin navigates to /panel/planning
- **Then** calendar MUST render with 14 rows (one per room)
- **And** current month MUST be displayed by default
- **And** reservations MUST appear as colored blocks spanning their date range
- **And** room blocks MUST appear as gray blocks

### REQ-2: Reservations MUST be draggable

#### Scenario: Create reservation by dragging
- **Given** planning is displayed
- **When** user clicks and drags across 3 days on room "101"
- **Then** a "New Reservation" dialog MUST open
- **And** roomId MUST be pre-filled with "101"
- **And** checkIn MUST be pre-filled with the first dragged date
- **And** checkOut MUST be pre-filled with the last dragged date + 1

#### Scenario: Move reservation by dragging
- **Given** reservation exists for room "101" from June 20-25
- **When** user drags the reservation block to room "102"
- **Then** reservation.roomId MUST update to "102"
- **And** a confirmation toast MUST show "Reserva movida a habitación 102"
- **And** planning MUST refresh to show the move

#### Scenario: Extend reservation by resizing
- **Given** reservation exists from June 20-25
- **When** user drags the right edge to June 28
- **Then** reservation.checkOut MUST update to June 28
- **And** price MUST recalculate for 8 nights (was 5)

### REQ-3: Context menu MUST appear on right-click

#### Scenario: Right-click on reservation
- **Given** a reservation block exists
- **When** user right-clicks on it
- **Then** context menu MUST show:
  - 📋 Abrir Reserva (opens full modal)
  - 🔒 Ver Códigos de Cerradura (if TTLock integrated)
  - ✏️ Editar (quick edit)
  - ❌ Cancelar Reserva
  - 🗑️ Eliminar

#### Scenario: Right-click on empty cell
- **Given** an empty cell (no reservation) is right-clicked
- **When** the context menu appears
- **Then** it MUST show:
  - ➕ Nueva Reserva
  - 🚫 Bloquear Habitación

### REQ-4: Room blocks (bloqueos) MUST be supported

#### Scenario: Block a room
- **Given** user right-clicks empty cell on room "103" for June 22-24
- **When** selects "Bloquear Habitación"
- **Then** a block dialog MUST open
- **And** user can enter: reason, start date, end date
- **And** on save, the block MUST appear as gray in the planning

#### Scenario: Blocked room prevents reservation
- **Given** room "103" is blocked from June 22-24
- **When** user tries to create a reservation in that range
- **Then** system MUST show warning "Habitación bloqueada en esas fechas"
- **And** reservation MUST NOT be created

### REQ-5: Lock icons MUST appear on reservations

#### Scenario: Reservation with lock code
- **Given** reservation has an active lock code (status: 'sent' or 'generated')
- **When** planning renders
- **Then** a lock icon (🔒 green) MUST appear on the reservation block

#### Scenario: Reservation without lock code
- **Given** reservation has no lock code (status: 'pending' or no code)
- **When** planning renders
- **Then** a lock icon (🔓 gray) MUST appear on the reservation block

### REQ-6: Planning MUST have view modes

#### Scenario: Switch to weekly view
- **Given** planning is in monthly view
- **When** user clicks "Semana" button
- **Then** calendar MUST switch to week view
- **And** each day MUST show more detail (hourly slots optional)

#### Scenario: Navigate months
- **Given** planning shows June 2026
- **When** user clicks "Next"
- **Then** calendar MUST show July 2026

### REQ-7: Planning events MUST show key info

#### Scenario: Reservation block tooltip
- **Given** a reservation block exists
- **When** user hovers over it
- **Then** tooltip MUST show: guest name, locator, nights, price/night, total, source

### REQ-8: Planning MUST have filters

#### Scenario: Filter by room type
- **Given** planning shows all rooms
- **When** user selects filter "Premium"
- **Then** only Premium rooms MUST be visible
- **And** Standar and Familiar rows MUST be hidden

### REQ-9: Planning MUST support multi-selection

The calendar MUST allow selecting multiple cells (room × date range) to perform bulk actions.

#### Scenario: Select multiple rooms/days
- **Given** planning is displayed
- **When** user clicks and drags across multiple rooms AND multiple days (e.g., rooms 101-105 for June 22-25)
- **Then** all selected cells MUST be highlighted (blue overlay)
- **And** a floating action bar MUST appear with options:
  - 🚫 Bloquear seleccionados
  - ➕ Crear reservas grupales
  - 📋 Copiar a otra fecha
  - ❌ Cancelar selección

#### Scenario: Select single room range
- **Given** planning is displayed
- **When** user clicks room "101" on June 20 and drags to June 25
- **Then** only room "101" June 20-25 MUST be highlighted
- **And** floating action bar appears

#### Scenario: Select multiple non-adjacent rooms
- **Given** planning is displayed
- **When** user holds Ctrl/Cmd and clicks room "101" June 20, then room "103" June 20
- **Then** both cells MUST be highlighted
- **And** bulk actions available

### REQ-10: Planning MUST support bulk blocking (bloqueo múltiple)

This replicates MisterPlan's "BLOQUEO" feature where you can block multiple rooms at once.

#### Scenario: Block multiple rooms
- **Given** user has selected rooms 101-105 for June 22-25 (5 rooms × 4 days = 20 cells)
- **When** clicks "Bloquear seleccionados"
- **Then** block dialog MUST open with:
  - Motivo del bloqueo (text)
  - Fecha inicio (pre-filled: June 22)
  - Fecha fin (pre-filled: June 25)
  - Habitaciones afectadas (list: 101, 102, 103, 104, 105)
  - Botón "Confirmar Bloqueo"
- **And** on confirm, room_blocks table MUST create 5 entries (one per room)
- **And** all 20 cells MUST turn gray with block pattern
- **And** toast: "5 habitaciones bloqueadas del 22 al 25 de junio"

#### Scenario: Block single room
- **Given** user right-clicks room "103" on June 22
- **When** selects "Bloquear Habitación"
- **Then** single block dialog opens (same as bulk but for 1 room)
- **And** on confirm, 1 entry in room_blocks
- **And** cell turns gray

#### Scenario: Blocked room visual
- **Given** room "103" is blocked June 22-24
- **When** planning renders
- **Then** cells MUST show:
  - Gray background with diagonal stripe pattern
  - "BLOQUEO" text + reason + creation date
  - NOT draggable, NOT resizable
  - Right-click → "Eliminar Bloqueo"

### REQ-11: Planning MUST support group reservations

#### Scenario: Create group reservation
- **Given** user has selected rooms 101-103 for June 20-25
- **When** clicks "Crear reservas grupales"
- **Then** group reservation dialog opens:
  - Group name (text)
  - Guest info (shared across all rooms)
  - Rate per room (pre-filled from rate matrix)
  - Channel (direct, booking, etc.)
- **And** on save, creates N reservations linked by groupId
- **And** all blocks appear in planning with same color (group color)

### REQ-12: Planning MUST prevent double-booking

#### Scenario: Drag onto occupied room
- **Given** room "101" has reservation June 20-25
- **When** user tries to drag another reservation onto June 22
- **Then** drag MUST be rejected (visual snap-back)
- **And** toast: "Habitación 101 ya tiene reserva en esas fechas"

#### Scenario: Drag onto blocked room
- **Given** room "103" is blocked June 22-24
- **When** user tries to create reservation on June 23
- **Then** action MUST be blocked
- **And** toast: "Habitación 103 bloqueada en esas fechas: {reason}"

### REQ-13: Planning color legend

A legend bar MUST be displayed showing:
- 🔵 Confirmada (blue #3b82f6)
- 🟢 Checked-in (green #10b981)
- 🟡 Pendiente (yellow #f59e0b)
- ⚫ Checked-out (gray #6b7280)
- 🔴 Cancelada (red #ef4444, strikethrough)
- 🟫 Bloqueada (dark gray #374151, striped pattern)

### REQ-14: Planning data loading

#### Scenario: Load planning data
- **Given** planning page loads
- **When** component mounts
- **Then** system MUST fetch in ONE API call:
  - All rooms (with type grouping)
  - All reservations for visible date range
  - All blocks for visible date range
  - All lock codes status for reservations
- **And** render MUST complete in < 2 seconds for 50 rooms × 31 days

### REQ-15: Planning keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `N` | New reservation (opens dialog) |
| `B` | Block selected |
| `Delete` | Cancel/delete selected reservation |
| `Esc` | Close dialog / deselect |
| `Ctrl+A` | Select all visible |
| `←/→` | Navigate prev/next month |

### Technology
- **@fullcalendar/vue3** + **@fullcalendar/resource-timeline** (or resource-daygrid)
- **@fullcalendar/interaction** for drag/drop/resize
- Context menu: custom component or **v-context** package
- Colors per status:
  - confirmed → blue (#3b82f6)
  - checked_in → green (#10b981)
  - checked_out → gray (#6b7280)
  - pending → yellow (#f59e0b)
  - cancelled → red (#ef4444) with strikethrough
  - blocked → dark gray (#374151) with pattern
