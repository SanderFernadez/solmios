<template>
  <div class="min-h-screen space-y-4 bg-surface p-6">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-black text-navy">Planning</h1>
        <div class="mt-0.5 flex items-center gap-2.5">
          <p class="text-sm text-text-muted">Arrastrá sobre las celdas para seleccionar fechas</p>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
            </span>
            En vivo
          </span>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1 rounded-xl border border-border bg-white px-1 py-1">
          <button @click="prevWeek" class="p-nav-btn" title="Anterior">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span class="min-w-[190px] text-center text-xs font-bold text-navy tabular-nums">{{ weekLabel }}</span>
          <button @click="nextWeek" class="p-nav-btn" title="Siguiente">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
        <button @click="goToday" class="rounded-full bg-navy px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-navy-light cursor-pointer">Hoy</button>
        <div class="flex items-center gap-0.5 rounded-xl border border-border bg-white p-1">
          <button v-for="vd in [7, 14, 30]" :key="vd" @click="viewDays = vd"
            class="rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition-colors cursor-pointer"
            :class="viewDays === vd ? 'bg-navy text-white' : 'text-text-secondary hover:text-navy'">
            {{ vd }}d
          </button>
        </div>
      </div>
    </div>

    <!-- Toolbar / leyenda -->
    <div class="flex flex-wrap items-center gap-3 rounded-[20px] border border-border bg-white px-4 py-3 shadow-(--shadow-card) text-[10px] font-bold">
      <div class="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
        <button @click="colorMode = 'channel'" class="rounded-lg px-2.5 py-1 text-[10px] font-extrabold transition-colors cursor-pointer" :class="colorMode === 'channel' ? 'bg-navy text-white' : 'text-text-muted hover:text-navy'">Por Canal</button>
        <button @click="colorMode = 'status'" class="rounded-lg px-2.5 py-1 text-[10px] font-extrabold transition-colors cursor-pointer" :class="colorMode === 'status' ? 'bg-navy text-white' : 'text-text-muted hover:text-navy'">Por Estado</button>
      </div>
      <template v-if="colorMode === 'channel'">
        <span v-for="c in detectedChannels" :key="c.key" class="flex items-center gap-1.5">
          <span v-if="getChannelBrand(c.key)" class="flex items-center justify-center h-3 w-3" :style="{ color: getChannelBrand(c.key)!.color }" v-html="getChannelBrand(c.key)!.icon"></span>
          <span v-else class="h-2.5 w-2.5 rounded" :class="c.bg"></span>
          <span class="text-text-secondary">{{ c.l }}</span>
        </span>
        <span v-if="!detectedChannels.length" class="text-text-muted italic">Sin reservas en este rango</span>
      </template>
      <template v-else>
        <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded bg-amber-500"></span><span class="text-text-secondary">Pendiente</span></span>
        <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded bg-cyan"></span><span class="text-text-secondary">Confirmada</span></span>
        <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded bg-teal"></span><span class="text-text-secondary">Check-in</span></span>
        <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded bg-purple"></span><span class="text-text-secondary">Check-out</span></span>
        <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded bg-coral"></span><span class="text-text-secondary">Cancelada</span></span>
      </template>
      <span class="h-3.5 w-px bg-border"></span>
      <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded bg-gray-300"></span><span class="text-text-secondary">Bloqueo</span></span>
      <span class="h-3.5 w-px bg-border"></span>
      <span class="flex items-center gap-1.5 text-text-secondary">
        <svg class="h-3 w-3 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2"/></svg>
        Pago parcial
      </span>
      <span class="flex items-center gap-1.5 text-text-secondary">
        <svg class="h-3 w-3 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Pagada
      </span>
      <span class="flex items-center gap-1.5 text-text-secondary">
        <svg class="h-3 w-3 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11V7a5 5 0 0 1 10 0v4M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/></svg>
        Con cerradura
      </span>
      <span class="h-3.5 w-px bg-border"></span>
      <span class="uppercase text-text-muted">Tipos:</span>
      <button v-for="rt in roomTypes" :key="rt.type" @click="toggleTypeFilter(rt.type)"
        class="rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer"
        :class="typeFilter.has(rt.type) ? 'border-navy bg-navy/10 text-navy' : 'border-border text-text-muted line-through'">
        {{ rt.type }} ({{ rt.rooms.length }})
      </button>
    </div>

    <!-- Grid -->
    <div @mouseup="onMouseUp" @mousemove="onMouseMove" @mouseleave="onMouseUp">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
        <div class="overflow-x-auto">
          <div class="min-w-max select-none">
            <!-- Header -->
            <div class="flex border-b border-border bg-surface/50 sticky top-0 z-10">
              <div class="w-56 flex-shrink-0 px-4 py-3 border-r border-border">
                <span class="text-[10px] font-bold text-text-muted uppercase">Habitaciones</span>
              </div>
              <div v-for="day in visibleDays" :key="day.dateStr"
                class="flex-1 min-w-[68px] px-2 py-3 text-center border-r border-border shrink-0"
                :class="day.isToday ? 'bg-cyan/5' : day.isWeekend ? 'bg-surface/80' : ''">
                <div class="text-[10px] font-bold" :class="day.isToday ? 'text-cyan' : 'text-text-muted'">{{ day.dayName }}</div>
                <div class="text-xs font-black mt-0.5" :class="day.isToday ? 'text-cyan' : 'text-navy'">{{ day.dayNum }}</div>
                <div class="text-[9px] text-text-muted mt-0.5">{{ day.monthShort }}</div>
              </div>
            </div>

            <!-- Room groups -->
            <template v-for="rt in filteredRoomTypes" :key="rt.type">
              <div class="flex border-b border-border bg-navy/5">
                <div class="w-56 flex-shrink-0 px-4 py-2.5 border-r border-border flex items-center gap-2">
                  <div class="w-3 h-3 rounded" :class="rt.dot"></div>
                  <span class="text-sm font-black text-navy">{{ rt.type }}</span>
                  <span class="text-[10px] text-text-muted">({{ rt.rooms.length }})</span>
                </div>
                <div class="flex-1 px-4 py-2.5 flex items-center gap-4">
                  <span class="text-[10px] font-bold text-teal">{{ rt.occupied }} ocupadas</span>
                  <span class="text-[10px] text-text-muted">{{ rt.rooms.length - rt.occupied }} libres</span>
                </div>
              </div>

              <div v-for="room in rt.rooms" :key="room.id" class="flex border-b border-border hover:bg-surface/30">
                <div class="w-56 flex-shrink-0 px-4 py-3 border-r border-border flex items-center gap-3">
                  <span class="font-bold text-sm text-navy">{{ room.number }}</span>
                  <span class="text-[10px] text-text-muted truncate">{{ room.type }}</span>
                  <span class="w-2 h-2 rounded-full ml-auto" :class="room.status === 'occupied' ? 'bg-coral' : 'bg-teal'"></span>
                </div>

                <div v-for="day in visibleDays" :key="day.dateStr + room.id"
                  :data-rid="room.id" :data-date="day.dateStr"
                  class="flex-1 min-w-[68px] h-12 border-r border-border relative cursor-pointer shrink-0"
                  :class="[
                    day.isToday ? 'bg-cyan/[0.04]' : '',
                    day.isWeekend ? 'bg-surface/40' : '',
                    isInRange(room.id, day.dateStr) ? 'bg-cyan/20 ring-1 ring-cyan/50 ring-inset' : '',
                    dragRoom?.id === room.id && !isInRange(room.id, day.dateStr) ? 'hover:bg-cyan/5' : '',
                  ]"
                  @mousedown.prevent="onMouseDown(room, day, $event)"
                  @dragover.prevent
                  @drop="onResDrop(room)">

                  <!-- Reservation -->
                  <div v-if="gRes(room.id, day.dateStr) && isResFirst(room.id, day.dateStr)"
                    class="absolute inset-y-1 left-0 rounded-md flex items-center gap-1.5 px-2 z-10 overflow-hidden cursor-pointer hover:brightness-90"
                    :class="gRes(room.id, day.dateStr)!.bg"
                    :style="{ width: resSpan(room.id, day) + 'px', minWidth: '60px' }"
                    draggable="true"
                    @dragstart="onResDrag($event, gRes(room.id, day.dateStr)!)"
                    @click.stop="openContext($event, gRes(room.id, day.dateStr)!, room)"
                    @contextmenu.prevent.stop="openContext($event, gRes(room.id, day.dateStr)!, room)">
                    <span v-if="getChannelBrand(gRes(room.id, day.dateStr)!.chKey)" class="flex items-center justify-center h-3.5 w-3.5 rounded-full bg-white shrink-0 p-0.5"
                      :style="{ color: getChannelBrand(gRes(room.id, day.dateStr)!.chKey)!.color }" :title="getChannelBrand(gRes(room.id, day.dateStr)!.chKey)!.label"
                      v-html="getChannelBrand(gRes(room.id, day.dateStr)!.chKey)!.icon"></span>
                    <span class="text-[9px] font-extrabold truncate text-white" :title="'Canal: ' + gRes(room.id, day.dateStr)!.ch">{{ gRes(room.id, day.dateStr)!.name }}</span>
                    <span class="text-[8px] text-white/70 ml-auto shrink-0 flex items-center gap-1">
                      <svg v-if="gRes(room.id, day.dateStr)!.lockCode" class="h-2.5 w-2.5" :title="`Cerradura: ${gRes(room.id, day.dateStr)!.lockCode}`" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11V7a5 5 0 0 1 10 0v4M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/></svg>
                      <span v-if="gRes(room.id, day.dateStr)!.paymentStatus === 'paid'" class="flex items-center justify-center h-4 w-4 rounded-full bg-white shrink-0 ring-1 ring-black/10" :title="'Pago: pagada'">
                        <svg class="h-2.5 w-2.5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                      </span>
                      <span v-else-if="gRes(room.id, day.dateStr)!.paymentStatus === 'partial'" class="flex items-center justify-center h-4 w-4 rounded-full bg-gold shrink-0 ring-1 ring-white/70" :title="'Pago: parcial'">
                        <svg class="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2"/></svg>
                      </span>
                      <span>${{ gRes(room.id, day.dateStr)!.amt }}</span>
                    </span>
                  </div>

                  <!-- Block -->
                  <div v-if="gBlk(room.id, day.dateStr) && isBlkFirst(room.id, day.dateStr)"
                    class="absolute inset-y-1 left-0 rounded-md flex items-center gap-1.5 px-2 z-10 bg-gray-300/80 cursor-pointer hover:bg-gray-400/80"
                    :style="{ width: blkSpan(room.id, day) + 'px' }"
                    @mousedown.stop @click.stop="confirmUnblock(gBlk(room.id, day.dateStr)!)">
                    <svg class="h-3 w-3 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11V7a5 5 0 0 1 10 0v4M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/></svg>
                    <span class="text-[9px] font-bold text-gray-600 truncate">{{ gBlk(room.id, day.dateStr)!.reason || 'Bloqueo' }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Occupancy -->
            <div class="flex border-t-2 border-border bg-surface">
              <div class="w-56 flex-shrink-0 px-4 py-3 border-r border-border"><span class="text-xs font-black text-navy">Ocupación</span></div>
              <div v-for="day in visibleDays" :key="day.dateStr" class="flex-1 min-w-[68px] px-2 py-3 text-center border-r border-border">
                <span class="text-xs font-black" :class="dayOcc(day.dateStr) > 80 ? 'text-coral' : dayOcc(day.dateStr) > 50 ? 'text-gold' : 'text-teal'">{{ dayOcc(day.dateStr) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Popup (MisterPlan style: appears next to cell) -->
    <Teleport to="body">
      <div v-if="popup.show" class="fixed z-[100] min-w-[200px] rounded-xl border border-border bg-white py-1 shadow-2xl"
        :style="{ left: popup.x + 'px', top: popup.y + 'px' }">
        <div class="flex items-center justify-between border-b border-border px-3 py-2 text-[10px] font-bold uppercase text-text-muted">
          <span>{{ popup.room?.number }} · {{ popup.fromDate }}{{ popup.fromDate !== popup.toDate ? ' → ' + popup.toDate : '' }}
            <span v-if="popup.nights > 0" class="ml-1 text-navy">({{ popup.nights }}n)</span>
          </span>
          <button @click="closePopup" class="ml-3 flex h-5 w-5 items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-coral cursor-pointer">
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <button v-if="!popup.res && !popup.blk" @click="popupNewRes" class="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm font-bold text-navy hover:bg-surface">
          <svg class="h-4 w-4 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          Nueva Reserva
        </button>
        <button v-if="!popup.res && !popup.blk" @click="popupBlock" class="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm font-bold text-navy hover:bg-surface">
          <svg class="h-4 w-4 text-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11V7a5 5 0 0 1 10 0v4M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/></svg>
          Bloquear
        </button>
        <button v-if="!popup.res && !popup.blk" @click="popupQuote" class="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm font-bold text-navy hover:bg-surface">
          <svg class="h-4 w-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6M9 8h1M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/></svg>
          Cotización
        </button>
        <button v-if="popup.res" @click="popupViewRes" class="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm font-bold text-navy hover:bg-surface">
          <svg class="h-4 w-4 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0"/></svg>
          Ver Reserva
        </button>
        <button v-if="popup.res" @click="popupCheckin" class="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm font-bold text-teal hover:bg-surface">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H4.5"/></svg>
          Hacer Check-in
        </button>
        <button v-if="popup.res" @click="popupCancel" class="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm font-bold text-coral hover:bg-surface">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          Cancelar Reserva
        </button>
        <button v-if="popup.blk" @click="popupUnblock" class="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm font-bold text-coral hover:bg-surface">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M9.5 7V5.5a1 1 0 011-1h3a1 1 0 011 1V7m-8 0 .8 12a1 1 0 001 1h7.4a1 1 0 001-1L18 7"/></svg>
          Eliminar Bloqueo
        </button>
      </div>
    </Teleport>

    <!-- Block dialog -->
    <Teleport to="body">
      <Transition name="modal-fade">
      <div v-if="blockDlg.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="modal-panel relative w-full max-w-md rounded-[20px] bg-white p-6 shadow-2xl">
          <div class="mb-4 flex items-center gap-2.5">
            <span class="grid h-8 w-8 place-items-center rounded-xl bg-coral/10 text-coral">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11V7a5 5 0 0 1 10 0v4M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/></svg>
            </span>
            <h3 class="text-lg font-black text-navy">Bloquear</h3>
          </div>
          <div class="space-y-4">
            <div class="rounded-xl bg-surface p-3 text-sm font-bold text-navy">{{ blockDlg.room }} · {{ blockDlg.from }} → {{ blockDlg.to }}</div>
            <div><label class="mb-2 block text-[11px] font-bold uppercase text-navy">Motivo</label>
              <select v-model="blockDlg.reason" class="mb-2 w-full cursor-pointer rounded-xl border border-border px-4 py-2.5 text-sm">
                <option value="">Personalizado...</option><option value="Mantenimiento">Mantenimiento</option><option value="Reforma">Reforma</option><option value="Inventario">Inventario</option><option value="Reservado">Reservado</option>
              </select>
              <input v-if="blockDlg.reason === '' || blockDlg.reason === 'Personalizado...'" v-model="blockDlg.customReason" type="text" placeholder="Escribe el motivo..." class="w-full rounded-xl border border-border px-4 py-2.5 text-sm" />
            </div>
          </div>
          <div class="mt-6 flex gap-3">
            <button @click="blockDlg.show = false" class="flex-1 cursor-pointer rounded-xl border border-border py-2.5 text-sm font-bold text-text-secondary">Cancelar</button>
            <button @click="saveBlock" class="flex-1 cursor-pointer rounded-xl bg-navy py-2.5 text-sm font-bold text-white">Bloquear</button>
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>

    <!-- Unblock confirm -->
    <Teleport to="body">
      <Transition name="modal-fade">
      <div v-if="unblock.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="modal-panel relative w-full max-w-sm rounded-[20px] bg-white p-6 text-center shadow-2xl">
          <span class="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-coral/10 text-coral">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11V7a5 5 0 0 1 10 0v4M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/></svg>
          </span>
          <h3 class="mb-2 text-lg font-black text-navy">¿Desbloquear?</h3>
          <p class="text-sm text-text-secondary">{{ unblock.room }} — {{ unblock.reason }}</p>
          <p class="text-xs text-text-muted">{{ unblock.from }} → {{ unblock.to }}</p>
          <div class="mt-6 flex gap-3">
            <button @click="unblock.show = false" class="flex-1 cursor-pointer rounded-xl border border-border py-2.5 text-sm font-bold text-text-secondary">Cancelar</button>
            <button @click="doUnblock" class="flex-1 cursor-pointer rounded-xl bg-coral py-2.5 text-sm font-bold text-white">Desbloquear</button>
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>

    <!-- New reservation — modal completo -->
    <Teleport to="body">
      <Transition name="modal-fade">
      <div v-if="newRes.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="modal-panel relative bg-white rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="p-5 border-b border-border shrink-0 bg-gradient-to-r from-navy to-navy/90">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <h3 class="text-lg font-black text-white">Nueva Reserva</h3>
                <span class="flex items-center gap-1.5 text-xs text-white/60">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l8-4v18M13 21V9l6 3v9M9 9h.01M9 13h.01M9 17h.01"/></svg>
                  {{ newRes.room?.number }} — {{ newRes.room?.type }} · ${{ newRes.room?.basePrice }}/n
                </span>
              </div>
              <button @click="newRes.show=false" class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white cursor-pointer hover:bg-white/20">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <!-- Wizard progress -->
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-white">Paso {{ newResStep }} de {{ NEWRES_STEPS.length }}</span>
              <span class="text-xs font-bold text-white/60">{{ NEWRES_STEPS[newResStep - 1].label }}</span>
            </div>
            <div class="h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div class="h-full bg-white rounded-full transition-all" :style="{ width: (newResStep / NEWRES_STEPS.length * 100) + '%' }"></div>
            </div>
          </div>
          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-5 space-y-5">
            <!-- Paso 1: Cliente -->
            <template v-if="newResStep === 1">
              <div>
                <h4 class="text-xs font-black text-navy uppercase mb-3 flex items-center gap-2"><span class="w-5 h-5 rounded bg-navy/10 flex items-center justify-center text-navy"><svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0"/></svg></span> Cliente</h4>
                <div class="space-y-3">
                  <div>
                    <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Nombre completo <span class="text-coral">*</span></label><input v-model="newRes.name" type="text" placeholder="Nombre y apellido" class="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                  </div>
                  <div class="grid grid-cols-3 gap-3">
                    <div class="col-span-2"><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Email</label><input v-model="newRes.email" type="email" class="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" /></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Idioma</label><select v-model="newRes.language" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option>Español</option><option>English</option><option>Français</option><option>Português</option><option>Deutsch</option></select></div>
                  </div>
                  <div class="grid grid-cols-3 gap-3">
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">País</label><input v-model="newRes.country" type="text" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Nacionalidad</label><input v-model="newRes.nationality" type="text" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Teléfono</label><input v-model="newRes.phone" type="tel" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Sexo</label><select v-model="newRes.sex" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="">Seleccionar</option><option value="male">Masculino</option><option value="female">Femenino</option><option value="non_binary">No binario</option><option value="other">Otro</option></select></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Fecha nacimiento</label><input v-model="newRes.birthDate" type="date" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                  </div>
                  <div class="grid grid-cols-3 gap-3">
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Tipo documento</label><select v-model="newRes.documentType" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="dni">DNI / NIF</option><option value="passport">Pasaporte</option><option value="cedula">Cédula</option><option value="rif">RIF</option><option value="other">Otro</option></select></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">N° documento</label><input v-model="newRes.document" type="text" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Fecha expedición</label><input v-model="newRes.documentIssueDate" type="date" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                  </div>
                  <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Comunicar al cliente</label><select v-model="newRes.communicateClient" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="none">No enviar bono</option><option value="email_confirmation">Enviar email confirmación</option><option value="email_presaless">Enviar email preventa</option></select></div>
                  <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Observaciones</label><textarea v-model="newRes.guestNotes" rows="2" class="w-full px-3 py-2 rounded-xl border border-border text-sm resize-none"></textarea></div>
                </div>
              </div>
            </template>

            <!-- Paso 2: Dirección y Emergencia -->
            <template v-if="newResStep === 2">
              <div>
                <h4 class="text-xs font-black text-navy uppercase mb-3">Dirección</h4>
                <div class="space-y-3">
                  <div class="grid grid-cols-3 gap-3">
                    <div class="col-span-2"><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Dirección</label><input v-model="newRes.address" type="text" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Ciudad</label><input v-model="newRes.city" type="text" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                  </div>
                  <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Provincia</label><input v-model="newRes.province" type="text" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                </div>
              </div>
              <!-- Emergencia -->
              <div class="border border-coral/20 rounded-xl p-4 bg-coral/5">
                <h4 class="text-xs font-black text-coral uppercase mb-3 flex items-center gap-2"><span class="w-5 h-5 rounded bg-coral/20 flex items-center justify-center text-coral"><svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg></span> Contacto de Emergencia</h4>
                <div class="space-y-3">
                  <div class="grid grid-cols-2 gap-3">
                    <div class="col-span-2"><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Nombre completo</label><input v-model="newRes.emergencyName" type="text" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Teléfono</label><input v-model="newRes.emergencyPhone" type="tel" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Parentesco</label><select v-model="newRes.emergencyRelation" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="">Seleccionar</option><option>Familiar</option><option>Amigo/a</option><option>Empleado/a</option><option>Agente de viajes</option><option>Otro</option></select></div>
                  </div>
                  <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Email</label><input v-model="newRes.emergencyEmail" type="email" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                </div>
              </div>
            </template>

            <!-- Paso 3: Alojamiento -->
            <template v-if="newResStep === 3">
              <div>
                <h4 class="text-xs font-black text-navy uppercase mb-3 flex items-center gap-2"><span class="w-5 h-5 rounded bg-navy/10 flex items-center justify-center text-navy"><svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l8-4v18M13 21V9l6 3v9M9 9h.01M9 13h.01M9 17h.01"/></svg></span> Alojamiento</h4>
                <div class="bg-surface rounded-xl p-3 text-sm space-y-2 mb-3">
                  <div class="flex justify-between"><span class="text-text-secondary">Habitación</span><span class="font-bold text-navy">{{ newRes.room?.number }} — {{ newRes.room?.type }}</span></div>
                  <div class="flex justify-between"><span class="text-text-secondary">Fecha entrada</span><span class="font-bold text-navy">{{ newRes.cin }}</span></div>
                  <div class="flex justify-between"><span class="text-text-secondary">Fecha salida</span><span class="font-bold text-navy">{{ newRes.cout }}</span></div>
                  <div class="flex justify-between"><span class="text-text-secondary">Noches</span><span class="font-bold text-navy">{{ newResNights }}</span></div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Adultos</label><input v-model.number="newRes.adults" type="number" min="1" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                  <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Niños</label><input v-model.number="newRes.kids" type="number" min="0" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                </div>
                <div class="grid grid-cols-2 gap-3 mt-3">
                  <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Régimen</label><select v-model="newRes.regime" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="room_only">Solo alojamiento</option><option value="breakfast">Desayuno incluido</option><option value="half_board">Media pensión</option><option value="full_board">Pensión completa</option><option value="all_inclusive">Todo incluido</option></select></div>
                  <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Canal</label><select v-model="newRes.ch" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="direct">Directa</option><option value="booking">Booking</option><option value="expedia">Expedia</option><option value="airbnb">Airbnb</option><option value="google">Google</option><option value="whatsapp">WhatsApp</option></select></div>
                </div>
                <div v-if="newRes.room" class="bg-white rounded-xl p-3 mt-3 space-y-1.5 border border-border text-sm">
                  <div class="flex justify-between"><span class="text-text-secondary">{{ newResNights }}n × ${{ newRes.room.basePrice }}</span><span class="font-bold">${{ newRes.room.basePrice * newResNights }}</span></div>
                  <div class="flex justify-between"><span class="text-text-secondary">Impuestos (10%)</span><span class="font-bold">${{ Math.round(newRes.room.basePrice * newResNights * 0.1) }}</span></div>
                </div>
              </div>
              <!-- OTA -->
              <div v-if="newRes.ch!=='direct'" class="border border-border rounded-xl p-4 bg-surface/50">
                <h4 class="text-xs font-black text-navy uppercase mb-3 flex items-center gap-2"><span class="w-5 h-5 rounded bg-navy/10 flex items-center justify-center text-navy"><svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 000 18M12.5 3a17 17 0 010 18"/></svg></span> Datos del Canal</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Comisión (%)</label><input v-model.number="newRes.commission" type="number" min="0" max="50" class="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
                  <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Locator OTA</label><input v-model="newRes.extLocator" type="text" class="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
                </div>
              </div>
            </template>

            <!-- Paso 4: Pago -->
            <template v-if="newResStep === 4">
              <div class="border border-purple/20 rounded-xl p-4 bg-purple/5">
                <h4 class="text-xs font-black text-purple uppercase mb-3 flex items-center gap-2"><span class="w-5 h-5 rounded bg-purple/20 flex items-center justify-center text-purple"><svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 6.75h19.5A1.5 1.5 0 0123.25 8.25v9a1.5 1.5 0 01-1.5 1.5H2.25a1.5 1.5 0 01-1.5-1.5v-9a1.5 1.5 0 011.5-1.5zM6 15h3"/></svg></span> Tarjeta de Crédito/Débito</h4>
                <div class="space-y-3">
                  <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Titular</label><input v-model="newRes.cardHolder" type="text" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                  <div class="grid grid-cols-3 gap-3">
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Tipo</label><select v-model="newRes.cardBrand" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="visa">Visa</option><option value="mastercard">Mastercard</option><option value="amex">Amex</option><option value="other">Otra</option></select></div>
                    <div class="col-span-2"><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">N° tarjeta</label><input v-model="newRes.cardNumber" type="text" maxlength="19" placeholder="XXXX XXXX XXXX XXXX" class="w-full px-3 py-2 rounded-xl border border-border text-sm font-mono" /></div>
                  </div>
                  <div class="grid grid-cols-3 gap-3">
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">CVV</label><input v-model="newRes.cardCvv" type="text" maxlength="4" class="w-full px-3 py-2 rounded-xl border border-border text-sm font-mono" /></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Mes</label><select v-model="newRes.cardExpMonth" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="">Mes</option><option v-for="m in ['01','02','03','04','05','06','07','08','09','10','11','12']" :key="m" :value="m">{{ m }}</option></select></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Año</label><select v-model="newRes.cardExpYear" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="">Año</option><option v-for="y in 10" :key="y" :value="new Date().getFullYear()+y-1">{{ new Date().getFullYear()+y-1 }}</option></select></div>
                  </div>
                </div>
              </div>
              <div class="border border-teal/20 rounded-xl p-4 bg-teal/5">
                <h4 class="text-xs font-black text-teal uppercase mb-3 flex items-center gap-2"><span class="w-5 h-5 rounded bg-teal/20 flex items-center justify-center text-teal"><svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></span> Anticipo y Total</h4>
                <div class="space-y-3">
                  <div class="grid grid-cols-2 gap-3">
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Anticipo (%)</label><input v-model.number="newRes.depositPercentage" type="number" min="0" max="100" @input="newRes.deposit = Math.round(newRes.amt * (newRes.depositPercentage||0) / 100)" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Monto ($)</label><input v-model.number="newRes.deposit" type="number" min="0" class="w-full px-3 py-2 rounded-xl border border-border text-sm font-bold text-navy" /></div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Estado</label><select v-model="newRes.depositStatus" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="unpaid">Sin pagar</option><option value="partial">Parcial</option><option value="paid">Pagado</option></select></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Pago con</label><select v-model="newRes.payMethod" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="cash">Efectivo</option><option value="link">Link de pago</option></select></div>
                  </div>
                  <div class="bg-white rounded-xl p-3 space-y-1.5 border border-border">
                    <div class="flex justify-between text-sm"><span class="text-text-secondary">Precio final</span><span class="font-extrabold text-navy text-lg">${{ newRes.amt }}</span></div>
                    <div v-if="newRes.amt > 0" class="flex justify-between text-sm"><span class="text-text-secondary">Pendiente</span><span class="font-black" :class="newRes.amt - newRes.deposit > 0 ? 'text-coral' : 'text-teal'">${{ newRes.amt - newRes.deposit }}</span></div>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <!-- Footer -->
          <div class="p-4 border-t border-border bg-surface/80 shrink-0 flex items-center justify-between">
            <div class="text-sm font-extrabold text-navy">Total: <span class="text-lg">${{ newRes.amt }}</span></div>
            <div class="flex gap-3">
              <button v-if="newResStep === 1" @click="newRes.show=false" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
              <button v-else @click="prevNewResStep" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Atrás</button>
              <button v-if="newResStep < NEWRES_STEPS.length" @click="nextNewResStep" class="px-6 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-navy-light">Siguiente</button>
              <button v-else @click="saveNewRes" class="px-6 py-2.5 bg-teal text-white rounded-xl text-sm font-black cursor-pointer hover:opacity-90">Crear Reserva</button>
            </div>
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>

    <!-- Quote / Cotización Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
      <div v-if="quote.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm no-print"></div>
        <div class="modal-panel relative bg-white rounded-[20px] w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4 no-print">
            <h3 class="flex items-center gap-2.5 text-lg font-black text-navy">
              <span class="grid h-8 w-8 place-items-center rounded-xl bg-gold/10 text-gold">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6M9 8h1M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/></svg>
              </span>
              Cotización
            </h3>
            <button @click="quote.show = false" class="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-coral cursor-pointer">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- PRINT VIEW -->
          <div class="print-only">
            <div class="text-center mb-6">
              <h2 class="text-2xl font-black" style="color:#1a2b4c">{{ quote.hotel }}</h2>
              <p class="text-sm" style="color:#6b7280">{{ quote.hotelAddress }}</p>
              <p class="text-sm" style="color:#6b7280">{{ quote.hotelPhone }} · {{ quote.hotelEmail }}</p>
              <div style="border-bottom:2px solid #1a2b4c;width:120px;margin:16px auto 0"></div>
              <h3 class="text-lg font-black mt-4" style="color:#1a2b4c">COTIZACIÓN / PROFORMA</h3>
              <p class="text-xs" style="color:#6b7280">Nº {{ quote.id }} · {{ quote.today }}</p>
            </div>
            <div class="mb-4">
              <h4 class="text-xs font-bold uppercase mb-2" style="color:#1a2b4c">Datos del Cliente</h4>
              <p class="text-sm font-bold" style="color:#1a2b4c">{{ quote.guest || '—' }}</p>
              <p class="text-xs" style="color:#6b7280" v-if="quote.email || quote.phone">{{ quote.email }}{{ quote.email && quote.phone ? ' · ' : '' }}{{ quote.phone }}</p>
            </div>
            <table style="width:100%;font-size:12px;margin-bottom:16px;border-collapse:collapse">
              <thead><tr style="border-bottom:2px solid #1a2b4c"><th style="text-align:left;padding:8px 0;font-size:10px;text-transform:uppercase;color:#6b7280">Habitación</th><th style="text-align:center;padding:8px 0;font-size:10px;text-transform:uppercase;color:#6b7280">Cant.</th><th style="text-align:right;padding:8px 0;font-size:10px;text-transform:uppercase;color:#6b7280">Precio/n</th><th style="text-align:right;padding:8px 0;font-size:10px;text-transform:uppercase;color:#6b7280">Subtotal</th></tr></thead>
              <tbody>
                <tr v-for="(item, i) in quote.rooms" :key="i" style="border-bottom:1px solid #e5e7eb">
                  <td style="padding:8px 0;font-weight:700;color:#1a2b4c">{{ item.type }}</td><td style="padding:8px 0;text-align:center">{{ item.qty }}</td><td style="padding:8px 0;text-align:right">${{ item.price }}</td><td style="padding:8px 0;text-align:right;font-weight:700">${{ item.qty * item.price * quote.nights }}</td>
                </tr>
              </tbody>
            </table>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:16px">
              <div><span style="color:#6b7280">Check-in:</span> <strong>{{ quote.checkIn }}</strong></div>
              <div><span style="color:#6b7280">Check-out:</span> <strong>{{ quote.checkOut }}</strong></div>
              <div><span style="color:#6b7280">Noches:</span> <strong>{{ quote.nights }}</strong></div>
              <div><span style="color:#6b7280">Huéspedes:</span> <strong>{{ quote.adults }} adultos, {{ quote.kids }} niños</strong></div>
            </div>
            <div style="border-top:2px solid #1a2b4c;padding-top:12px;font-size:12px">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Subtotal</span><strong>${{ quoteSubtotal }}</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>{{ quote.taxName }} ({{ quote.taxRate }}%)</span><strong>${{ Math.round(quoteSubtotal * quote.taxRate / 100) }}</strong></div>
              <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:900;border-top:2px solid #1a2b4c;padding-top:8px;margin-top:8px"><span>TOTAL</span><span>${{ quoteSubtotal + Math.round(quoteSubtotal * quote.taxRate / 100) }}</span></div>
            </div>
            <div v-if="quote.notes" style="margin-top:16px;font-size:10px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px">
              <p style="font-weight:700;color:#1a2b4c;margin-bottom:4px">Notas:</p>
              <p>{{ quote.notes }}</p>
            </div>
            <p style="font-size:9px;color:#9ca3af;text-align:center;margin-top:24px">Documento informativo · No válido como factura fiscal</p>
          </div>

          <!-- EDIT FORM -->
          <div class="screen-only">
          <!-- Datos del Cliente -->
          <div class="mb-4">
            <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Datos del Cliente</label>
            <div class="grid grid-cols-2 gap-3">
              <div class="col-span-2">
                <input v-model="quote.guest" type="text" placeholder="Nombre completo" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" />
              </div>
              <div>
                <input v-model="quote.email" type="email" placeholder="Email" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" />
              </div>
              <div>
                <input v-model="quote.phone" type="tel" placeholder="Teléfono" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" />
              </div>
            </div>
          </div>
          <!-- Detalle de Reserva -->
          <div class="mb-4">
            <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Habitaciones</label>
            <div class="bg-surface rounded-xl p-4 space-y-2 text-sm">
              <div v-for="(item, i) in quote.rooms" :key="i" class="flex items-center gap-2">
                <select v-model="item.type" @change="onQuoteRoomTypeChange(i)" class="flex-1 px-3 py-2 rounded-lg border border-border text-xs cursor-pointer">
                  <option v-for="rt in quoteRoomTypes" :key="rt" :value="rt">{{ rt }}</option>
                </select>
                <div class="flex items-center gap-1">
                  <span class="text-xs text-text-muted">×</span>
                  <input v-model.number="item.qty" type="number" min="1" max="20" class="w-12 px-2 py-2 rounded-lg border border-border text-xs font-bold text-navy text-center" />
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-xs text-text-muted">$</span>
                  <input v-model.number="item.price" type="number" min="0" class="w-20 px-2 py-2 rounded-lg border border-border text-xs font-bold text-navy text-right" />
                  <span class="text-[10px] text-text-muted">/n</span>
                </div>
                <button @click="quote.rooms.splice(i, 1)" v-if="quote.rooms.length > 1" class="text-coral text-xs font-bold cursor-pointer hover:underline">✕</button>
              </div>
              <button @click="addQuoteRoom"
                class="text-xs font-bold text-teal hover:underline cursor-pointer">+ Agregar habitación</button>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-2 text-sm">
              <div class="bg-surface rounded-xl p-3 flex justify-between"><span class="text-text-secondary">Check-in</span><span class="font-bold">{{ quote.checkIn }}</span></div>
              <div class="bg-surface rounded-xl p-3 flex justify-between"><span class="text-text-secondary">Check-out</span><span class="font-bold">{{ quote.checkOut }}</span></div>
            </div>
            <div class="grid grid-cols-3 gap-2 mt-2 text-sm">
              <div class="bg-surface rounded-xl p-3 flex justify-between"><span class="text-text-secondary">Noches</span><span class="font-bold">{{ quote.nights }}</span></div>
              <div class="bg-surface rounded-xl p-3 flex justify-between items-center"><span class="text-text-secondary">Adultos</span><input v-model.number="quote.adults" type="number" min="1" max="10" class="w-12 px-2 py-1 rounded-lg border border-border text-xs font-bold text-navy text-right" /></div>
              <div class="bg-surface rounded-xl p-3 flex justify-between items-center"><span class="text-text-secondary">Niños</span><input v-model.number="quote.kids" type="number" min="0" max="10" class="w-12 px-2 py-1 rounded-lg border border-border text-xs font-bold text-navy text-right" /></div>
            </div>
          </div>
          <!-- Precios -->
          <div class="mb-4">
            <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Precios</label>
            <div class="bg-surface rounded-xl p-4 space-y-2 text-sm">
              <div v-for="(item, i) in quote.rooms" :key="'p'+i" class="flex justify-between">
                <span class="text-text-secondary">{{ item.type }} ×{{ item.qty }} ({{ quote.nights }}n × ${{ item.price }})</span>
                <span class="font-bold">${{ item.qty * item.price * quote.nights }}</span>
              </div>
              <div class="flex justify-between border-t border-border pt-2">
                <span class="text-text-secondary">Subtotal</span>
                <span class="font-bold">${{ quoteSubtotal }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-text-secondary">Impuesto</span>
                <div class="flex items-center gap-1">
                  <input v-model="quote.taxName" type="text" class="w-12 px-2 py-1 rounded-lg border border-border text-[10px] font-bold text-navy" />
                  <input v-model.number="quote.taxRate" type="number" min="0" max="100" class="w-12 px-2 py-1 rounded-lg border border-border text-xs font-bold text-navy text-right" />
                  <span class="text-xs">%</span>
                </div>
              </div>
              <div class="flex justify-between"><span class="text-text-secondary">Impuesto calculado</span><span class="font-bold">${{ Math.round(quoteSubtotal * quote.taxRate / 100) }}</span></div>
              <div class="border-t border-border pt-2 flex justify-between">
                <span class="font-extrabold text-navy">Total</span>
                <span class="font-extrabold text-navy text-lg">${{ quoteSubtotal + Math.round(quoteSubtotal * quote.taxRate / 100) }}</span>
              </div>
            </div>
          </div>
          <!-- Notas -->
          <div class="mb-4">
            <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Notas</label>
            <textarea v-model="quote.notes" rows="2" placeholder="Condiciones, políticas de cancelación..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm resize-none"></textarea>
          </div>
          </div><!-- end screen-only -->
          <div class="flex gap-3">
            <button @click="quote.show = false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer no-print">Cerrar</button>
            <button @click="printQuote" class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer no-print">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.32 0h1.093c1.06 0 1.98-.716 2.005-1.775a72.323 72.323 0 000-3.454c-.025-1.059-.945-1.775-2.005-1.775H5.25c-1.06 0-1.98.716-2.005 1.775a72.297 72.297 0 000 3.454c.025 1.059.945 1.775 2.005 1.775H6.34m10.94 0H6.34m0 0v-4.5a2.25 2.25 0 012.25-2.25h6.5a2.25 2.25 0 012.25 2.25v4.5"/></svg>
              Imprimir
            </button>
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>

    <!-- Reservation detail — ReservationModal (F3 match-misterplan) -->
    <ReservationModal
      v-if="detailId"
      :reservation-id="detailId"
      @close="detailId = null"
      @edit="onEditFromPlanning"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { OperationsService } from '@/services/Operations.service'
import { ReservationService, STATUS_MAP } from '@/services/Reservation.service'
import { GuestService } from '@/services/Guest.service'
import { HotelService } from '@/services/Hotel.service'
import { http } from '@/services/http'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import ReservationModal from '@/components/features/ReservationModal.vue'
import { useRouter } from 'vue-router'
import { getChannelBrand } from '@/composables/useChannelBrand'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const hid = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

type DI = { dateStr: string; dayName: string; dayNum: number; monthShort: string; isToday: boolean; isWeekend: boolean; date: Date }

const MS_PER_DAY = 86_400_000

const viewDays = ref(14)
const weekOffset = ref(0)
const planRooms = ref<any[]>([])
const planReservas = ref<any[]>([])
const planBlocks = ref<any[]>([])
const typeFilter = ref<Set<string>>(new Set())
const hotelInfo = ref<{ name: string; address: string; phone: string; email: string }>({ name: '', address: '', phone: '', email: '' })

// Drag state
const isDragging = ref(false)
const dragRoom = ref<any>(null)
const dragStart = ref('')
const dragEnd = ref('')
let dragStarted = false

// Last selection (persists until dismissed)
const lastSel = ref<{ room: any; from: string; to: string } | null>(null)

// Popups
const popup = ref<{ show: boolean; x: number; y: number; room: any; fromDate: string; toDate: string; nights: number; res: any; blk: any }>({ show: false, x: 0, y: 0, room: null, fromDate: '', toDate: '', nights: 0, res: null, blk: null })
const blockDlg = ref<{ show: boolean; room: string; from: string; to: string; reason: string; customReason: string; rid: string }>({ show: false, room: '', from: '', to: '', reason: '', customReason: '', rid: '' })
const unblock = ref<{ show: boolean; id: string; room: string; reason: string; from: string; to: string }>({ show: false, id: '', room: '', reason: '', from: '', to: '' })
const detailId = ref<string | null>(null)
const newRes = ref({
  show: false, room: null as any, cin: '', cout: '',
  // Cliente (naming canónico guests)
  name: '', email: '', phone: '',
  language: 'Español', country: 'República Dominicana', nationality: 'Dominicana',
  address: '', city: '', province: '',
  sex: '', birthDate: '',
  documentType: 'dni', document: '', documentIssueDate: '',
  communicateClient: 'none', guestNotes: '',
  // Contacto emergencia
  emergencyName: '', emergencyPhone: '', emergencyRelation: '', emergencyEmail: '',
  // Alojamiento
  adults: 2, kids: 0, regime: 'room_only', promoCode: '',
  // Canal
  ch: 'direct', commission: 0, extLocator: '', otaNotes: '',
  // Tarjeta
  cardHolder: '', cardBrand: 'visa', cardNumber: '', cardCvv: '', cardExpMonth: '', cardExpYear: '',
  // Pago
  payMethod: 'transfer', deposit: 0, depositPercentage: 100, depositStatus: 'unpaid',
  // Total
  amt: 0,
})
const newResStep = ref(1)
const NEWRES_STEPS = [
  { n: 1, label: 'Cliente' },
  { n: 2, label: 'Dirección y Emergencia' },
  { n: 3, label: 'Alojamiento' },
  { n: 4, label: 'Pago' },
]
function nextNewResStep() {
  if (newResStep.value === 1 && !newRes.value.name?.trim()) {
    toast.error('Falta el nombre del huésped')
    return
  }
  newResStep.value = Math.min(newResStep.value + 1, NEWRES_STEPS.length)
}
function prevNewResStep() {
  newResStep.value = Math.max(newResStep.value - 1, 1)
}
const quote = ref<{ show: boolean; id: string; today: string; hotel: string; hotelAddress: string; hotelPhone: string; hotelEmail: string; rooms: { type: string; qty: number; price: number }[]; checkIn: string; checkOut: string; nights: number; guest: string; email: string; phone: string; adults: number; kids: number; taxName: string; taxRate: number; notes: string }>({ show: false, id: '', today: '', hotel: '', hotelAddress: '', hotelPhone: '', hotelEmail: '', rooms: [{ type: 'Standard', qty: 1, price: 100 }], checkIn: '', checkOut: '', nights: 0, guest: '', email: '', phone: '', adults: 1, kids: 0, taxName: 'ITBIS', taxRate: 18, notes: '' })
const quoteSubtotal = computed(() => quote.value.rooms.reduce((s, r) => s + r.qty * r.price * quote.value.nights, 0))
const quoteRoomTypes = computed(() => {
  const types = new Set<string>()
  for (const r of planRooms.value) types.add((r.type || 'double').charAt(0).toUpperCase() + (r.type || 'double').slice(1))
  if (types.size === 0) return ['Standard', 'Double', 'Suite', 'Family']
  return Array.from(types)
})

const newResNights = computed(() => {
  if (!newRes.value.cin || !newRes.value.cout) return 0
  return Math.max(1, Math.round((new Date(newRes.value.cout).getTime() - new Date(newRes.value.cin).getTime()) / MS_PER_DAY))
})

// Channels
const CH: Record<string, any> = {
  direct: { l: 'Directa', bg: 'bg-teal', b: 'bg-teal/10 text-teal' }, directa: { l: 'Directa', bg: 'bg-teal', b: 'bg-teal/10 text-teal' },
  booking: { l: 'Booking', bg: 'bg-cyan', b: 'bg-cyan/10 text-cyan' }, 'booking.com': { l: 'Booking', bg: 'bg-cyan', b: 'bg-cyan/10 text-cyan' },
  expedia: { l: 'Expedia', bg: 'bg-gold', b: 'bg-gold/10 text-gold' }, airbnb: { l: 'Airbnb', bg: 'bg-coral', b: 'bg-coral/10 text-coral' },
  google: { l: 'Google', bg: 'bg-blue-500', b: 'bg-blue-100 text-blue-700' },
  whatsapp: { l: 'WhatsApp', bg: 'bg-emerald-500', b: 'bg-emerald-100 text-emerald-700' },
  phone: { l: 'Teléfono', bg: 'bg-gray-500', b: 'bg-gray-100 text-gray-600' },
}
const ST: Record<string, any> = {
  pending: { l: 'Pendiente', b: 'bg-gold/10 text-gold' }, confirmed: { l: 'Confirmada', b: 'bg-teal/10 text-teal' },
  checked_in: { l: 'Check-in', b: 'bg-cyan/10 text-cyan' }, checked_out: { l: 'Check-out', b: 'bg-gray-100 text-gray-500' },
  cancelled: { l: 'Cancelada', b: 'bg-coral/10 text-coral' },
}
const detectedChannels = computed(() => {
  const seen = new Set<string>(); const l: any[] = []
  for (const r of planReservas.value) {
    const k = (r.channel || 'direct').toLowerCase()
    const c = CH[k] || { l: r.channel || k, bg: 'bg-gray-400' }
    if (seen.has(c.l)) continue
    seen.add(c.l)
    l.push({ ...c, key: k, text: c.bg.replace('bg-', 'text-') })
  }
  return l
})

// Calendar
const baseDate = new Date()
const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
function fDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const visibleDays = computed<DI[]>(() => {
  const r: DI[] = []; const s = new Date(baseDate); s.setDate(s.getDate() + weekOffset.value * 7); const ts = fDate(new Date())
  for (let i = 0; i < viewDays.value; i++) { const d = new Date(s); d.setDate(d.getDate() + i); const ds = fDate(d); const dw = d.getDay(); r.push({ dateStr: ds, dayName: days[dw], dayNum: d.getDate(), monthShort: months[d.getMonth()], isToday: ds === ts, isWeekend: dw === 0 || dw === 6, date: d }) }
  return r
})
const weekLabel = computed(() => { if (!visibleDays.value.length) return ''; const f = visibleDays.value[0], l = visibleDays.value[visibleDays.value.length - 1]; return `${f.dayNum} ${f.monthShort} — ${l.dayNum} ${l.monthShort}, ${l.date.getFullYear()}` })

// Rooms
const DOT: Record<string, string> = { single: 'bg-teal', simple: 'bg-teal', double: 'bg-cyan', doble: 'bg-cyan', suite: 'bg-gold', family: 'bg-purple', familiar: 'bg-purple' }
const roomTypes = computed(() => {
  const g: Record<string, any[]> = {}
  for (const r of planRooms.value) { const t = r.type ?? 'double'; if (!g[t]) g[t] = []; g[t].push({ id: r.id, number: r.number, type: r.type, status: r.status }) }
  return Object.entries(g).map(([t, rooms]) => ({ type: t.charAt(0).toUpperCase() + t.slice(1), dot: DOT[t.toLowerCase()] ?? 'bg-cyan', occupied: rooms.filter((r: any) => r.status === 'occupied').length, rooms }))
})
const filteredRoomTypes = computed(() => {
  if (typeFilter.value.size === 0) return roomTypes.value
  return roomTypes.value.filter(rt => typeFilter.value.has(rt.type))
})
function toggleTypeFilter(type: string) {
  const s = new Set(typeFilter.value)
  s.has(type) ? s.delete(type) : s.add(type)
  typeFilter.value = s
}

// Data access
const colorMode = ref<'channel' | 'status'>('channel')
const ST_COLOR: Record<string, string> = {
  pending: 'bg-amber-500', confirmed: 'bg-cyan', checked_in: 'bg-teal',
  checked_out: 'bg-purple', cancelled: 'bg-coral',
}
const PAY_METHODS: readonly { v: string; l: string }[] = [
  { v: 'cash', l: 'Efectivo' },
  { v: 'card', l: 'Tarjeta' },
  { v: 'transfer', l: 'Transferencia' },
  { v: 'payment_link', l: 'Link de pago' },
]

function gRes(rid: any, ds: string) {
  const r = planReservas.value.find((b: any) => String(b.roomId) === String(rid) && ds >= String(b.checkIn||'').slice(0,10) && ds < String(b.checkOut||'').slice(0,10))
  if (!r) return null
  const ch = (r.channel || 'direct').toLowerCase(); const cc = CH[ch] || { l: r.channel || 'Directa', bg: 'bg-gray-400' }
  const status = STATUS_MAP[(r.status || '').toLowerCase()] || 'pending'
  return {
    id: r.id, name: r.guestName || 'Guest', ch: cc.l, chKey: ch,
    bg: colorMode.value === 'status' ? (ST_COLOR[status] || 'bg-gray-400') : cc.bg,
    amt: r.totalAmount || 0,
    status,
    lockCode: r.lockCode || '',
    paymentStatus: r.paymentStatus || 'pending',
  }
}
function isResFirst(rid: any, ds: string) {
  // Find the reservation for this room and date
  const res = gRes(rid, ds)
  if (!res) return false
  // The block renders on the earliest VISIBLE date that falls within the reservation
  const orig = planReservas.value.find((b: any) => b.id === res.id)
  if (!orig) return false
  const ci = String(orig.checkIn || '').slice(0, 10)
  const firstVisible = visibleDays.value[0]?.dateStr
  // Use the later of checkIn date and first visible date
  const renderDate = ci > (firstVisible || '') ? ci : (firstVisible || ci)
  return ds === renderDate
}
function resSpan(rid: any, day: DI) {
  const res = gRes(rid, day.dateStr)
  if (!res) return 68
  const orig = planReservas.value.find((b: any) => b.id === res.id)
  if (!orig) return 68
  const ci = String(orig.checkIn || '').slice(0, 10)
  const co = String(orig.checkOut || '').slice(0, 10)
  const firstVisible = visibleDays.value[0]?.dateStr
  const startDate = ci > (firstVisible || '') ? ci : (firstVisible || ci)
  const si = visibleDays.value.findIndex(d => d.dateStr === startDate)
  const ei = visibleDays.value.findIndex(d => d.dateStr === co)
  return Math.max(1, (ei >= 0 ? ei : viewDays.value) - (si >= 0 ? si : 0)) * 68
}
function gBlk(rid: any, ds: string) { return planBlocks.value.find((b: any) => String(b.roomId) === String(rid) && ds >= b.startDate && ds <= b.endDate) || null }
function isBlkFirst(rid: any, ds: string) { return planBlocks.value.some((b: any) => String(b.roomId) === String(rid) && b.startDate === ds) }
function blkSpan(rid: any, day: DI) {
  const b = planBlocks.value.find((b: any) => String(b.roomId) === String(rid) && b.startDate === day.dateStr)
  if (!b) return 68; const si = visibleDays.value.findIndex(d => d.dateStr === b.startDate); const ei = visibleDays.value.findIndex(d => d.dateStr === b.endDate)
  return Math.max(1, (ei >= 0 ? ei : viewDays.value) - (si >= 0 ? si : 0) + 1) * 68
}
function dayOcc(ds: string) {
  const n = planRooms.value.length; if (!n) return 0; const o = new Set<string>()
  planReservas.value.forEach((b: any) => { if (ds >= String(b.checkIn||'').slice(0,10) && ds < String(b.checkOut||'').slice(0,10)) o.add(String(b.roomId)) })
  planBlocks.value.forEach((b: any) => { if (ds >= b.startDate && ds <= b.endDate) o.add(String(b.roomId)) })
  return Math.round((o.size / n) * 100)
}

// Drag range check
function isInRange(rid: string, ds: string) {
  // During active drag
  if (isDragging.value && String(dragRoom.value?.id) === rid) {
    const s = dragStart.value; const e = dragEnd.value
    return ds >= (s < e ? s : e) && ds <= (s < e ? e : s)
  }
  // Persisted selection
  if (lastSel.value && String(lastSel.value.room?.id) === rid) {
    const s = lastSel.value.from; const e = lastSel.value.to
    return ds >= (s < e ? s : e) && ds <= (s < e ? e : s)
  }
  return false
}

// Mouse events
function onMouseDown(room: any, day: DI, e: MouseEvent) {
  popup.value.show = false
  lastSel.value = null
  const res = gRes(room.id, day.dateStr)
  const blk = gBlk(room.id, day.dateStr)
  if (res || blk) { showPopup(e, room, day, res, blk); return }

  isDragging.value = true
  dragStarted = false
  dragRoom.value = room
  dragStart.value = day.dateStr
  dragEnd.value = day.dateStr
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  const el = document.elementFromPoint(e.clientX, e.clientY)
  if (!el) return
  const cell = (el as HTMLElement).closest('[data-rid]') as HTMLElement | null
  if (!cell) return
  const rid = cell.dataset.rid; const date = cell.dataset.date
  if (!rid || !date || String(rid) !== String(dragRoom.value?.id)) return

  if (date !== dragStart.value) dragStarted = true
  dragEnd.value = date
}

function onMouseUp(ev: MouseEvent) {
  if (!isDragging.value) return
  isDragging.value = false

  const room = dragRoom.value
  const s = dragStart.value; const end = dragEnd.value
  const [from, to] = s <= end ? [s, end] : [end, s]

  dragRoom.value = null; dragStart.value = ''; dragEnd.value = ''

  if (room && (dragStarted || from !== to)) {
    // Keep selection visible
    lastSel.value = { room, from, to }
    const nights = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / MS_PER_DAY))
    popup.value = { show: true, x: Math.min(ev.clientX, window.innerWidth - 210), y: Math.min(ev.clientY + 5, window.innerHeight - 180), room, fromDate: from, toDate: to, nights, res: null, blk: null }
  } else if (room && !dragStarted) {
    lastSel.value = { room, from, to }
    popup.value = { show: true, x: Math.min(ev.clientX, window.innerWidth - 210), y: Math.min(ev.clientY + 5, window.innerHeight - 180), room, fromDate: from, toDate: from, nights: 1, res: null, blk: null }
  }
}

function showPopup(e: MouseEvent, room: any, day: DI, res: any, blk: any) {
  lastSel.value = null
  const from = day.dateStr; const to = day.dateStr
  popup.value = { show: true, x: Math.min(e.clientX, window.innerWidth - 210), y: Math.min(e.clientY + 5, window.innerHeight - 180), room, fromDate: from, toDate: to, nights: 1, res, blk }
}

// Detalle (F3): clic en bloque → ReservationModal (vista lectura). Editar → reservations con ?edit=.
function viewResDetail(rb: any) {
  detailId.value = rb.id
}

function onEditFromPlanning(d: { id: string }) {
  detailId.value = null
  router.push({ path: '/panel/reservations', query: { edit: d.id } })
}

/** Context menu (right-click) sobre una reserva existente */
function openContext(ev: MouseEvent, rb: any, room: any) {
  const orig = planReservas.value.find((b: any) => b.id === rb.id)
  if (!orig) return
  const ci = String(orig.checkIn || '').slice(0, 10)
  const co = String(orig.checkOut || '').slice(0, 10)
  popup.value = {
    show: true,
    x: Math.min(ev.clientX, window.innerWidth - 210),
    y: Math.min(ev.clientY, window.innerHeight - 220),
    room,
    fromDate: ci, toDate: co, nights: Math.max(1, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / MS_PER_DAY)),
    res: orig, blk: null,
  }
}
let draggedResId: string | null = null
function onResDrag(e: DragEvent, rb: any) { draggedResId = rb.id; e.dataTransfer!.effectAllowed = 'move' }
async function onResDrop(room: any) {
  if (!draggedResId) return
  const r = planReservas.value.find((x: any) => x.id === draggedResId)
  if (!r || String(r.roomId) === String(room.id)) { draggedResId = null; return }
  try { await ReservationService.update(draggedResId, { roomId: room.id } as any); r.roomId = room.id; r.roomNumber = room.number; toast.success(`Movida a Hab. ${room.number}`) }
  catch { toast.error('Error') }
  draggedResId = null
}

// Popup actions
function closePopup() { popup.value.show = false; lastSel.value = null }
async function popupCheckin() {
  const res = popup.value.res
  if (!res) return
  try {
    await ReservationService.checkin(res.id)
    res.status = 'checked_in'
    const room = planRooms.value.find((r: any) => String(r.id) === String(res.roomId))
    if (room) room.status = 'occupied'
    toast.success(`Check-in: ${res.guestName}`)
    closePopup()
  } catch { toast.error('Error') }
}
async function popupCancel() {
  const res = popup.value.res
  if (!res) return
  try {
    await ReservationService.update(res.id, { status: 'cancelled' } as any)
    res.status = 'cancelled'
    planReservas.value = planReservas.value.filter((r: any) => r.id !== res.id)
    toast.success(`Reserva cancelada`)
    closePopup()
  } catch { toast.error('Error') }
}
function popupNewRes() {
  const p = popup.value
  lastSel.value = null
  newResStep.value = 1
  const roomData = planRooms.value.find((r: any) => r.id === p.room?.id)
  const nights = Math.max(1, Math.round((new Date(p.toDate).getTime() - new Date(p.fromDate).getTime()) / MS_PER_DAY))
  const basePrice = roomData?.basePrice || 0
  const subtotal = basePrice * nights
  const taxes = Math.round(subtotal * 0.1)
  newRes.value = {
    show: true, room: roomData || p.room, cin: p.fromDate, cout: p.toDate,
    name: '', email: '', phone: '',
    language: 'Español', country: 'República Dominicana', nationality: 'Dominicana',
    address: '', city: '', province: '',
    sex: '', birthDate: '',
    documentType: 'dni', document: '', documentIssueDate: '',
    communicateClient: 'none', guestNotes: '',
    emergencyName: '', emergencyPhone: '', emergencyRelation: '', emergencyEmail: '',
    adults: 2, kids: 0, regime: 'room_only', promoCode: '',
    ch: 'direct', commission: 0, extLocator: '', otaNotes: '',
    cardHolder: '', cardBrand: 'visa', cardNumber: '', cardCvv: '', cardExpMonth: '', cardExpYear: '',
    payMethod: 'transfer', deposit: 0, depositPercentage: 100, depositStatus: 'unpaid',
    amt: subtotal + taxes,
  }
  popup.value.show = false
}
function popupQuote() {
  const p = popup.value
  lastSel.value = null
  const room = p.room
  const roomData = planRooms.value.find((r: any) => r.id === room?.id)
  const roomType = (roomData?.type || 'Standard').charAt(0).toUpperCase() + (roomData?.type || 'Standard').slice(1)
  const today = new Date().toLocaleDateString('es-DO')
  const id = Date.now().toString().slice(-6)
  quote.value = {
    show: true, id, today,
    hotel: hotelInfo.value.name || 'SolmiOS',
    hotelAddress: hotelInfo.value.address,
    hotelPhone: hotelInfo.value.phone,
    hotelEmail: hotelInfo.value.email,
    rooms: [{ type: roomType, qty: 1, price: roomData?.basePrice || 100 }],
    checkIn: p.fromDate, checkOut: p.toDate, nights: p.nights,
    guest: '', email: '', phone: '', adults: 1, kids: 0,
    taxName: 'ITBIS', taxRate: 18, notes: '',
  }
  popup.value.show = false
}
function popupBlock() {
  const p = popup.value
  lastSel.value = null
  blockDlg.value = { show: true, room: `${p.room?.number} - ${p.room?.type}`, from: p.fromDate, to: p.toDate, reason: '', customReason: '', rid: p.room?.id }
  popup.value.show = false
}
function printQuote() { window.print() }
function onQuoteRoomTypeChange(i: number) {
  const item = quote.value.rooms[i]
  if (!item) return
  const typeLower = item.type.toLowerCase()
  const match = planRooms.value.find((r: any) => (r.type || '').toLowerCase() === typeLower)
  if (match?.basePrice) item.price = match.basePrice
}
function addQuoteRoom() {
  const type = quoteRoomTypes.value[0] || 'Standard'
  const typeLower = type.toLowerCase()
  const match = planRooms.value.find((r: any) => (r.type || '').toLowerCase() === typeLower)
  const price = match?.basePrice || 100
  quote.value.rooms.push({ type, qty: 1, price })
}
function popupViewRes() {
  lastSel.value = null
  const r = popup.value.res; if (!r) return
  popup.value.show = false
  viewResDetail(r)
}
function popupUnblock() { const b = popup.value.blk; if (b) { lastSel.value = null; popup.value.show = false; confirmUnblock(b) } }

// Block / Unblock
async function saveBlock() {
  const { from, to, reason, customReason, rid } = blockDlg.value
  if (!rid || !from || !to) return
  const finalReason = reason || customReason || ''
  try { const r = await HotelService.createBlock({ roomIds: [rid], reason: finalReason, startDate: from, endDate: to }); if ((r as any).data) planBlocks.value.push(...(r as any).data); toast.success('Bloqueado'); blockDlg.value.show = false } catch { toast.error('Error') }
}
function confirmUnblock(b: any) {
  const room = planRooms.value.find((r: any) => r.id === b.roomId)
  unblock.value = { show: true, id: b.id, room: room?.number || '?', reason: b.reason, from: b.startDate, to: b.endDate }
}
async function doUnblock() {
  try { await HotelService.deleteBlock(unblock.value.id); planBlocks.value = planBlocks.value.filter((b: any) => b.id !== unblock.value.id); toast.success('Desbloqueado') } catch { toast.error('Error') }
  unblock.value.show = false
}

// New reservation
async function saveNewRes() {
  const n = newRes.value
  const hotelId = hid.value || planRooms.value[0]?.hotelId
  if (!n.room) { toast.error('Falta habitación'); return }
  if (!n.name?.trim()) { toast.error('Falta nombre del huésped'); return }
  let cout = n.cout
  if (!cout || cout <= n.cin) {
    const d = new Date(n.cin + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    cout = fDate(d)
  }
  const guestName = n.name.trim()
  try {
    // 1. Crear huésped con todos los campos
    const guest: any = await GuestService.create({
      hotelId,
      name: guestName,
      email: n.email.trim(),
      phone: n.phone.trim(),
      nationality: n.nationality,
      language: n.language,
      country: n.country,
      sex: n.sex,
      birthDate: n.birthDate,
      address: n.address,
      city: n.city,
      province: n.province,
      documentType: n.documentType,
      document: n.document,
      documentIssueDate: n.documentIssueDate,
      notes: n.guestNotes,
      communicateClient: n.communicateClient,
    })
    // 2. Crear reserva
    const r = await ReservationService.create({
      hotelId, roomId: n.room.id, guestId: guest.id,
      checkIn: n.cin, checkOut: cout, totalAmount: n.amt,
      channel: n.ch, status: 'confirmed',
      paymentMethod: n.payMethod, deposit: n.deposit || 0,
      depositPercentage: n.depositPercentage,
      depositStatus: n.depositStatus,
      adults: n.adults, children: n.kids,
      notes: n.guestNotes,
      regime: n.regime,
      commission: n.commission,
      externalLocator: n.extLocator,
    })
    // 3. Push local
    const amt = n.amt || 0
    const dep = n.deposit || 0
    const paymentStatus = amt > 0 && dep >= amt ? 'paid' : dep > 0 ? 'partial' : 'pending'
    planReservas.value.push({
      id: r.id, roomId: n.room.id, guestId: guest.id,
      guestName, guestEmail: n.email.trim(),
      checkIn: n.cin, checkOut: cout, totalAmount: amt,
      status: 'confirmed', channel: n.ch,
      adults: n.adults, children: n.kids,
      roomNumber: n.room.number, paymentMethod: n.payMethod, deposit: dep,
      paymentStatus,
    })
    toast.success('Reserva creada')
    newRes.value.show = false
  } catch (e: any) {
    toast.error(e?.message || 'Error al crear la reserva')
  }
}

// Load
onMounted(async () => {
  try { const d = await OperationsService.planning(hid.value); planRooms.value = d.rooms ?? []; planReservas.value = d.reservas ?? [] } catch {}
  try { const b = await HotelService.blocks(); planBlocks.value = (b.data ?? []) as any[] } catch {}
  try {
    const s = await HotelService.settings(hid.value)
    const h = (s as any).hotel || {}
    hotelInfo.value = { name: h.name || auth.user?.hotelName || '', address: h.address || '', phone: h.phone || '', email: h.email || '' }
  } catch {}
})
function prevWeek() { weekOffset.value--; lastSel.value = null; popup.value.show = false }
function nextWeek() { weekOffset.value++; lastSel.value = null; popup.value.show = false }
function goToday() { weekOffset.value = 0; lastSel.value = null; popup.value.show = false }
</script>

<style>
@media screen { .print-only { display: none !important; } }
@media print { .no-print, .screen-only { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }
</style>

<style scoped>
.p-nav-btn {
  width: 26px; height: 26px;
  display: grid; place-items: center;
  border-radius: 8px;
  color: rgb(100 116 139);
  cursor: pointer;
  transition: all 0.15s ease;
}
.p-nav-btn:hover { background: rgba(0, 0, 0, 0.06); color: #0D2B4E; }

/* Entrada/salida de los modales: backdrop se desvanece, el panel además escala y sube levemente. */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .modal-panel,
.modal-fade-leave-active .modal-panel {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}
.modal-fade-enter-from .modal-panel,
.modal-fade-leave-to .modal-panel {
  opacity: 0;
  transform: scale(0.95) translateY(12px);
}
</style>
