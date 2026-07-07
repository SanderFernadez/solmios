<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3 mb-5">
      <h2 class="text-xl font-black text-navy">Habitaciones</h2>
      <div class="flex gap-2 items-center flex-wrap">
        <div class="relative">
          <input v-model="searchQuery" type="text" placeholder="Buscar habitación, tipo, piso..." class="pl-9 pr-8 py-2 rounded-xl border border-border text-xs font-bold w-64 focus:outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/20 bg-white" />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-navy cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <select v-model="activeFilter" class="px-3 py-2 rounded-xl border border-border text-xs font-bold cursor-pointer bg-white">
          <option value="all">Todas</option>
          <option value="available">Disponibles</option>
          <option value="occupied">Ocupadas</option>
          <option value="cleaning">Limpieza</option>
          <option value="dirty">Sucias</option>
          <option value="out_of_service">F/S</option>
        </select>
        <button @click="openNew" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nueva
        </button>
        <button @click="openBatch" class="flex items-center gap-1.5 bg-surface border border-border text-navy font-bold text-sm px-5 py-2.5 rounded-xl hover:shadow transition cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
          Crear en Lote
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <div v-for="s in stats" :key="s.label" class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="s.bg">
            <span class="w-5 h-5" :class="s.color" v-html="s.icon"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none" :class="s.color">{{ s.value }}</div>
            <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-1 truncate">{{ s.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="rooms.length === 0 && !loading" class="card p-12 text-center">
      <svg class="w-10 h-10 mx-auto mb-3 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1" />
      </svg>
      <p class="text-sm text-text-muted">No hay habitaciones. Creá la primera con "Nueva" o "Crear en Lote".</p>
    </div>

    <!-- Legend -->
    <div v-if="rooms.length > 0" class="flex flex-wrap items-center gap-x-5 gap-y-2 mb-5">
      <div v-for="s in ROOM_STATUS_LEGEND" :key="s.status" class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="s.dot"></span>
        <span class="text-[12px] text-text-secondary">{{ s.label }}</span>
      </div>
    </div>

    <!-- Rooms by Type -->
    <div v-for="rt in paginatedRoomTypes" :key="rt.type" class="mb-6">
      <div class="flex items-center gap-2.5 mb-3 px-1 flex-wrap">
        <span class="w-5 h-5 flex items-center justify-center text-navy shrink-0" v-html="rt.icon"></span>
        <h3 class="text-sm font-black text-navy">{{ rt.type }}</h3>
        <span class="text-xs text-text-muted">({{ rt.rooms.length }})</span>
        <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal/10 text-teal">{{ rt.available }} disponibles</span>
        <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-coral/10 text-coral">{{ rt.occupied }} ocupadas</span>
        <span v-if="rt.cleaning" class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan/10 text-cyan">{{ rt.cleaning }} limpieza</span>
      </div>
      <div class="card p-4">
        <div class="grid gap-3.5" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))">
          <div v-for="room in rt.rooms" :key="room.id" @click="openDetail(room)"
            class="rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all relative bg-white"
            :class="roomCardClass(room.status)">
            <div class="absolute top-3 right-3 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full" :class="statusDot(room.status)"></span>
              <span class="text-[11px] font-semibold uppercase text-text-muted">{{ statusLabel(room.status) }}</span>
            </div>
            <div class="mb-2">
              <span class="text-xl font-black text-navy" :class="{ 'line-through opacity-50': room.status === 'out_of_service' }">
                {{ room.number }}
              </span>
            </div>
            <div class="flex items-baseline gap-1 mb-3">
              <span class="text-sm font-black text-navy">${{ room.basePrice }}</span>
              <span class="text-[11px] text-text-muted font-medium">/noche</span>
            </div>
            <div class="flex items-center gap-3 text-[11px] text-text-muted mb-3">
              <span class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg>
                {{ room.maxGuests }}p
              </span>
              <span class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1"/></svg>
                Piso {{ room.floor }}
              </span>
              <span v-if="room.surfaceArea">{{ room.surfaceArea }}m²</span>
            </div>
            <div class="flex flex-wrap gap-1.5 mt-2">
              <span v-for="a in (room.amenities||[]).slice(0, 4)" :key="a"
                class="px-2 py-0.5 border border-border rounded-md text-[10px] text-text-secondary font-medium">
                {{ amenityLabel(a) }}
              </span>
              <span v-if="(room.amenities||[]).length > 4"
                class="px-2 py-0.5 bg-surface rounded-md text-[10px] text-text-muted">
                +{{ room.amenities.length - 4 }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between mt-4 px-2">
      <div class="text-xs text-text-muted font-bold">
        {{ filteredRooms.length }} de {{ totalRooms }} habitaciones
      </div>
      <div class="flex items-center gap-1.5">
        <button @click="page = 1" :disabled="page <= 1"
          class="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">«</button>
        <button @click="page--" :disabled="page <= 1"
          class="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">‹</button>
        <span class="px-2 text-sm font-bold text-navy">{{ page }} / {{ totalPages }}</span>
        <button @click="page++" :disabled="page >= totalPages"
          class="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">›</button>
        <button @click="page = totalPages" :disabled="page >= totalPages"
          class="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">»</button>
      </div>
    </div>

    <!-- ====================== DETAIL MODAL ====================== -->
    <Teleport to="body">
      <div v-if="detailModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="detailModal.show=false">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div class="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
            <div class="flex items-center gap-3">
              <span class="text-2xl font-black text-navy">{{ detailRoom?.number }}</span>
              <span class="w-2.5 h-2.5 rounded-full" :class="statusDot(detailRoom?.status||'')"></span>
              <span class="text-sm font-bold text-text-muted uppercase">{{ statusLabel(detailRoom?.status||'') }}</span>
            </div>
            <button @click="detailModal.show=false" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center hover:bg-gray-200 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div class="p-6 space-y-5">
            <!-- Room info -->
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-surface rounded-xl p-3.5">
                <div class="text-[11px] text-text-muted uppercase font-bold">Tipo</div>
                <div class="text-sm font-black text-navy">{{ typeLabel(detailRoom?.type||'') }}</div>
              </div>
              <div class="bg-surface rounded-xl p-3.5">
                <div class="text-[11px] text-text-muted uppercase font-bold">Precio</div>
                <div class="text-sm font-black text-navy">${{ detailRoom?.basePrice }} <span class="text-xs font-medium text-text-muted">/noche</span></div>
              </div>
              <div class="bg-surface rounded-xl p-3.5">
                <div class="text-[11px] text-text-muted uppercase font-bold">Piso</div>
                <div class="text-sm font-bold text-navy">{{ detailRoom?.floor }}</div>
              </div>
              <div class="bg-surface rounded-xl p-3.5">
                <div class="text-[11px] text-text-muted uppercase font-bold">Capacidad</div>
                <div class="text-sm font-bold text-navy">{{ detailRoom?.maxGuests }} personas</div>
              </div>
              <div class="bg-surface rounded-xl p-3.5">
                <div class="text-[11px] text-text-muted uppercase font-bold">Baños</div>
                <div class="text-sm font-bold text-navy">{{ detailRoom?.bathrooms }}</div>
              </div>
              <div class="bg-surface rounded-xl p-3.5">
                <div class="text-[11px] text-text-muted uppercase font-bold">Superficie</div>
                <div class="text-sm font-bold text-navy">{{ detailRoom?.surfaceArea || '-' }} m²</div>
              </div>
            </div>

            <!-- Guest info if occupied -->
            <div v-if="detailRoom?.status === 'occupied' && detailRoom?.guestName" class="bg-coral/5 border border-coral/20 rounded-xl p-4">
              <div class="text-[11px] text-coral uppercase font-bold mb-1">Huésped en Casa</div>
              <div class="text-sm font-black text-navy">{{ detailRoom.guestName }}</div>
              <div v-if="detailRoom.guestEmail" class="text-xs text-text-muted">{{ detailRoom.guestEmail }}</div>
            </div>

            <!-- Amenities -->
            <div>
              <div class="text-[11px] font-bold text-navy uppercase mb-2">Incluye</div>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="a in (detailRoom?.amenities||[])" :key="a"
                  class="px-2.5 py-1 bg-surface rounded-lg border border-border text-xs text-navy font-medium">
                  {{ amenityLabel(a) }}
                </span>
                <span v-if="!detailRoom?.amenities?.length" class="text-xs text-text-muted">Sin amenities configurados</span>
              </div>
            </div>

            <!-- Quick Status Change -->
            <div>
              <div class="text-[11px] font-bold text-navy uppercase mb-3">Cambiar Estado</div>
              <div class="grid grid-cols-2 gap-2">
                <button v-for="opt in statusOptions" :key="opt.value"
                  @click="changeStatus(opt.value)"
                  :disabled="detailRoom?.status === opt.value || statusChanging"
                  class="p-3 rounded-xl border text-left transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-sm"
                  :class="detailRoom?.status === opt.value ? 'border-navy bg-navy/5' : 'border-border'">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="statusDot(opt.value)"></span>
                    <div>
                      <div class="text-xs font-extrabold text-navy">{{ opt.label }}</div>
                      <div class="text-[10px] text-text-muted leading-tight">{{ opt.desc }}</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div class="p-6 border-t border-border bg-surface/50 flex gap-3 justify-between sticky bottom-0">
            <button @click="deleteRoomFromDetail"
              class="flex items-center gap-1.5 px-4 py-2.5 border border-coral/30 text-coral rounded-xl text-sm font-bold cursor-pointer hover:bg-coral/5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
              Eliminar
            </button>
            <div class="flex gap-2">
              <button @click="detailModal.show=false" class="px-4 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cerrar</button>
              <button @click="openEditFromDetail" class="flex items-center gap-1.5 px-4 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-navy/90">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                Editar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ====================== BATCH MODAL ====================== -->
    <Teleport to="body">
      <div v-if="batchModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="batchModal.show=false">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div class="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 class="text-lg font-black text-navy flex items-center gap-2.5">
              <svg class="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
              Crear Habitaciones en Lote
            </h3>
            <button @click="batchModal.show=false" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center hover:bg-gray-200 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div class="p-6 space-y-5">
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase mb-3">Tipo de Habitación</label>
              <div class="grid grid-cols-2 gap-2">
                <button v-for="opt in typeOptions" :key="opt.value"
                  @click="batchForm.type = opt.value"
                  class="p-3 rounded-xl border text-left transition cursor-pointer"
                  :class="batchForm.type === opt.value
                    ? 'border-navy bg-navy/5'
                    : 'border-border hover:border-navy/30'">
                  <div class="flex items-center gap-2.5">
                    <span class="w-5 h-5 shrink-0 text-navy" v-html="opt.icon"></span>
                    <div>
                      <div class="text-sm font-extrabold text-navy">{{ opt.label }}</div>
                      <div class="text-[11px] text-text-muted">{{ opt.desc }}</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-navy uppercase mb-3">Rango de Números</label>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] text-text-muted font-bold mb-1">Desde N°</label>
                  <input v-model.number="batchForm.from" type="number" min="1" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm font-bold" placeholder="101" />
                </div>
                <div>
                  <label class="block text-[11px] text-text-muted font-bold mb-1">Hasta N°</label>
                  <input v-model.number="batchForm.to" type="number" min="1" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm font-bold" placeholder="110" />
                </div>
              </div>
              <div v-if="batchCount > 0 && batchCount <= 100" class="mt-3 bg-teal/5 border border-teal/20 rounded-xl p-3 flex items-center gap-2">
                <svg class="w-4 h-4 text-teal shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
                <span class="text-xs font-bold text-teal">{{ batchCount }} habitaciones</span>
                <span class="text-[11px] text-teal/80">{{ batchPreview }}</span>
              </div>
              <div v-else-if="batchCount > 100" class="mt-3 bg-coral/5 border border-coral/20 rounded-xl p-3">
                <span class="text-xs font-bold text-coral">Máximo 100 por lote</span>
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-navy uppercase mb-3">Configuración</label>
              <div class="grid grid-cols-3 gap-3">
                <div><label class="block text-[11px] text-text-muted font-bold mb-1">Precio Base $</label><input v-model.number="batchForm.basePrice" type="number" min="0" class="w-full px-3 py-2 rounded-xl border border-border text-sm font-bold text-navy" /></div>
                <div><label class="block text-[11px] text-text-muted font-bold mb-1">Capacidad</label><input v-model.number="batchForm.capacity" type="number" min="1" max="20" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                <div><label class="block text-[11px] text-text-muted font-bold mb-1">Piso</label><input v-model.number="batchForm.floor" type="number" min="0" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                <div><label class="block text-[11px] text-text-muted font-bold mb-1">Baños</label><input v-model.number="batchForm.bathrooms" type="number" min="0" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                <div><label class="block text-[11px] text-text-muted font-bold mb-1">Superficie m²</label><input v-model.number="batchForm.surfaceArea" type="number" min="0" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                <div class="flex items-end"><label class="flex items-center gap-2 cursor-pointer bg-surface rounded-xl px-3 py-2 w-full"><input v-model="batchForm.onlineBooking" type="checkbox" class="w-4 h-4 rounded text-cyan" /><span class="text-[11px] font-bold text-navy">Venta Online</span></label></div>
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-navy uppercase mb-3">¿Qué incluye?</label>
              <div class="grid grid-cols-2 gap-1.5 bg-surface rounded-xl p-3">
                <label v-for="a in batchAmenities" :key="a.key" class="flex items-center gap-2 cursor-pointer hover:bg-white rounded-lg px-2 py-1.5 transition">
                  <input type="checkbox" :value="a.key" v-model="batchForm.amenities" class="w-3.5 h-3.5 rounded text-cyan" />
                  <span class="text-xs text-navy">{{ a.label }}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="p-6 border-t border-border bg-surface/50 flex gap-3 justify-end sticky bottom-0">
            <button @click="batchModal.show=false" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="executeBatch" :disabled="batchSaving || batchCount <= 0 || batchCount > 100"
              class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              {{ batchSaving ? 'Creando...' : `Crear ${batchCount} habitaciones` }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ====================== EDIT MODAL ====================== -->
    <Teleport to="body">
      <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="modal.show=false">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div class="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 class="text-lg font-black text-navy">{{ modal.edit ? 'Editar' : 'Nueva' }} Habitación</h3>
            <button @click="modal.show=false" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center hover:bg-gray-200 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="p-6 space-y-4">
            <div class="grid grid-cols-3 gap-4">
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Número *</label><input v-model="form.number" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Tipo</label>
                <select v-model="form.type" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer">
                  <option value="single">Individual</option><option value="double">Doble</option><option value="twin">Twin</option><option value="suite">Suite</option><option value="deluxe">Deluxe</option><option value="presidential">Presidencial</option><option value="family">Familiar</option>
                </select>
              </div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Estado</label>
                <select v-model="form.status" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer">
                  <option value="available">Disponible</option><option value="occupied">Ocupada</option><option value="cleaning">Limpieza</option><option value="dirty">Sucia</option><option value="out_of_service">F/S</option>
                </select>
              </div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Piso</label><input v-model.number="form.floor" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Capacidad</label><input v-model.number="form.maxGuests" type="number" min="1" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Precio Base $</label><input v-model.number="form.basePrice" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-navy" /></div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Superficie m²</label><input v-model.number="form.surfaceArea" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Baños</label><input v-model.number="form.bathrooms" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
              <div class="flex items-end"><label class="flex items-center gap-2 cursor-pointer bg-surface rounded-xl p-3 w-full"><input v-model="form.onlineBooking" type="checkbox" class="w-4 h-4 rounded text-cyan" /><span class="text-[11px] font-bold text-navy">Venta Online</span></label></div>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase mb-2">Amenities</label>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-2 bg-surface rounded-xl p-3">
                <label v-for="a in amenityOptions" :key="a.key" class="flex items-center gap-2 cursor-pointer hover:bg-white rounded-lg px-2 py-1.5">
                  <input type="checkbox" :value="a.key" v-model="form.amenities" class="w-3.5 h-3.5 rounded text-cyan" />
                  <span class="text-xs text-navy">{{ a.label }}</span>
                </label>
              </div>
            </div>
          </div>
          <div class="p-6 border-t border-border bg-surface/50 flex gap-3 justify-end sticky bottom-0">
            <button @click="modal.show=false" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="save" :disabled="saving" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer">{{ saving?'Guardando...':'Guardar' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { ApiError } from '@/services/http'
import type { Room } from '@/types'

interface MappedRoom {
  id: string
  number: string
  type: string
  floor: number
  status: string
  maxGuests: number
  basePrice: number
  amenities: string[]
  surfaceArea: number
  bathrooms: number
  onlineBooking: boolean
  guestName: string | null
  guestEmail: string | null
}

interface BatchForm {
  type: string
  from: number | null
  to: number | null
  basePrice: number
  capacity: number
  floor: number
  bathrooms: number
  surfaceArea: number
  onlineBooking: boolean
  amenities: string[]
}

interface EditForm {
  number: string
  type: string
  floor: number
  maxGuests: number
  basePrice: number
  status: string
  amenities: string[]
  surfaceArea: number
  bathrooms: number
  onlineBooking: boolean
}

const auth = useAuthStore()
const toast = useToast()
const hid = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const activeFilter = ref('all')
const searchQuery = ref('')
const rooms = ref<MappedRoom[]>([])
const loading = ref(false)
const saving = ref(false)
const batchSaving = ref(false)
const statusChanging = ref(false)
const editId = ref('')
const page = ref(1)
const perPage = 60

const modal = ref({ show: false, edit: false })
const detailModal = ref({ show: false })
const batchModal = ref({ show: false })
const detailRoom = ref<MappedRoom | null>(null)

const form = ref<EditForm>({ number:'', type:'double', floor:1, maxGuests:2, basePrice:80, status:'available', amenities:[], surfaceArea:0, bathrooms:1, onlineBooking:true })

const batchForm = ref<BatchForm>({
  type: 'double',
  from: null,
  to: null,
  basePrice: 80,
  capacity: 2,
  floor: 1,
  bathrooms: 1,
  surfaceArea: 0,
  onlineBooking: true,
  amenities: [],
})

const ICON_CROWN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="m3 8 4 3 5-6 5 6 4-3-2 10H5L3 8Z"/></svg>'
const ICON_BED = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 18v2M3 18h18M21 18v2M5 13V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/></svg>'
const ICON_USERS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72M18 18.72a9.094 9.094 0 0 1-3.741-.479 3 3 0 0 1 4.682-2.72M18 18.72v-.235a3 3 0 0 0-3-3M6 18.72a9.094 9.094 0 0 1-3.741-.479 3 3 0 0 1 4.682-2.72M6 18.72v-.235a3 3 0 0 1 3-3m3.75-6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"/></svg>'
const ICON_DOOR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M5 21h10M5 21H3m14 0h2M13 12h.01"/></svg>'

const typeOptions = [
  { value: 'single', label: 'Individual', desc: '1 cama · 1 persona', icon: ICON_DOOR },
  { value: 'double', label: 'Doble', desc: '1 cama grande · 2 personas', icon: ICON_BED },
  { value: 'twin', label: 'Twin', desc: '2 camas · 2 personas', icon: ICON_BED },
  { value: 'suite', label: 'Suite', desc: 'Sala + hab · 2-4 personas', icon: ICON_CROWN },
  { value: 'deluxe', label: 'Deluxe', desc: 'Vista premium · 2 personas', icon: ICON_CROWN },
  { value: 'presidential', label: 'Presidencial', desc: 'Máximo lujo · 4 personas', icon: ICON_CROWN },
  { value: 'family', label: 'Familiar', desc: '4+ personas · niños', icon: ICON_USERS },
]

const amenityOptions = [
  { key:'wifi', label:'WiFi' },{ key:'tv', label:'TV' },{ key:'ac', label:'Aire Acond.' },
  { key:'heating', label:'Calefacción' },{ key:'safe', label:'Caja Fuerte' },{ key:'minibar', label:'Minibar' },
  { key:'kitchen', label:'Cocina' },{ key:'fridge', label:'Nevera' },{ key:'microwave', label:'Microondas' },
  { key:'coffee_maker', label:'Cafetera' },{ key:'washer', label:'Lavadora' },{ key:'dishwasher', label:'Lavavajillas' },
  { key:'hair_dryer', label:'Secador' },{ key:'iron', label:'Plancha' },{ key:'balcony', label:'Balcón' },
  { key:'bathtub', label:'Bañera' },{ key:'work_desk', label:'Escritorio' },
]

const batchAmenities = amenityOptions

const statusOptions = [
  { value: 'available', label: 'Disponible', desc: 'Lista para recibir huésped' },
  { value: 'occupied', label: 'Ocupada', desc: 'Huésped en check-in' },
  { value: 'cleaning', label: 'Limpieza', desc: 'Housekeeping limpiando' },
  { value: 'dirty', label: 'Sucia', desc: 'Post check-out, espera limpieza' },
  { value: 'out_of_service', label: 'F/S', desc: 'Fuera de servicio, no vendible' },
]

const TYPE_LABEL: Record<string,string> = {
  single:'Individual', double:'Doble', twin:'Twin', suite:'Suite', deluxe:'Deluxe', presidential:'Presidencial', family:'Familiar',
}

function typeLabel(t: string): string { return TYPE_LABEL[t] || t.charAt(0).toUpperCase() + t.slice(1) }

function amenityLabel(key: string): string {
  const found = amenityOptions.find(a => a.key === key)
  return found ? found.label : key.replace(/_/g, ' ')
}

const batchCount = computed(() => {
  const f = batchForm.value.from
  const t = batchForm.value.to
  if (f == null || t == null || f <= 0 || t <= 0) return 0
  return t - f + 1
})

const batchPreview = computed(() => {
  const f = batchForm.value.from
  const t = batchForm.value.to
  if (f == null || t == null || f <= 0 || t <= 0) return ''
  const count = t - f + 1
  if (count <= 0) return ''
  if (count <= 5) return Array.from({ length: count }, (_, i) => String(f + i)).join(', ')
  return `${f}, ${f+1}, ${f+2} ... ${t-1}, ${t}`
})

const KPI_ICON_CHECK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const KPI_ICON_USER = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg>'
const KPI_ICON_SPARKLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.035-.259a3.375 3.375 0 0 0 2.456-2.455L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/></svg>'
const KPI_ICON_ALERT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z"/></svg>'
const KPI_ICON_XCIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'

const stats = computed(() => [
  { label:'Total', value:rooms.value.length, color:'text-navy', bg:'bg-navy/10', icon: ICON_BED },
  { label:'Disp.', value:rooms.value.filter(r=>r.status==='available').length, color:'text-teal', bg:'bg-teal/10', icon: KPI_ICON_CHECK },
  { label:'Ocup.', value:rooms.value.filter(r=>r.status==='occupied').length, color:'text-coral', bg:'bg-coral/10', icon: KPI_ICON_USER },
  { label:'Limpieza', value:rooms.value.filter(r=>r.status==='cleaning').length, color:'text-cyan', bg:'bg-cyan/10', icon: KPI_ICON_SPARKLE },
  { label:'Sucias', value:rooms.value.filter(r=>r.status==='dirty').length, color:'text-gold', bg:'bg-gold/10', icon: KPI_ICON_ALERT },
  { label:'F/S', value:rooms.value.filter(r=>r.status==='out_of_service').length, color:'text-gray-400', bg:'bg-gray-100', icon: KPI_ICON_XCIRCLE },
])

const TYPE_ICON: Record<string, string> = {
  single: ICON_DOOR, dorm: ICON_DOOR,
  double: ICON_BED, twin: ICON_BED,
  triple: ICON_USERS, quad: ICON_USERS, family: ICON_USERS,
  suite: ICON_CROWN, deluxe: ICON_CROWN, presidential: ICON_CROWN, villa: ICON_CROWN,
}

const ROOM_STATUS_LEGEND = [
  { status: 'available', label: 'Disponible', dot: 'bg-teal' },
  { status: 'occupied', label: 'Ocupada', dot: 'bg-coral' },
  { status: 'cleaning', label: 'Limpieza', dot: 'bg-cyan' },
  { status: 'dirty', label: 'Sucia', dot: 'bg-gold' },
  { status: 'out_of_service', label: 'Fuera de servicio', dot: 'bg-gray-400' },
]

const totalRooms = ref(0)

const filteredRooms = computed(() => {
  let list = rooms.value
  if (activeFilter.value !== 'all') list = list.filter(r => r.status === activeFilter.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(r =>
      [r.number, r.type, r.floor, r.status, ...(r.amenities || [])]
        .join(' ').toLowerCase().includes(q),
    )
  }
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRooms.value.length / perPage)))

const paginatedRoomTypes = computed(() => {
  const start = (page.value - 1) * perPage
  const list = filteredRooms.value.slice(start, start + perPage)
  const g: Record<string, MappedRoom[]> = {}
  for (const r of list) { const t = r.type || 'double'; if (!g[t]) g[t] = []; g[t].push(r) }
  return Object.entries(g).map(([t, rs]) => ({
    type: (t.charAt(0).toUpperCase() + t.slice(1)).replace('Presidential', 'Presidencial'),
    icon: TYPE_ICON[t] || ICON_BED,
    available: rs.filter(r => r.status === 'available').length,
    occupied: rs.filter(r => r.status === 'occupied').length,
    cleaning: rs.filter(r => r.status === 'cleaning').length,
    rooms: rs,
  }))
})

watch([activeFilter, searchQuery], () => { page.value = 1 })

function roomCardClass(s: string) {
  const m: Record<string,string> = { available:'border-teal/20 bg-teal/[0.02]', occupied:'border-coral/20 bg-coral/[0.02]', cleaning:'border-cyan/20 bg-cyan/[0.02]', dirty:'border-gold/20 bg-gold/[0.02]', out_of_service:'border-gray-200 bg-gray-50' }
  return m[s] || 'border-border'
}
function statusDot(s: string) { const m: Record<string,string> = { available:'bg-teal', occupied:'bg-coral', cleaning:'bg-cyan', dirty:'bg-gold', out_of_service:'bg-gray-400' }; return m[s]||'bg-gray-300' }
function statusLabel(s: string) { const m: Record<string,string> = { available:'Disponible', occupied:'Ocupada', cleaning:'En Limpieza', dirty:'Sucia', out_of_service:'F/S' }; return m[s]||s }

async function load() {
  loading.value = true
  try {
    const { RoomService } = await import('@/services/Room.service')
    const { AmenitiesService } = await import('@/services/Amenities.service')
    const { ReservationService } = await import('@/services/Reservation.service')
    const { GuestService } = await import('@/services/Guest.service')

    const [res, reservationsData, guestsData] = await Promise.all([
      RoomService.list({ hotelId: hid.value, limit: 100 }),
      ReservationService.list({ hotelId: hid.value, status: 'checked_in' }).catch(() => ({ reservations: [] })),
      GuestService.list({ hotelId: hid.value }).catch(() => ({ guests: [] })),
    ])

    const guestsMap = new Map<string, string>()
    for (const g of (guestsData as any).guests || []) {
      if (g.id) guestsMap.set(g.id, g.name || '')
    }

    const reservations = (reservationsData as any).reservations || []
    const roomGuestMap = new Map<string, { guestName: string; guestEmail: string }>()
    for (const r of reservations) {
      if (r.roomId && r.status === 'checked_in') {
        const guestName = r.guestName || (r.guestId ? guestsMap.get(r.guestId) : '') || ''
        const guestEmail = r.guestEmail || ''
        roomGuestMap.set(r.roomId, { guestName, guestEmail })
      }
    }

    const mapped: MappedRoom[] = (res.rooms || []).map((r: Room) => ({
      id: r.id, number: r.number, type: r.type, floor: r.floor || 1, status: r.status || 'available',
      maxGuests: r.maxGuests || 2, basePrice: r.basePrice || 0,
      amenities: [] as string[], surfaceArea: r.surfaceArea || 0, bathrooms: r.bathrooms || 1,
      onlineBooking: r.onlineBookingEnabled !== false,
      guestName: roomGuestMap.get(r.id)?.guestName || null,
      guestEmail: roomGuestMap.get(r.id)?.guestEmail || null,
    }))
    await Promise.all(mapped.map(async (r: MappedRoom) => {
      try { const am = await AmenitiesService.listRoom(r.id); r.amenities = (am.data || []).map((a: { amenityKey: string }) => a.amenityKey) } catch {}
    }))
    rooms.value = mapped
    totalRooms.value = res.total
  } catch {
    toast.error('Error al cargar habitaciones')
  }
  loading.value = false
}

function openDetail(room: MappedRoom) {
  detailRoom.value = room
  detailModal.value.show = true
}

function openEditFromDetail() {
  const room = detailRoom.value
  if (!room) return
  detailModal.value.show = false
  editId.value = room.id; modal.value = { show: true, edit: true }
  const amenities = [...(room.amenities || [])]
  form.value = { number: room.number, type: room.type, floor: room.floor || 1, maxGuests: room.maxGuests || 2, basePrice: room.basePrice || 0, status: room.status || 'available', amenities, surfaceArea: room.surfaceArea || 0, bathrooms: room.bathrooms || 1, onlineBooking: room.onlineBooking !== false }
}

function openNew() {
  editId.value = ''; modal.value = { show: true, edit: false }
  form.value = { number: '', type: 'double', floor: 1, maxGuests: 2, basePrice: 80, status: 'available', amenities: [], surfaceArea: 0, bathrooms: 1, onlineBooking: true }
}

async function changeStatus(newStatus: string) {
  const room = detailRoom.value
  if (!room || room.status === newStatus) return
  statusChanging.value = true
  try {
    const { RoomService } = await import('@/services/Room.service')
    await RoomService.update(room.id, { status: newStatus } as Record<string, unknown>)
    room.status = newStatus
    const idx = rooms.value.findIndex(r => r.id === room.id)
    if (idx >= 0) rooms.value[idx].status = newStatus
    toast.success(`Hab ${room.number} → ${statusLabel(newStatus)}`)
  } catch (e) {
    const msg = e instanceof ApiError ? `Error (${e.status})` : 'Sin conexión'
    toast.error(msg)
  }
  statusChanging.value = false
}

async function save() {
  if (!form.value.number) { toast.error('Falta número'); return }
  saving.value = true
  try {
    const { RoomService } = await import('@/services/Room.service')
    const { AmenitiesService } = await import('@/services/Amenities.service')
    const patch: Record<string, unknown> = { number: form.value.number, type: form.value.type, floor: form.value.floor, maxGuests: form.value.maxGuests, basePrice: form.value.basePrice, status: form.value.status, surfaceArea: form.value.surfaceArea, bathrooms: form.value.bathrooms, onlineBookingEnabled: form.value.onlineBooking }
    let roomId = editId.value
    if (roomId) { await RoomService.update(roomId, patch) }
    else { const created = await RoomService.create({ ...patch, hotelId: hid.value! }); roomId = created.id }
    await AmenitiesService.saveRoom(roomId, form.value.amenities)
    toast.success(editId.value ? 'Actualizada' : 'Creada')
  } catch (e) {
    const msg = e instanceof ApiError ? `Error (${e.status})` : 'Sin conexión'
    toast.error(msg)
  }
  saving.value = false; modal.value.show = false; await load()
}

async function deleteRoomFromDetail() {
  const room = detailRoom.value
  if (!room) return
  if (!confirm(`¿Eliminar habitación ${room.number}?`)) return
  try {
    const { RoomService } = await import('@/services/Room.service')
    await RoomService.delete(room.id)
    toast.success('Eliminada')
    detailModal.value.show = false
    await load()
  } catch { toast.error('Error al eliminar') }
}

function openBatch() {
  batchForm.value = { type: 'double', from: null, to: null, basePrice: 80, capacity: 2, floor: 1, bathrooms: 1, surfaceArea: 0, onlineBooking: true, amenities: [] }
  batchModal.value.show = true
}

async function executeBatch() {
  const f = batchForm.value.from
  const t = batchForm.value.to
  if (f == null || t == null || f <= 0 || t <= 0) { toast.error('Ingresá rango válido'); return }
  if (f > t) { toast.error('Desde debe ser menor o igual a Hasta'); return }
  if (t - f + 1 > 100) { toast.error('Máximo 100 por lote'); return }
  if (!hid.value) { toast.error('Sin hotel asignado'); return }

  batchSaving.value = true
  try {
    const { RoomService } = await import('@/services/Room.service')
    const { AmenitiesService } = await import('@/services/Amenities.service')
    const result = await RoomService.batchCreate({
      hotelId: hid.value,
      type: batchForm.value.type,
      basePrice: batchForm.value.basePrice,
      from: f,
      to: t,
      floor: batchForm.value.floor,
      capacity: batchForm.value.capacity,
      bathrooms: batchForm.value.bathrooms,
      surfaceArea: batchForm.value.surfaceArea,
      onlineBookingEnabled: batchForm.value.onlineBooking,
    })

    const created = result.data
    if (batchForm.value.amenities.length > 0 && created.length > 0) {
      await Promise.all(created.map((r: { id: string }) => AmenitiesService.saveRoom(r.id, batchForm.value.amenities)))
    }

    toast.success(`Creadas ${created.length} habitaciones`, `${batchForm.value.type}`)
    batchModal.value.show = false
    await load()
  } catch (e) {
    const msg = e instanceof ApiError ? e.message || `Error (${e.status})` : 'Sin conexión'
    toast.error('Error al crear lote', msg)
  }
  batchSaving.value = false
}

// Auto-refresh cada 30 segundos
const AUTO_REFRESH_MS = 30_000
let refreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  load()
  refreshInterval = setInterval(() => {
    if (!loading.value) load()
  }, AUTO_REFRESH_MS)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<style scoped>
</style>
