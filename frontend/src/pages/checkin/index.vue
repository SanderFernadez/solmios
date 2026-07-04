<template>
  <div class="min-h-screen bg-surface">
    <!-- Header -->
    <div class="bg-white border-b border-border px-6 py-4">
      <div class="max-w-full mx-auto flex items-center justify-between">
        <div>
          <h1 class="text-xl font-black text-navy">Recepción Digital</h1>
          <p class="text-xs text-text-muted">{{ todayFormatted }} · {{ arrivalsToday }} llegadas · {{ departuresToday }} salidas</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs font-bold px-3 py-1 rounded-full bg-teal/10 text-teal">{{ inHouse }} en casa</span>
          <span class="text-xs font-bold px-3 py-1 rounded-full bg-gold/10 text-gold">{{ arrivalsToday }} por llegar</span>
          <span class="text-xs font-bold px-3 py-1 rounded-full bg-coral/10 text-coral">{{ departuresToday }} por salir</span>
        </div>
      </div>
    </div>

    <div class="px-6 py-4">
      <!-- Loading skeleton -->
      <div v-if="loading" class="space-y-4">
        <div class="bg-white rounded-2xl border border-border p-4 animate-pulse">
          <div class="h-4 w-48 bg-surface rounded mb-3"></div>
          <div class="space-y-2">
            <div v-for="i in 4" :key="i" class="h-10 bg-surface rounded-lg"></div>
          </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div v-for="i in 3" :key="i" class="bg-white rounded-2xl border border-border p-4 animate-pulse">
            <div class="h-4 w-32 bg-surface rounded mb-3"></div>
            <div v-for="j in 3" :key="j" class="h-12 bg-surface rounded-xl mb-2"></div>
          </div>
        </div>
      </div>

      <template v-else>
        <!-- Room Summary — compact by default -->
        <div class="bg-white rounded-2xl border border-border p-4 mb-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-black text-navy">Habitaciones · {{ todayFormatted }}</h2>
            <button @click="showRoomGrid = !showRoomGrid"
              class="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
              :class="showRoomGrid ? 'bg-navy text-white' : 'bg-surface text-navy hover:bg-border/30'">
              {{ showRoomGrid ? 'Ocultar' : 'Ver todas' }}
              <span class="text-xs">{{ showRoomGrid ? '▴' : '▾' }}</span>
            </button>
          </div>

          <!-- Compact summary bars — 2 por fila -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div v-for="group in roomGroups" :key="group.key"
              @click="showRoomGrid = true"
              class="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-surface cursor-pointer transition-colors group border border-transparent hover:border-border">
              <span class="text-base w-6 text-center flex-shrink-0">{{ group.icon }}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-0.5">
                  <span class="text-[10px] font-bold text-navy">{{ group.label }}</span>
                  <span class="text-[9px] font-bold" :class="group.occupiedCount > 0 ? 'text-coral' : 'text-teal'">
                    {{ group.availableCount }} libre{{ group.availableCount !== 1 ? 's' : '' }}
                  </span>
                </div>
                <div class="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all" :style="{ width: group.percent + '%' }"
                    :class="group.occupiedCount > 0 ? 'bg-coral' : 'bg-teal'"></div>
                </div>
                <div class="flex justify-between mt-0.5">
                  <span class="text-[8px] text-text-muted">{{ group.rooms.length }} habs</span>
                  <span class="text-[8px] text-text-muted">{{ group.occupiedCount }} ocup</span>
                </div>
              </div>
              <span class="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">▸</span>
            </div>
          </div>

          <!-- Expanding room grid -->
          <div v-if="showRoomGrid" class="mt-3 pt-3 border-t border-border">
            <div v-for="group in roomGroups" :key="'grid-' + group.key" class="mb-3 last:mb-0">
              <div class="flex items-center gap-2 mb-1.5">
                <span class="text-sm">{{ group.icon }}</span>
                <span class="text-[10px] font-black text-text-muted uppercase">{{ group.label }}</span>
              </div>
              <div class="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                <div v-for="room in group.rooms" :key="room.id"
                  @click.stop="selectRoom(room)"
                  class="p-2 rounded-lg border-2 cursor-pointer transition-all hover:shadow-sm hover:scale-[1.02]"
                  :class="[roomCardClass(room), selectedRoom?.id === room.id ? 'ring-2 ring-navy/30' : '']">
                  <div class="flex items-center justify-between mb-0.5">
                    <span class="text-[10px] font-black" :class="roomNumberClass(room)">{{ room.number }}</span>
                    <span class="w-1.5 h-1.5 rounded-full" :class="roomDotClass(room)"></span>
                  </div>
                  <div class="text-[7px] font-bold text-text-muted uppercase">{{ roomTypeLabel(room.type) }}</div>
                  <div v-if="room.guestName" class="text-[8px] font-bold text-navy truncate mt-0.5">{{ room.guestName.split(' ')[0] }}</div>
                  <div v-else class="text-[7px] text-text-muted mt-0.5">{{ roomStatusLabel(room) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- Arrivals Today -->
          <div class="bg-white rounded-2xl border border-border p-4">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-black text-navy">Llegadas Hoy</h2>
              <span class="text-xs font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">{{ arrivals.length }}</span>
            </div>
            <div v-if="arrivals.length === 0" class="text-center py-8 text-xs text-text-muted">Sin llegadas hoy</div>
            <div v-for="a in arrivals" :key="a.id" class="flex items-center gap-3 p-3 rounded-xl mb-2" :class="a.checkedIn ? 'bg-teal/5' : 'bg-surface hover:bg-gold/5 cursor-pointer'" @click="!a.checkedIn && openCheckinModal(a)">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" :class="a.channelColor">{{ a.initials }}</div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-navy truncate">{{ a.guestName }}</div>
                <div class="text-[10px] text-text-muted">Hab {{ a.roomNumber }} · {{ a.channelLabel }}</div>
                <div class="text-[10px] text-text-muted">{{ a.checkIn }} → {{ a.checkOut }} · {{ a.nights }}n · ${{ a.totalAmount }}</div>
              </div>
              <button v-if="!a.checkedIn" @click.stop="openCheckinModal(a)" :disabled="processing" class="px-3 py-1.5 bg-teal text-white text-[10px] font-bold rounded-lg hover:bg-teal/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                Check-in
              </button>
              <span v-else class="text-[10px] font-bold text-teal">✓ Hecho</span>
            </div>
          </div>

          <!-- In House -->
          <div class="bg-white rounded-2xl border border-border p-4">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-black text-navy">En Casa</h2>
              <span class="text-xs font-bold text-coral bg-coral/10 px-2 py-0.5 rounded-full">{{ inHouseList.length }}</span>
            </div>
            <div v-if="inHouseList.length === 0" class="text-center py-8 text-xs text-text-muted">Sin huéspedes</div>
            <div v-for="g in inHouseList" :key="g.id" class="flex items-center gap-3 p-3 rounded-xl mb-2 bg-surface cursor-pointer hover:bg-coral/5" @click="openCheckoutModal(g)">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" :class="g.channelColor">{{ g.initials }}</div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-navy truncate">{{ g.guestName }}</div>
                <div class="text-[10px] text-text-muted">Hab {{ g.roomNumber }} · {{ g.channelLabel }}</div>
                <div class="text-[10px] text-text-muted">Sale: {{ g.checkOut }} · {{ daysUntil(g.checkOut) }}d restantes</div>
              </div>
              <button @click.stop="openCheckoutModal(g)" :disabled="processing" class="px-3 py-1.5 bg-navy text-white text-[10px] font-bold rounded-lg hover:bg-navy-light transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                Check-out
              </button>
            </div>
          </div>

          <!-- Departures Today -->
          <div class="bg-white rounded-2xl border border-border p-4">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-black text-navy">Salidas Hoy</h2>
              <span class="text-xs font-bold text-coral bg-coral/10 px-2 py-0.5 rounded-full">{{ departures.length }}</span>
            </div>
            <div v-if="departures.length === 0" class="text-center py-8 text-xs text-text-muted">Sin salidas hoy</div>
            <div v-for="d in departures" :key="d.id" class="flex items-center gap-3 p-3 rounded-xl mb-2" :class="d.checkedOut ? 'bg-gray-100' : 'bg-surface hover:bg-coral/5 cursor-pointer'" @click="!d.checkedOut && openCheckoutModal(d)">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold bg-gray-200 text-gray-500">{{ d.initials }}</div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-navy truncate">{{ d.guestName }}</div>
                <div class="text-[10px] text-text-muted">Hab {{ d.roomNumber }} · {{ d.channelLabel }}</div>
              </div>
              <button v-if="!d.checkedOut" @click.stop="openCheckoutModal(d)" :disabled="processing" class="px-3 py-1.5 bg-coral text-white text-[10px] font-bold rounded-lg hover:bg-coral/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                Check-out
              </button>
              <span v-else class="text-[10px] font-bold text-text-muted">✓ Hecho</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Room Detail Popover -->
    <Teleport to="body">
      <div v-if="showRoomDetail && selectedRoom" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeRoomDetail">
        <div class="absolute inset-0 bg-navy/30 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto">
          <!-- Header -->
          <div class="sticky top-0 bg-white border-b border-border p-5 z-10 rounded-t-2xl">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <span class="text-lg">{{ roomTypeIcon(selectedRoom.type) }}</span>
                <div>
                  <div class="text-base font-black text-navy">Hab {{ selectedRoom.number }}</div>
                  <div class="text-[10px] font-bold text-text-muted uppercase">{{ roomTypeLabel(selectedRoom.type) }}</div>
                </div>
              </div>
              <button @click="closeRoomDetail" class="w-7 h-7 rounded-lg bg-surface flex items-center justify-center hover:bg-border/50 cursor-pointer text-xs">✕</button>
            </div>
            <div class="flex items-center gap-2 mt-2">
              <span class="w-2 h-2 rounded-full" :class="roomDotClass(selectedRoom)"></span>
              <span class="text-[11px] font-bold" :class="roomNumberClass(selectedRoom)">{{ roomStatusLabel(selectedRoom) }}</span>
              <span v-if="selectedRoom.guestName" class="text-[9px] text-text-muted ml-auto">{{ selectedRoom.checkDates }}</span>
            </div>
          </div>

          <!-- Guest info — garantizado si está ocupada -->
          <div v-if="selectedRoom.status === 'occupied'" class="p-4 border-b border-border bg-surface/30">
            <div class="text-[9px] font-bold text-text-muted uppercase mb-2">Huésped</div>
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center text-[11px] font-bold text-navy">
                {{ guestInitials(String(selectedRoomGuest?.guestName || selectedRoom.guestName || '?')) }}
              </div>
              <div>
                <div class="text-sm font-bold text-navy">{{ selectedRoomGuest?.guestName || selectedRoom.guestName || 'Sin nombre' }}</div>
                <div v-if="selectedRoomGuest?.guestEmail || selectedRoom.guestEmail" class="text-[9px] text-text-muted">{{ selectedRoomGuest?.guestEmail || selectedRoom.guestEmail }}</div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-2">
              <div class="bg-white rounded-lg p-2 text-center">
                <div class="text-[8px] text-text-muted">Check-in</div>
                <div class="text-[10px] font-bold text-navy">{{ String(selectedRoomGuest?.checkIn || selectedRoom.checkIn || '').slice(0, 10) || '—' }}</div>
              </div>
              <div class="bg-white rounded-lg p-2 text-center">
                <div class="text-[8px] text-text-muted">Check-out</div>
                <div class="text-[10px] font-bold text-navy">{{ String(selectedRoomGuest?.checkOut || selectedRoom.checkOut || '').slice(0, 10) || '—' }}</div>
              </div>
            </div>
            <div class="flex gap-2 mt-2">
              <button @click="checkoutFromRoom(selectedRoom)" :disabled="processing" class="flex-1 py-1.5 bg-coral text-white text-[10px] font-bold rounded-lg hover:bg-coral/80 disabled:opacity-50 cursor-pointer">
                Check-out
              </button>
              <button v-if="selectedRoom.resId || selectedRoomGuest?.id" @click="viewReservation((selectedRoom.resId || selectedRoomGuest?.id) as string)" class="flex-1 py-1.5 bg-navy text-white text-[10px] font-bold rounded-lg hover:bg-navy-light cursor-pointer">
                Ver Reserva
              </button>
            </div>
          </div>

          <!-- Empty state for non-occupied -->
          <div v-else class="p-4 border-b border-border bg-surface/30">
            <div class="text-center py-3">
              <div class="text-2xl mb-1">🛏️</div>
              <div class="text-xs font-bold text-teal">Disponible</div>
              <div class="text-[9px] text-text-muted mt-0.5">Sin huésped asignado</div>
            </div>
          </div>

          <!-- Room specs -->
          <div class="p-4 border-b border-border">
            <div class="text-[9px] font-bold text-text-muted uppercase mb-2">Detalles</div>
            <div class="grid grid-cols-2 gap-2">
              <div class="bg-surface rounded-lg p-2">
                <div class="text-[8px] text-text-muted">Piso</div>
                <div class="text-xs font-bold text-navy">{{ selectedRoom.floor || '—' }}</div>
              </div>
              <div class="bg-surface rounded-lg p-2">
                <div class="text-[8px] text-text-muted">Capacidad</div>
                <div class="text-xs font-bold text-navy">{{ selectedRoom.capacity || 2 }} pers</div>
              </div>
              <div class="bg-surface rounded-lg p-2">
                <div class="text-[8px] text-text-muted">Baños</div>
                <div class="text-xs font-bold text-navy">{{ selectedRoom.bathrooms || 1 }}</div>
              </div>
              <div class="bg-surface rounded-lg p-2">
                <div class="text-[8px] text-text-muted">Superficie</div>
                <div class="text-xs font-bold text-navy">{{ selectedRoom.surfaceArea ? selectedRoom.surfaceArea + ' m²' : '—' }}</div>
              </div>
            </div>
            <div class="mt-2 bg-surface rounded-lg p-2 flex justify-between items-center">
              <span class="text-[8px] text-text-muted">Precio base / noche</span>
              <span class="text-xs font-bold text-teal">${{ selectedRoom.basePrice || 0 }}</span>
            </div>
          </div>

          <!-- Amenities -->
          <div class="p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[9px] font-bold text-text-muted uppercase">Amenities</span>
              <span v-if="loadingAmenities" class="text-[8px] text-text-muted">cargando...</span>
            </div>
            <div v-if="roomAmenities.length === 0 && !loadingAmenities" class="text-[9px] text-text-muted text-center py-2">Sin amenities registrados</div>
            <div v-else class="flex flex-wrap gap-1">
              <span v-for="a in roomAmenities" :key="a.key"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-bold"
                :class="a.active ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-400 line-through'">
                {{ a.icon }} {{ a.label }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Checkin Modal -->
    <Teleport to="body">
      <div v-if="showCheckinModal && checkinGuest" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeCheckinModal">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div class="p-5 border-b border-border bg-teal/5">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Check-in</h3>
              <button @click="closeCheckinModal" :disabled="processing" class="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center hover:bg-surface cursor-pointer disabled:opacity-50">✕</button>
            </div>
          </div>
          <div class="p-5 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold" :class="checkinGuest.channelColor">{{ checkinGuest.initials }}</div>
              <div>
                <div class="text-sm font-bold text-navy">{{ checkinGuest.guestName }}</div>
                <div class="text-[10px] text-text-muted">{{ checkinGuest.guestEmail }}</div>
              </div>
            </div>
            <div class="bg-surface rounded-xl p-4 space-y-2">
              <div class="flex justify-between text-xs"><span class="text-text-muted">Habitación</span><span class="font-bold text-navy">{{ checkinGuest.roomNumber }}</span></div>
              <div class="flex justify-between text-xs"><span class="text-text-muted">Check-in</span><span class="font-bold text-navy">{{ checkinGuest.checkIn }}</span></div>
              <div class="flex justify-between text-xs"><span class="text-text-muted">Check-out</span><span class="font-bold text-navy">{{ checkinGuest.checkOut }}</span></div>
              <div class="flex justify-between text-xs"><span class="text-text-muted">Canal</span><span class="font-bold text-navy">{{ checkinGuest.channelLabel }}</span></div>
              <div class="flex justify-between text-xs"><span class="text-text-muted">Total</span><span class="font-bold text-teal">${{ checkinGuest.totalAmount }}</span></div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="text-center p-2 bg-surface rounded-lg">
                <div class="text-[10px] text-text-muted">Adultos</div>
                <div class="text-sm font-bold">{{ checkinGuest.adults }}</div>
              </div>
              <div class="text-center p-2 bg-surface rounded-lg">
                <div class="text-[10px] text-text-muted">Niños</div>
                <div class="text-sm font-bold">{{ checkinGuest.children }}</div>
              </div>
            </div>
            <div v-if="processing" class="flex items-center justify-center gap-2 text-xs text-teal font-bold">
              <span class="inline-block w-3 h-3 border-2 border-teal border-t-transparent rounded-full animate-spin"></span>
              Procesando...
            </div>
          </div>
          <div class="p-5 border-t border-border flex gap-2">
            <button @click="closeCheckinModal" :disabled="processing" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold hover:bg-surface cursor-pointer disabled:opacity-50">Cancelar</button>
            <button @click="confirmCheckin" :disabled="processing" class="flex-1 py-2.5 bg-teal text-white rounded-xl text-sm font-bold hover:bg-teal/80 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {{ processing ? 'Procesando...' : 'Confirmar Check-in' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Checkout Modal -->
    <Teleport to="body">
      <div v-if="showCheckoutModal && checkoutGuest" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeCheckoutModal">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div class="p-5 border-b border-border bg-coral/5">
            <h3 class="text-lg font-black text-navy">Check-out · Hab {{ checkoutGuest.roomNumber }}</h3>
          </div>
          <div class="p-5 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold" :class="checkoutGuest.channelColor">{{ checkoutGuest.initials }}</div>
              <div>
                <div class="text-sm font-bold text-navy">{{ checkoutGuest.guestName }}</div>
                <div class="text-[10px] text-text-muted">{{ checkoutGuest.checkIn }} → {{ checkoutGuest.checkOut }} · {{ checkoutGuest.nights }} noche(s)</div>
              </div>
            </div>

            <!-- Loading folio -->
            <div v-if="folioLoading" class="bg-surface rounded-xl p-4 flex items-center justify-center gap-2 text-xs text-text-muted">
              <span class="inline-block w-3 h-3 border-2 border-text-muted border-t-transparent rounded-full animate-spin"></span>
              Cargando cuenta...
            </div>

            <!-- Folio balance -->
            <div v-else-if="checkoutFolio" class="bg-surface rounded-xl p-4 space-y-2">
              <div class="flex justify-between items-center">
                <span class="text-xs font-bold text-navy">Cuenta · Folio</span>
                <span class="text-[10px] font-mono text-text-muted">{{ checkoutFolio.id.slice(0, 8) }}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-text-muted">Cargos</span>
                <span class="font-bold text-navy">${{ (checkoutFolio.chargesTotal || 0).toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-text-muted">Pagos</span>
                <span class="font-bold text-teal">-${{ (checkoutFolio.paymentsTotal || 0).toFixed(2) }}</span>
              </div>
              <div class="border-t border-border pt-2 flex justify-between text-sm">
                <span class="font-bold text-navy">Saldo pendiente</span>
                <span class="font-bold" :class="(checkoutFolio.balance || 0) > 0 ? 'text-coral' : 'text-teal'">
                  ${{ (checkoutFolio.balance || 0).toFixed(2) }}
                </span>
              </div>
              <div v-if="(checkoutFolio.balance || 0) <= 0" class="text-[10px] text-teal font-bold">✓ Cuenta saldada</div>
            </div>

            <!-- Payment method selection (only if balance > 0) -->
            <div v-if="checkoutFolio && (checkoutFolio.balance || 0) > 0" class="space-y-3">
              <div class="text-xs font-bold text-navy">Método de pago</div>
              <div class="grid grid-cols-2 gap-2">
                <button v-for="pm in paymentMethods" :key="pm.value"
                  @click="settleMethod = pm.value"
                  class="flex items-center gap-2 p-3 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                  :class="settleMethod === pm.value ? 'bg-teal text-white border-teal' : 'bg-white text-navy border-border hover:border-teal/30'">
                  <span>{{ pm.icon }}</span>
                  <span>{{ pm.label }}</span>
                </button>
              </div>
            </div>

            <div class="bg-gold/10 border border-gold/20 rounded-xl p-3">
              <div class="text-[10px] font-bold text-gold">⚠ La habitación pasará a estado "Sucia" y se creará tarea de limpieza</div>
            </div>

            <div v-if="processing" class="flex items-center justify-center gap-2 text-xs text-coral font-bold">
              <span class="inline-block w-3 h-3 border-2 border-coral border-t-transparent rounded-full animate-spin"></span>
              Procesando...
            </div>
          </div>
          <div class="p-5 border-t border-border flex gap-2">
            <button @click="closeCheckoutModal" :disabled="processing" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold hover:bg-surface cursor-pointer disabled:opacity-50">Cancelar</button>
            <button @click="confirmCheckout" :disabled="processing || folioLoading" class="flex-1 py-2.5 bg-coral text-white rounded-xl text-sm font-bold hover:bg-coral/80 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {{ processing ? 'Procesando...' : checkoutSettleLabel }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { OperationsService } from '@/services/Operations.service'
import { RoomService } from '@/services/Room.service'
import { ReservationService } from '@/services/Reservation.service'
import { FoliosService, type Folio } from '@/services/Folios.service'
import { AmenitiesService } from '@/services/Amenities.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/services/http'
import type { CheckinRoom, CheckinGuest } from '@/types'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const showCheckinModal = ref(false)
const showCheckoutModal = ref(false)
const showRoomDetail = ref(false)
const showRoomGrid = ref(false)
const checkinGuest = ref<CheckinGuest | null>(null)
const checkoutGuest = ref<CheckinGuest | null>(null)
const checkoutFolio = ref<Folio | null>(null)
const folioLoading = ref(false)
const settleMethod = ref<string | null>(null)
const selectedRoom = ref<CheckinRoom | null>(null)

const paymentMethods = [
  { value: 'cash', label: 'Efectivo', icon: '💵' },
  { value: 'card', label: 'Tarjeta', icon: '💳' },
  { value: 'transfer', label: 'Transferencia', icon: '🏦' },
  { value: 'deposit', label: 'Depósito', icon: '📄' },
]

// Búsqueda directa en reservas para garantizar datos del huésped
const selectedRoomGuest = computed(() => {
  if (!selectedRoom.value?.resId) return null
  return allReservations.value.find(r => r.id === selectedRoom.value!.resId) || null
})
const checkedIn = ref(new Set<string>())
const checkedOut = ref(new Set<string>())
const processing = ref(false)

const rooms = ref<CheckinRoom[]>([])
const allReservations = ref<Record<string, unknown>[]>([])
const loading = ref(true)
const roomAmenities = ref<{ key: string; label: string; icon: string; active: boolean }[]>([])
const loadingAmenities = ref(false)

const today = new Date()
const todayStr = today.toISOString().split('T')[0]
const todayFormatted = today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

const channelLabels: Record<string, string> = { direct: 'Direct', booking: 'Booking.com', expedia: 'Expedia', airbnb: 'Airbnb', google: 'Google' }
const channelColors: Record<string, string> = { direct: 'bg-teal/10 text-teal', booking: 'bg-cyan/10 text-cyan', expedia: 'bg-gold/10 text-gold', airbnb: 'bg-coral/10 text-coral', google: 'bg-blue/10 text-blue' }

const roomTypeCategories: Record<string, { key: string; icon: string; label: string; order: number }> = {
  presidential: { key: 'premium', icon: '👑', label: 'Premium', order: 1 },
  deluxe:      { key: 'premium', icon: '👑', label: 'Premium', order: 1 },
  suite:       { key: 'premium', icon: '👑', label: 'Premium', order: 1 },
  villa:       { key: 'premium', icon: '👑', label: 'Premium', order: 1 },
  double:      { key: 'standard', icon: '🛏️', label: 'Dobles / Twin', order: 2 },
  twin:        { key: 'standard', icon: '🛏️', label: 'Dobles / Twin', order: 2 },
  triple:      { key: 'multiple', icon: '👥', label: 'Múltiples', order: 3 },
  quad:        { key: 'multiple', icon: '👥', label: 'Múltiples', order: 3 },
  family:      { key: 'multiple', icon: '👥', label: 'Múltiples', order: 3 },
  single:      { key: 'individual', icon: '🚪', label: 'Individuales', order: 4 },
  dorm:        { key: 'individual', icon: '🚪', label: 'Individuales', order: 4 },
}

const roomTypeIcons: Record<string, string> = {
  presidential: '👑', deluxe: '👑', suite: '👑', villa: '👑',
  double: '🛏️', twin: '🛏️',
  triple: '👥', quad: '👥', family: '👥',
  single: '🚪', dorm: '🚪',
}

const roomTypeLabels: Record<string, string> = {
  presidential: 'Presidential', deluxe: 'Deluxe', suite: 'Suite', villa: 'Villa',
  double: 'Doble', twin: 'Twin',
  triple: 'Triple', quad: 'Cuádruple', family: 'Familiar',
  single: 'Single', dorm: 'Dormitorio',
}

function roomTypeIcon(type: string) { return roomTypeIcons[type] || '🛏️' }
function roomTypeLabel(type: string) { return roomTypeLabels[type] || type }

const roomGroups = computed(() => {
  const inHouseRoomIds = new Set(inHouseList.value.map(g => g.roomId))
  const groups = new Map<string, { key: string; icon: string; label: string; order: number; rooms: CheckinRoom[]; occupiedCount: number; availableCount: number; percent: number }>()
  for (const room of rooms.value) {
    const cat = roomTypeCategories[room.type] || { key: 'other', icon: '🛏️', label: 'Otras', order: 99 }
    if (!groups.has(cat.key)) {
      groups.set(cat.key, { key: cat.key, icon: cat.icon, label: cat.label, order: cat.order, rooms: [], occupiedCount: 0, availableCount: 0, percent: 0 })
    }
    groups.get(cat.key)!.rooms.push(room)
  }
  for (const group of groups.values()) {
    // Coherente con "En Casa": ocupada = tiene huésped con check-in hecho
    group.occupiedCount = group.rooms.filter(r => inHouseRoomIds.has(r.id)).length
    group.availableCount = group.rooms.filter(r => r.status === 'available').length
    group.percent = group.rooms.length > 0 ? Math.round((group.occupiedCount / group.rooms.length) * 100) : 0
  }
  return [...groups.values()].sort((a, b) => a.order - b.order)
})

async function loadData() {
  loading.value = true
  try {
    const [roomsResult, planningResult] = await Promise.all([
      RoomService.list({ hotelId: hotelId.value }),
      OperationsService.planning(hotelId.value),
    ])

    const roomsData: any[] = roomsResult.rooms || []
    const resData = planningResult.reservas || []
    allReservations.value = resData

    const todayRes = resData.filter((r: Record<string, unknown>) => {
      const ci = String(r.checkIn || '').slice(0, 10)
      const co = String(r.checkOut || '').slice(0, 10)
      return ci <= todayStr && co >= todayStr
    })

    const roomGuestMap = new Map<string, Record<string, unknown>>()
    for (const r of todayRes) {
      const rid = r.roomId as string
      if (!roomGuestMap.has(rid) || String(r.checkIn).slice(0, 10) <= todayStr) {
        roomGuestMap.set(rid, r)
      }
    }

    rooms.value = roomsData.map((r: Record<string, unknown>) => {
      const res = roomGuestMap.get(r.id as string)
      const actualStatus = (r.status as string) || 'available'
      const isCheckedIn = res && (res.status === 'checked_in')
      // Coherencia: solo 'occupied' si hay reserva checked_in real.
      // Si DB dice 'occupied' pero no hay reserva → fantasma → available.
      const roomStatus = isCheckedIn ? 'occupied'
        : (actualStatus === 'occupied' ? 'available' : actualStatus)
      return {
        id: r.id as string,
        number: r.number as string,
        type: r.type as string,
        status: roomStatus as CheckinRoom['status'],
        basePrice: (r.basePrice as number) || 0,
        floor: (r.floor as number) || 0,
        capacity: (r.capacity as number) || 2,
        bathrooms: (r.bathrooms as number) || 1,
        surfaceArea: (r.surfaceArea as number) || 0,
        guestName: (res?.guestName as string) || null,
        channel: (res?.channel as string) || null,
        checkIn: res ? String(res.checkIn).slice(0, 10) : null,
        checkOut: res ? String(res.checkOut).slice(0, 10) : null,
        checkDates: res ? `${String(res.checkIn).slice(0, 10)} → ${String(res.checkOut).slice(0, 10)}` : '',
        guestEmail: (res?.guestEmail as string) || null,
        resId: (res?.id as string) || null,
      }
    })

    if (selectedRoom.value) {
      const updated = rooms.value.find(r => r.id === selectedRoom.value!.id)
      if (updated) selectedRoom.value = updated
    }
  } catch (e) {
    const msg = e instanceof ApiError
      ? `Error del servidor (${e.status})`
      : 'Sin conexión con el servidor'
    toast.error('Error al cargar datos', msg)
  }
  loading.value = false
}

onMounted(loadData)

const amenityMeta: Record<string, { icon: string; label: string }> = {
  wifi: { icon: '📶', label: 'WiFi' },
  tv: { icon: '📺', label: 'TV' },
  ac: { icon: '❄️', label: 'A/C' },
  minibar: { icon: '🍸', label: 'Minibar' },
  safe: { icon: '🔐', label: 'Caja fuerte' },
  iron: { icon: '👕', label: 'Plancha' },
  hairdryer: { icon: '💨', label: 'Secador' },
  robe: { icon: '👘', label: 'Bata' },
  towels_extra: { icon: '🛁', label: 'Toallas extra' },
  sea_view: { icon: '🌊', label: 'Vista al mar' },
  balcony: { icon: '🏖️', label: 'Balcón' },
  jacuzzi: { icon: '🫧', label: 'Jacuzzi' },
  kitchen: { icon: '🍳', label: 'Cocina' },
  terrace: { icon: '🌿', label: 'Terraza' },
  desk: { icon: '🪑', label: 'Escritorio' },
}

async function loadRoomAmenities(roomId: string) {
  loadingAmenities.value = true
  try {
    const [catalogResult, roomResult] = await Promise.all([
      AmenitiesService.catalog().catch(() => ({ interior: [], exterior: [], services: [] })),
      AmenitiesService.listRoom(roomId).catch(() => ({ data: [] })),
    ])
    const roomKeys = new Set((roomResult.data || []).map((a: { amenityKey: string }) => a.amenityKey))
    const allAmenities = [
      ...(catalogResult.interior || []),
      ...(catalogResult.exterior || []),
      ...(catalogResult.services || []),
    ]
    roomAmenities.value = allAmenities.map(key => {
      const meta = amenityMeta[key] || { icon: '✓', label: key }
      return { key, label: meta.label, icon: meta.icon, active: roomKeys.has(key) }
    })
  } catch (e) {
    roomAmenities.value = []
  }
  loadingAmenities.value = false
}

const arrivals = computed(() =>
  allReservations.value
    .filter((r: Record<string, unknown>) => String(r.checkIn).slice(0, 10) === todayStr && !['checked_in', 'checked_out'].includes(r.status as string))
    .map(mapGuest)
)

const inHouseList = computed(() =>
  allReservations.value
    .filter((r: Record<string, unknown>) => {
      const ci = String(r.checkIn).slice(0, 10)
      const co = String(r.checkOut).slice(0, 10)
      return ci <= todayStr && co >= todayStr && r.status === 'checked_in'
    })
    .map(mapGuest)
)

const departures = computed(() =>
  allReservations.value
    .filter((r: Record<string, unknown>) => String(r.checkOut).slice(0, 10) === todayStr && r.status === 'checked_in')
    .map(mapGuest)
)

function mapGuest(r: Record<string, unknown>): CheckinGuest {
  const ch = ((r.channel as string) || 'direct').toLowerCase()
  const nights = Math.ceil((new Date(r.checkOut as string).getTime() - new Date(r.checkIn as string).getTime()) / 86400000)
  return {
    id: r.id as string,
    guestName: (r.guestName as string) || 'Guest',
    guestEmail: (r.guestEmail as string) || '',
    initials: ((r.guestName as string) || 'G').split(' ').map((p: string) => p[0]).slice(0, 2).join(''),
    roomNumber: (r.roomNumber as string) || '—',
    roomId: r.roomId as string,
    checkIn: String(r.checkIn).slice(0, 10),
    checkOut: String(r.checkOut).slice(0, 10),
    nights,
    status: r.status as string,
    channel: ch,
    channelLabel: channelLabels[ch] || ch,
    channelColor: channelColors[ch] || 'bg-surface text-navy',
    totalAmount: (r.totalAmount as number) || 0,
    adults: (r.adults as number) || 2,
    children: (r.children as number) || 0,
    checkedIn: r.status === 'checked_in',
    checkedOut: r.status === 'checked_out',
  }
}

const checkoutSettleLabel = computed(() => {
  if (!checkoutFolio.value || !checkoutFolio.value.balance || checkoutFolio.value.balance <= 0) return 'Confirmar Check-out'
  if (!settleMethod.value) return 'Seleccionar pago + Check-out'
  return `Check-out + $${checkoutFolio.value.balance.toFixed(2)} (${settleMethod.value})`
})

const arrivalsToday = computed(() => arrivals.value.length)
const departuresToday = computed(() => departures.value.length)
const inHouse = computed(() => inHouseList.value.length)

function daysUntil(dateStr: string) {
  const d = Math.ceil((new Date(dateStr + 'T12:00:00').getTime() - today.getTime()) / 86400000)
  return d > 0 ? d : 0
}

function resolveError(e: unknown, messages: Record<number, string>, fallback: string): string {
  if (e instanceof ApiError) return messages[e.status] || `${fallback} (${e.status})`
  if (e instanceof TypeError && e.message.includes('fetch')) return 'Sin conexión con el servidor'
  return fallback
}

function guestInitials(name: string) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

function roomCardClass(room: CheckinRoom) {
  const map: Record<string, string> = {
    available: 'border-teal/20 bg-white hover:border-teal',
    occupied: 'border-coral/20 bg-coral/5 hover:border-coral',
    cleaning: 'border-cyan/20 bg-cyan/5',
    dirty: 'border-gold/20 bg-gold/5',
    out_of_service: 'border-gray-300 bg-gray-50',
  }
  return map[room.status] || ''
}

function roomNumberClass(room: CheckinRoom) {
  const map: Record<string, string> = { available: 'text-teal', occupied: 'text-coral', cleaning: 'text-cyan', dirty: 'text-gold', out_of_service: 'text-gray-400' }
  return map[room.status] || 'text-navy'
}

function roomDotClass(room: CheckinRoom) {
  const map: Record<string, string> = { available: 'bg-teal', occupied: 'bg-coral', cleaning: 'bg-cyan', dirty: 'bg-gold', out_of_service: 'bg-gray-400' }
  return map[room.status] || 'bg-gray-300'
}

function roomStatusLabel(room: CheckinRoom) {
  const map: Record<string, string> = { available: 'Disponible', occupied: 'Ocupada', cleaning: 'Limpieza', dirty: 'Sucia', out_of_service: 'F/S' }
  return map[room.status] || room.status
}

async function selectRoom(room: CheckinRoom) {
  selectedRoom.value = room
  showRoomDetail.value = true
  loadRoomAmenities(room.id)
}

function closeRoomDetail() {
  showRoomDetail.value = false
  selectedRoom.value = null
  roomAmenities.value = []
}

function viewReservation(resId: string) {
  router.push(`/panel/reservations?id=${resId}`)
}

async function checkoutFromRoom(room: CheckinRoom) {
  if (!room.resId || processing.value) return
  const reservation = allReservations.value.find(r => r.id === room.resId)
  if (!reservation) return
  openCheckoutModal(mapGuest(reservation))
}

function openCheckinModal(guest: CheckinGuest) {
  checkinGuest.value = guest
  showCheckinModal.value = true
}

function closeCheckinModal() {
  if (processing.value) return
  showCheckinModal.value = false
  checkinGuest.value = null
}

async function doCheckin(guest: CheckinGuest) {
  processing.value = true
  try {
    await ReservationService.checkin(guest.id)
    checkedIn.value.add(guest.id)
    closeCheckinModal()
    await loadData()
    toast.success('Check-in confirmado', `Hab ${guest.roomNumber}`)
  } catch (e) {
    const msg = resolveError(e, {
      409: 'Esta reserva ya tiene check-in hecho',
      403: 'No tienes permiso para hacer check-in',
      404: 'Reserva no encontrada',
    }, 'No se pudo hacer el check-in')
    toast.error(msg, 'Reintentá en unos segundos')
  } finally {
    processing.value = false
  }
}

async function confirmCheckin() {
  if (!checkinGuest.value || processing.value) return
  await doCheckin(checkinGuest.value)
}

async function openCheckoutModal(guest: CheckinGuest) {
  checkoutGuest.value = guest
  checkoutFolio.value = null
  settleMethod.value = null
  showCheckoutModal.value = true

  if (guest.id) {
    folioLoading.value = true
    try {
      const folios = await FoliosService.list(hotelId.value, 'open')
      const match = folios.find(f => f.reservationId === guest.id)
      if (match) {
        const detail = await FoliosService.get(match.id)
        checkoutFolio.value = detail
        if (detail.balance && detail.balance > 0 && detail.balance <= (guest.totalAmount || 0)) {
          settleMethod.value = 'cash'
        }
      }
    } catch {
      // folio not available — proceed without
    } finally {
      folioLoading.value = false
    }
  }
}

function closeCheckoutModal() {
  if (processing.value) return
  showCheckoutModal.value = false
  checkoutGuest.value = null
  checkoutFolio.value = null
  settleMethod.value = null
}

async function doCheckout(guest: CheckinGuest) {
  processing.value = true
  try {
    const balance = checkoutFolio.value?.balance || 0
    const settle = balance > 0 && settleMethod.value
      ? { method: settleMethod.value, amount: balance }
      : null
    const result = await ReservationService.checkout(guest.id, settle)
    checkedOut.value.add(guest.id)
    closeCheckoutModal()
    await loadData()
    const settleMsg = result.settlement?.invoiceNumber
      ? ` · Factura ${result.settlement.invoiceNumber}`
      : ''
    toast.success('Check-out listo', `${guest.guestName} · Hab ${guest.roomNumber}${settleMsg}`)
  } catch (e) {
    const msg = resolveError(e, {
      409: 'Esta reserva no tiene check-in activo',
      403: 'No tienes permiso para hacer check-out',
      404: 'Reserva no encontrada',
    }, 'No se pudo hacer el check-out')
    toast.error(msg, 'Reintentá en unos segundos')
  } finally {
    processing.value = false
  }
}

async function confirmCheckout() {
  if (!checkoutGuest.value || processing.value) return
  await doCheckout(checkoutGuest.value)
}
</script>
