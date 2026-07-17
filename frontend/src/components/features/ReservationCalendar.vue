<template>
  <div :class="embedded ? '' : 'min-h-screen bg-surface'">
    <!-- Barra de operaciones rápidas (arriba del todo, imponente — solo vista completa) -->
    <div v-if="!embedded" class="bg-gradient-to-r from-navy to-navy/90 px-6 py-2.5 flex items-center gap-2 flex-wrap shadow-md">
      <span class="text-[10px] font-black text-white/45 uppercase tracking-widest mr-1">Operaciones</span>
      <button v-for="t in QUICK_TOOLBAR" :key="t.key" @click="openQuick(t.key)" :title="t.label"
        class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-extrabold transition-all cursor-pointer ring-1 ring-white/10 hover:ring-white/30">
        <span class="text-base leading-none">{{ t.icon }}</span>
        <span>{{ t.label }}</span>
      </button>
    </div>
    <div class="bg-white border-b border-border px-6 py-4" :class="embedded ? 'rounded-t-2xl border-x border-t' : ''">
      <div class="max-w-full mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div v-if="!embedded">
          <h1 class="text-xl font-black text-navy">Planning</h1>
          <p class="text-xs text-text-muted">Arrastrá sobre las celdas para seleccionar fechas</p>
        </div>
        <div v-else class="flex items-center gap-2.5">
          <span class="grid h-8 w-8 place-items-center rounded-xl bg-navy/10 text-navy">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/></svg>
          </span>
          <h2 class="text-sm font-black uppercase tracking-wider text-navy">Calendario de Reservas</h2>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 bg-white rounded-xl border border-border px-2">
            <button @click="prevWeek" class="p-1.5 rounded-lg hover:bg-surface cursor-pointer">◀</button>
            <span class="text-sm font-bold text-navy min-w-[200px] text-center">{{ weekLabel }}</span>
            <button @click="nextWeek" class="p-1.5 rounded-lg hover:bg-surface cursor-pointer">▶</button>
          </div>
          <button @click="goToday" class="px-3 py-1.5 bg-navy text-white text-xs font-bold rounded-lg cursor-pointer">Hoy</button>
          <select v-model="viewDays" class="px-3 py-1.5 border border-border rounded-lg text-xs font-bold text-navy bg-white cursor-pointer">
            <option :value="7">7 días</option><option :value="14">14 días</option><option :value="30">30 días</option>
          </select>
          <button v-if="!embedded && canEditMinStay" @click="openSeasonDialog" title="Asignar temporada a un rango de fechas"
            class="px-3 py-1.5 border border-border rounded-lg text-xs font-bold text-navy bg-white hover:bg-surface cursor-pointer inline-flex items-center gap-1.5">
            🗓️ Temporadas
          </button>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="px-6 py-3 flex items-center gap-3 text-[10px] font-bold flex-wrap">
      <div class="flex items-center gap-2 bg-white border border-border rounded-lg p-1">
        <button @click="colorMode = 'channel'" class="px-2 py-0.5 rounded text-[10px] cursor-pointer" :class="colorMode === 'channel' ? 'bg-navy text-white' : 'text-text-muted'">Por Canal</button>
        <button @click="colorMode = 'status'" class="px-2 py-0.5 rounded text-[10px] cursor-pointer" :class="colorMode === 'status' ? 'bg-navy text-white' : 'text-text-muted'">Por Estado</button>
      </div>
      <template v-if="colorMode === 'channel'">
        <span v-for="lc in LEGEND_CH" :key="lc.k" class="flex items-center gap-1.5">
          <ChannelIcon :channel="lc.k" :size="16" />
          <span class="text-navy">{{ lc.l }}</span>
        </span>
        <button v-if="!embedded" @click="openColorPicker" class="ml-2 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-navy text-white text-[11px] font-extrabold shadow-sm hover:bg-navy/90 hover:shadow-md transition-all cursor-pointer" title="Elegir el color de cada canal">🎨 Personalizar colores</button>
      </template>
      <template v-else>
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-amber-500"></span>Pendiente</span>
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-cyan"></span>Confirmada</span>
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-teal"></span>Check-in</span>
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-gray-400"></span>Check-out</span>
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-coral"></span>Cancelada</span>
      </template>
      <span class="text-text-muted">|</span>
      <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-gray-300"></span> Bloqueo</span>
      <span class="text-text-muted">|</span>
      <span class="text-text-muted">🟡 Pago parcial</span>
      <span class="text-text-muted">✅ Pagada</span>
      <span class="text-text-muted">🔐 Con cerradura</span>
      <!-- Filtro por tipo de habitación: solo en el Planning; el widget del dashboard va limpio. -->
      <template v-if="!embedded">
        <span class="text-text-muted">|</span>
        <span class="text-text-muted uppercase">Tipos:</span>
        <button v-for="rt in roomTypes" :key="rt.type" @click="toggleTypeFilter(rt.type)"
          class="px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer"
          :class="typeFilter.has(rt.type) ? 'border-navy bg-navy/10 text-navy' : 'border-border text-text-muted line-through'">
          {{ rt.type }} ({{ rt.rooms.length }})
        </button>
      </template>
    </div>

    <!-- Grid -->
    <div class="px-6 pb-6" :class="dragCursorClass" @mouseup="onMouseUp" @mousemove="onMouseMove" @mouseleave="onMouseUp">
      <div class="bg-white rounded-2xl border border-border overflow-hidden">
        <div class="overflow-x-auto">
          <div class="min-w-max select-none">
            <!-- Header -->
            <div class="flex border-b border-border bg-surface/50 sticky top-0 z-10">
              <div class="w-56 flex-shrink-0 px-4 py-3 border-r border-border">
                <span class="text-[10px] font-bold text-text-muted uppercase">Habitaciones</span>
              </div>
              <div v-for="day in visibleDays" :key="day.dateStr"
                class="flex-1 min-w-[68px] px-2 py-3 text-center border-r border-navy/15 shrink-0"
                :class="!seasonColorFor(day.dateStr) && (day.isToday ? 'bg-cyan/20' : day.isWeekend ? 'bg-cyan/10' : '')"
                :style="seasonHeaderStyle(day.dateStr)"
                :title="seasonLabelFor(day.dateStr) ? `Temporada: ${seasonLabelFor(day.dateStr)}` : ''">
                <div class="text-[10px] font-bold" :class="day.isToday ? 'text-cyan' : 'text-text-muted'">{{ day.dayName }}</div>
                <div class="text-xs font-black mt-0.5" :class="day.isToday ? 'text-cyan' : 'text-navy'">{{ day.dayNum }}</div>
                <div class="text-[9px] text-text-muted mt-0.5">{{ day.monthShort }}</div>
              </div>
            </div>

            <!-- Días Mínimos: estadía mínima (noches) para reservas que ENTRAN cada día -->
            <div class="flex border-b border-border bg-amber-50/60">
              <div class="w-56 flex-shrink-0 px-4 py-2 border-r border-border flex items-center gap-1.5">
                <span class="text-[11px] leading-none">📏</span>
                <span class="text-[10px] font-black text-navy uppercase tracking-wide">Días Mínimos</span>
              </div>
              <div v-for="day in visibleDays" :key="'ms-' + day.dateStr"
                class="flex-1 min-w-[68px] px-1 py-1.5 text-center border-r border-navy/10 shrink-0"
                :class="day.isToday ? 'bg-cyan/10' : ''">
                <input v-if="minStayEditDate === day.dateStr" :ref="setMinStayInput" type="number" min="1" max="365"
                  v-model.number="minStayDraft"
                  @blur="commitMinStay(day.dateStr)" @keyup.enter="commitMinStay(day.dateStr)" @keyup.esc="minStayEditDate = null"
                  class="w-11 text-center text-xs font-black border border-navy rounded px-0.5 py-0.5 outline-none" />
                <button v-else type="button" @click="startMinStayEdit(day.dateStr)" :disabled="!canEditMinStay"
                  class="w-full text-xs font-black rounded px-1 py-0.5 transition-colors"
                  :class="[minStayFor(day.dateStr) > 1 ? 'text-coral' : 'text-navy/60', canEditMinStay ? 'cursor-pointer hover:bg-navy/10' : 'cursor-default']"
                  :title="canEditMinStay ? 'Estadía mínima (noches) para llegadas este día — clic para editar' : 'Estadía mínima (noches) para llegadas este día'">
                  {{ minStayFor(day.dateStr) }}
                </button>
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

              <div v-for="room in rt.rooms" :key="room.id" class="flex border-b border-navy/10 hover:bg-surface/30">
                <div class="w-56 flex-shrink-0 px-4 py-3 border-r border-border flex items-center gap-2">
                  <span class="font-bold text-sm text-navy">{{ room.number }}</span>
                  <span class="text-[10px] text-text-muted truncate">{{ room.type }}</span>
                  <button v-if="!embedded" @click.stop="openRoomLock(room)" class="ml-auto shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                    :class="hasLock(room.id) ? 'bg-teal/15 text-teal hover:bg-teal/25' : 'bg-navy/[0.04] text-navy/25 hover:bg-navy/10 hover:text-navy/50'"
                    :title="hasLock(room.id) ? 'Cerradura asignada — gestionar' : 'Sin cerradura asignada'">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                      <rect x="5" y="10" width="14" height="11" rx="2"/><path stroke-linecap="round" d="M8 10V7a4 4 0 0 1 8 0v3"/>
                      <circle cx="9" cy="14.5" r="0.7" fill="currentColor"/><circle cx="12" cy="14.5" r="0.7" fill="currentColor"/><circle cx="15" cy="14.5" r="0.7" fill="currentColor"/>
                      <circle cx="9" cy="17.5" r="0.7" fill="currentColor"/><circle cx="12" cy="17.5" r="0.7" fill="currentColor"/><circle cx="15" cy="17.5" r="0.7" fill="currentColor"/>
                    </svg>
                  </button>
                  <span class="w-2 h-2 rounded-full shrink-0" :class="[room.status === 'occupied' ? 'bg-coral' : 'bg-teal', embedded ? 'ml-auto' : '']"></span>
                </div>

                <div v-for="day in visibleDays" :key="day.dateStr + room.id"
                  :data-rid="room.id" :data-date="day.dateStr"
                  class="flex-1 min-w-[68px] h-12 border-r border-navy/15 relative cursor-pointer shrink-0"
                  :class="[
                    day.isToday ? 'bg-cyan/[0.16]' : '',
                    !day.isToday && day.isWeekend ? 'bg-cyan/10' : '',
                    isInRange(room.id, day.dateStr) ? 'bg-cyan/30 ring-1 ring-cyan/60 ring-inset' : '',
                    dragRoom?.id === room.id && !isInRange(room.id, day.dateStr) ? 'hover:bg-cyan/5' : '',
                  ]"
                  @mousedown.prevent="onMouseDown(room, day, $event)">

                  <!-- Reservation -->
                  <div v-if="gRes(room.id, day.dateStr) && isResFirst(room.id, day.dateStr)"
                    class="absolute inset-y-1 left-0 rounded-md flex items-center px-2 z-10 overflow-hidden cursor-move hover:brightness-90 select-none"
                    :class="[gRes(room.id, day.dateStr)!.bg, resDrag?.id === gRes(room.id, day.dateStr)!.id ? 'ring-2 ring-white/80 shadow-lg z-30' : '', resDrag?.id === gRes(room.id, day.dateStr)!.id && resDrag?.moved ? 'pointer-events-none opacity-90' : '']"
                    :style="barStyle(room.id, day)"
                    @mousedown.stop="onResDown(gRes(room.id, day.dateStr)!, $event)"
                    @click.stop="openContext($event, gRes(room.id, day.dateStr)!, room)"
                    @contextmenu.prevent.stop="openContext($event, gRes(room.id, day.dateStr)!, room)">
                    <ChannelIcon :channel="gRes(room.id, day.dateStr)!.chKey" :size="13" class="mr-1 shrink-0 ring-1 ring-white/40 rounded-[4px]" />
                    <span class="text-[9px] font-extrabold truncate text-white"><span v-if="gRes(room.id, day.dateStr)!.pax" class="text-white/75">{{ gRes(room.id, day.dateStr)!.pax }}P·</span>{{ gRes(room.id, day.dateStr)!.name }}</span>
                    <span class="text-[8px] text-white/70 ml-auto shrink-0 flex items-center gap-0.5">
                      <span v-if="gRes(room.id, day.dateStr)!.lockCode" :title="`Cerradura: ${gRes(room.id, day.dateStr)!.lockCode}`">🔐</span>
                      <span :title="`Pago: ${gRes(room.id, day.dateStr)!.paymentStatus}`">{{ PAY_ICON[gRes(room.id, day.dateStr)!.paymentStatus] }}</span>
                      <span>${{ gRes(room.id, day.dateStr)!.amt }}</span>
                    </span>
                    <!-- Handle para extender/acortar (arrastrar el borde derecho) — #204/#207 -->
                    <div class="absolute right-0 inset-y-0 w-4 cursor-ew-resize bg-white/25 hover:bg-white/60 z-20 flex items-center justify-center gap-0.5 rounded-r-md"
                      title="Arrastrá para extender o acortar la estadía"
                      @mousedown.stop.prevent="onResizeDown(gRes(room.id, day.dateStr)!, $event)"
                      @click.stop>
                      <span class="w-0.5 h-4 bg-white/90 rounded"></span>
                      <span class="w-0.5 h-4 bg-white/90 rounded"></span>
                    </div>
                  </div>

                  <!-- Block -->
                  <div v-if="gBlk(room.id, day.dateStr) && isBlkFirst(room.id, day.dateStr)"
                    class="absolute inset-y-1 left-0 rounded-md flex items-center px-2 z-10 bg-gray-300/80 cursor-pointer hover:bg-gray-400/80"
                    :style="{ width: `calc(${blkSpan(room.id, day)} * 100%)` }"
                    @mousedown.stop @click.stop="confirmUnblock(gBlk(room.id, day.dateStr)!)">
                    <span class="text-[9px] font-bold text-gray-600 truncate">🚫 {{ gBlk(room.id, day.dateStr)!.reason || 'Bloqueo' }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Occupancy -->
            <div class="flex border-t-2 border-border bg-surface">
              <div class="w-56 flex-shrink-0 px-4 py-3 border-r border-border"><span class="text-xs font-black text-navy">Ocupación</span></div>
              <div v-for="day in visibleDays" :key="day.dateStr" class="flex-1 min-w-[68px] px-2 py-3 text-center border-r border-border/50">
                <span class="text-xs font-black" :class="dayOcc(day.dateStr) > 80 ? 'text-coral' : dayOcc(day.dateStr) > 50 ? 'text-gold' : 'text-teal'">{{ dayOcc(day.dateStr) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Popup (MisterPlan style: appears next to cell) -->
    <Teleport to="body">
      <div v-if="popup.show" class="fixed z-[100] bg-white rounded-xl border border-border shadow-xl py-1 min-w-[190px]"
        :style="{ left: popup.x + 'px', top: popup.y + 'px' }">
        <div class="px-3 py-2 text-[10px] font-bold text-text-muted uppercase border-b border-border flex items-center justify-between">
          <span>{{ popup.room?.number }} · {{ popup.fromDate }}{{ popup.fromDate !== popup.toDate ? ' → ' + popup.toDate : '' }}
            <span v-if="popup.nights > 0" class="text-navy ml-1">({{ popup.nights }}n)</span>
          </span>
          <button @click="closePopup" class="text-text-muted hover:text-coral font-bold text-sm cursor-pointer ml-3">✕</button>
        </div>
        <button v-if="!popup.res && !popup.blk" @click="popupNewRes" class="w-full text-left px-4 py-2.5 text-sm font-bold text-navy hover:bg-surface cursor-pointer flex items-center gap-2">
          <span class="text-teal text-base">+</span> Nueva Reserva
        </button>
        <button v-if="!popup.res && !popup.blk" @click="popupBlock" class="w-full text-left px-4 py-2.5 text-sm font-bold text-navy hover:bg-surface cursor-pointer flex items-center gap-2">
          <span class="text-coral">🚫</span> Bloquear
        </button>
        <button v-if="!popup.res && !popup.blk" @click="popupQuote" class="w-full text-left px-4 py-2.5 text-sm font-bold text-navy hover:bg-surface cursor-pointer flex items-center gap-2">
          <span class="text-gold">📄</span> Cotización
        </button>
        <button v-if="popup.res" @click="popupViewRes" class="w-full text-left px-4 py-2.5 text-sm font-bold text-navy hover:bg-surface cursor-pointer flex items-center gap-2">
          <span>📋</span> Ver Reserva
        </button>
        <button v-if="popup.res" @click="popupExtend" class="w-full text-left px-4 py-2.5 text-sm font-bold text-navy hover:bg-surface cursor-pointer flex items-center gap-2">
          <span>📅</span> Extender estadía
        </button>
        <button v-if="popup.res" @click="popupDuplicate" class="w-full text-left px-4 py-2.5 text-sm font-bold text-navy hover:bg-surface cursor-pointer flex items-center gap-2">
          <span>📄</span> Duplicar reserva
        </button>
        <button v-if="popup.res" @click="popupCheckin" class="w-full text-left px-4 py-2.5 text-sm font-bold text-teal hover:bg-surface cursor-pointer flex items-center gap-2">
          <span>🛎️</span> Hacer Check-in
        </button>
        <button v-if="popup.res" @click="popupCancel" class="w-full text-left px-4 py-2.5 text-sm font-bold text-coral hover:bg-surface cursor-pointer flex items-center gap-2">
          <span>✕</span> Cancelar Reserva
        </button>
        <button v-if="popup.blk" @click="popupUnblock" class="w-full text-left px-4 py-2.5 text-sm font-bold text-coral hover:bg-surface cursor-pointer flex items-center gap-2">
          <span>🗑️</span> Eliminar Bloqueo
        </button>
      </div>
    </Teleport>

    <!-- Block dialog -->
    <Teleport to="body">
      <div v-if="blockDlg.show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-md p-6">
          <h3 class="text-lg font-black text-navy mb-4">🚫 Bloquear</h3>
          <div class="space-y-4">
            <div class="bg-surface rounded-xl p-3 text-sm font-bold text-navy">{{ blockDlg.room }} · {{ blockDlg.from }} → {{ blockDlg.to }}</div>
            <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Motivo</label>
              <select v-model="blockDlg.reason" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer mb-2">
                <option value="">Personalizado...</option><option value="Mantenimiento">Mantenimiento</option><option value="Reforma">Reforma</option><option value="Inventario">Inventario</option><option value="Reservado">Reservado</option>
              </select>
              <input v-if="blockDlg.reason === '' || blockDlg.reason === 'Personalizado...'" v-model="blockDlg.customReason" type="text" placeholder="Escribe el motivo..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" />
            </div>
          </div>
          <div class="flex gap-3 mt-6">
            <button @click="blockDlg.show = false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="saveBlock" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer">Bloquear</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Unblock confirm -->
    <Teleport to="body">
      <div v-if="unblock.show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
          <div class="text-3xl mb-3">🚫</div>
          <h3 class="text-lg font-black text-navy mb-2">¿Desbloquear?</h3>
          <p class="text-sm text-text-secondary">{{ unblock.room }} — {{ unblock.reason }}</p>
          <p class="text-xs text-text-muted">{{ unblock.from }} → {{ unblock.to }}</p>
          <div class="flex gap-3 mt-6">
            <button @click="unblock.show = false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="doUnblock" class="flex-1 py-2.5 bg-coral text-white rounded-xl text-sm font-bold cursor-pointer">Desbloquear</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- New reservation — modal completo -->
    <Teleport to="body">
      <div v-if="newRes.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="p-5 border-b border-border flex items-center justify-between shrink-0 bg-gradient-to-r from-navy to-navy/90">
            <div class="flex items-center gap-3">
              <h3 class="text-lg font-black text-white">Nueva Reserva</h3>
              <span class="text-xs text-white/60">🏨 {{ newRes.room?.number }} — {{ newRes.room?.type }} · ${{ newRes.room?.basePrice }}/n</span>
            </div>
            <button @click="newRes.show=false" class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white cursor-pointer hover:bg-white/20">✕</button>
          </div>
          <!-- Body -->
          <div class="flex-1 overflow-y-auto">
            <div class="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
              <!-- IZQUIERDA: Cliente + Emergencia -->
              <div class="p-5 space-y-5">
                <div>
                  <h4 class="text-xs font-black text-navy uppercase mb-3 flex items-center gap-2"><span class="w-5 h-5 rounded bg-navy/10 flex items-center justify-center text-[10px]">👤</span> Cliente</h4>
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
                    <div class="grid grid-cols-3 gap-3">
                      <div class="col-span-2"><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Dirección</label><input v-model="newRes.address" type="text" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                      <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Ciudad</label><input v-model="newRes.city" type="text" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Provincia</label><input v-model="newRes.province" type="text" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                      <div></div>
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
                <!-- Emergencia -->
                <div class="border border-coral/20 rounded-xl p-4 bg-coral/5">
                  <h4 class="text-xs font-black text-coral uppercase mb-3 flex items-center gap-2"><span class="w-5 h-5 rounded bg-coral/20 flex items-center justify-center text-[10px]">🚨</span> Contacto de Emergencia</h4>
                  <div class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                      <div class="col-span-2"><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Nombre completo</label><input v-model="newRes.emergencyName" type="text" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                      <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Teléfono</label><input v-model="newRes.emergencyPhone" type="tel" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                      <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Parentesco</label><select v-model="newRes.emergencyRelation" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="">Seleccionar</option><option>Familiar</option><option>Amigo/a</option><option>Empleado/a</option><option>Agente de viajes</option><option>Otro</option></select></div>
                    </div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Email</label><input v-model="newRes.emergencyEmail" type="email" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                  </div>
                </div>
                <!-- OTA -->
                <div v-if="newRes.ch!=='direct'" class="border border-border rounded-xl p-4 bg-surface/50">
                  <h4 class="text-xs font-black text-navy uppercase mb-3">🌐 Datos del Canal</h4>
                  <div class="grid grid-cols-2 gap-3">
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Comisión (%)</label><input v-model.number="newRes.commission" type="number" min="0" max="50" class="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
                    <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Locator OTA</label><input v-model="newRes.extLocator" type="text" class="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
                  </div>
                </div>
              </div>
              <!-- DERECHA: Tarjeta + Alojamiento + Anticipo -->
              <div class="p-5 space-y-5">
                <!-- Tarjeta -->
                <div class="border border-purple/20 rounded-xl p-4 bg-purple/5">
                  <h4 class="text-xs font-black text-purple uppercase mb-3 flex items-center gap-2"><span class="w-5 h-5 rounded bg-purple/20 flex items-center justify-center text-[10px]">💳</span> Tarjeta de Crédito/Débito</h4>
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
                <!-- Alojamiento -->
                <div>
                  <h4 class="text-xs font-black text-navy uppercase mb-3 flex items-center gap-2"><span class="w-5 h-5 rounded bg-navy/10 flex items-center justify-center text-[10px]">🏨</span> Alojamiento</h4>
                  <div class="bg-surface rounded-xl p-3 text-sm space-y-2 mb-3">
                    <div class="flex justify-between"><span class="text-text-secondary">Habitación</span><span class="font-bold text-navy">{{ newRes.room?.number }} — {{ newRes.room?.type }}</span></div>
                    <div class="flex justify-between items-center gap-2"><span class="text-text-secondary shrink-0">Fecha entrada</span><input v-model="newRes.cin" type="date" class="min-w-0 flex-1 px-2 py-1 rounded-lg border border-border text-xs font-bold text-navy" /></div>
                    <div class="flex justify-between items-center gap-2"><span class="text-text-secondary shrink-0">Fecha salida</span><input v-model="newRes.cout" type="date" class="min-w-0 flex-1 px-2 py-1 rounded-lg border border-border text-xs font-bold text-navy" /></div>
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
                    <div class="flex justify-between"><span class="text-text-secondary">{{ newResNights }}n × ${{ newResRoomBase }}</span><span class="font-bold">${{ newResRoomBase * newResNights }}</span></div>
                    <div v-if="hotelTaxRate > 0" class="flex justify-between"><span class="text-text-secondary">{{ hotelTaxName }} ({{ hotelTaxRate }}%)</span><span class="font-bold">${{ newResTax }}</span></div>
                  </div>
                </div>
                <!-- Anticipo -->
                <div class="border border-teal/20 rounded-xl p-4 bg-teal/5">
                  <h4 class="text-xs font-black text-teal uppercase mb-3 flex items-center gap-2"><span class="w-5 h-5 rounded bg-teal/20 flex items-center justify-center text-[10px]">💰</span> Anticipo y Total</h4>
                  <div class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                      <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Anticipo (%)</label><input v-model.number="newRes.depositPercentage" type="number" min="0" max="100" class="w-full px-3 py-2 rounded-xl border border-border text-sm" /></div>
                      <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Monto ($)</label><input v-model.number="newRes.deposit" type="number" min="0" class="w-full px-3 py-2 rounded-xl border border-border text-sm font-bold text-navy" /></div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Estado</label><select v-model="newRes.depositStatus" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="unpaid">Sin pagar</option><option value="partial">Parcial</option><option value="paid">Pagado</option></select></div>
                      <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Pago con</label><select v-model="newRes.payMethod" class="w-full px-3 py-2 rounded-xl border border-border text-sm cursor-pointer"><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="cash">Efectivo</option><option value="link">Link de pago</option></select></div>
                    </div>
                    <div class="bg-white rounded-xl p-3 space-y-1.5 border border-border">
                      <div class="flex justify-between text-sm"><span class="text-text-secondary">Precio final</span><span class="font-extrabold text-navy text-lg">${{ newResAmt }}</span></div>
                      <div v-if="newResAmt > 0" class="flex justify-between text-sm"><span class="text-text-secondary">Pendiente</span><span class="font-black" :class="newResAmt - newRes.deposit > 0 ? 'text-coral' : 'text-teal'">${{ newResAmt - newRes.deposit }}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Footer -->
          <div class="p-4 border-t border-border bg-surface/80 shrink-0 flex items-center justify-between">
            <div class="text-sm font-extrabold text-navy">Total: <span class="text-lg">${{ newResAmt }}</span></div>
            <div class="flex gap-3">
              <button @click="newRes.show=false" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
              <button @click="saveNewRes" class="px-6 py-2.5 bg-teal text-white rounded-xl text-sm font-black cursor-pointer hover:opacity-90">Crear Reserva</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Quote / Cotización Modal -->
    <Teleport to="body">
      <div v-if="quote.show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4 no-print">
            <h3 class="text-lg font-black text-navy">📄 Cotización</h3>
            <button @click="quote.show = false" class="text-text-muted hover:text-coral font-bold cursor-pointer">✕</button>
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
                  <td style="padding:8px 0;font-weight:700;color:#1a2b4c">{{ item.type }}</td><td style="padding:8px 0;text-align:center">{{ item.qty }}</td><td style="padding:8px 0;text-align:right">${{ item.price }}</td><td style="padding:8px 0;text-align:right;font-weight:700">${{ item.qty * item.price * quoteNights }}</td>
                </tr>
              </tbody>
            </table>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:16px">
              <div><span style="color:#6b7280">Check-in:</span> <strong>{{ quote.checkIn }}</strong></div>
              <div><span style="color:#6b7280">Check-out:</span> <strong>{{ quote.checkOut }}</strong></div>
              <div><span style="color:#6b7280">Noches:</span> <strong>{{ quoteNights }}</strong></div>
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
              <div class="bg-surface rounded-xl p-3 flex justify-between items-center gap-2"><span class="text-text-secondary shrink-0">Check-in</span><input v-model="quote.checkIn" type="date" class="min-w-0 flex-1 px-2 py-1 rounded-lg border border-border text-xs font-bold text-navy" /></div>
              <div class="bg-surface rounded-xl p-3 flex justify-between items-center gap-2"><span class="text-text-secondary shrink-0">Check-out</span><input v-model="quote.checkOut" type="date" class="min-w-0 flex-1 px-2 py-1 rounded-lg border border-border text-xs font-bold text-navy" /></div>
            </div>
            <div class="grid grid-cols-3 gap-2 mt-2 text-sm">
              <div class="bg-surface rounded-xl p-3 flex justify-between"><span class="text-text-secondary">Noches</span><span class="font-bold">{{ quoteNights }}</span></div>
              <div class="bg-surface rounded-xl p-3 flex justify-between items-center"><span class="text-text-secondary">Adultos</span><input v-model.number="quote.adults" type="number" min="1" max="10" class="w-12 px-2 py-1 rounded-lg border border-border text-xs font-bold text-navy text-right" /></div>
              <div class="bg-surface rounded-xl p-3 flex justify-between items-center"><span class="text-text-secondary">Niños</span><input v-model.number="quote.kids" type="number" min="0" max="10" class="w-12 px-2 py-1 rounded-lg border border-border text-xs font-bold text-navy text-right" /></div>
            </div>
          </div>
          <!-- Precios -->
          <div class="mb-4">
            <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Precios</label>
            <div class="bg-surface rounded-xl p-4 space-y-2 text-sm">
              <div v-for="(item, i) in quote.rooms" :key="'p'+i" class="flex justify-between">
                <span class="text-text-secondary">{{ item.type }} ×{{ item.qty }} ({{ quoteNights }}n × ${{ item.price }})</span>
                <span class="font-bold">${{ item.qty * item.price * quoteNights }}</span>
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
            <button @click="printQuote" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer no-print">🖨️ Imprimir</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal: mover / extender reserva + cobro de diferencia (#204/#207) -->
    <Teleport to="body">
      <div v-if="reschedule.show" class="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" @click.self="closeReschedule">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div class="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 class="font-black text-navy text-base">Mover / Extender reserva</h3>
            <button @click="closeReschedule" class="text-text-muted hover:text-coral font-bold text-lg cursor-pointer">✕</button>
          </div>

          <!-- Modo "Extender" desde el menú: elegir la nueva fecha de salida -->
          <div v-if="reschedule.editable && reschedule.target" class="px-5 pt-4">
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Nueva fecha de salida</label>
            <input type="date" :value="reschedule.target.checkOut" :min="reschedule.target.checkIn"
              @change="onExtendDateChange(($event.target as HTMLInputElement).value)"
              class="w-full px-3 py-2 rounded-xl border border-border text-sm" />
          </div>

          <div v-if="reschedule.loading" class="px-5 py-10 text-center text-sm text-text-muted">Calculando cambio…</div>

          <div v-else-if="reschedule.quote" class="px-5 py-4 space-y-4">
            <!-- Resumen del cambio -->
            <div class="text-sm text-navy font-bold">{{ reschedule.res?.name || 'Reserva' }}</div>
            <div class="flex items-center gap-2 text-xs bg-surface rounded-xl px-3 py-2.5">
              <div class="flex-1">
                <div class="text-[10px] text-text-muted uppercase font-bold">Antes</div>
                <div class="font-bold text-navy">Hab. {{ roomNumberOf(String(reschedule.res?.roomId)) }}</div>
                <div class="text-text-muted">{{ String(reschedule.res?.checkIn).slice(0,10) }} → {{ String(reschedule.res?.checkOut).slice(0,10) }} · {{ reschedule.quote.oldNights }}n</div>
              </div>
              <span class="text-teal text-lg">→</span>
              <div class="flex-1 text-right">
                <div class="text-[10px] text-text-muted uppercase font-bold">Después</div>
                <div class="font-bold text-navy">Hab. {{ roomNumberOf(reschedule.quote.roomId) }}</div>
                <div class="text-text-muted">{{ reschedule.quote.checkIn }} → {{ reschedule.quote.checkOut }} · {{ reschedule.quote.newNights }}n</div>
              </div>
            </div>

            <!-- No disponible -->
            <div v-if="!reschedule.quote.available" class="bg-coral/10 border border-coral/30 rounded-xl px-3 py-2.5 text-xs text-coral font-bold">
              🚫 {{ reschedule.quote.reason || 'La habitación no está disponible en esas fechas.' }}
            </div>

            <template v-else>
              <!-- Precio -->
              <div class="space-y-1 text-sm">
                <div class="flex justify-between text-text-muted"><span>Total anterior</span><span>{{ reschedule.quote.currency }} {{ reschedule.quote.previousTotal }}</span></div>
                <div class="flex justify-between font-black" :class="reschedule.quote.difference > 0 ? 'text-coral' : reschedule.quote.difference < 0 ? 'text-teal' : 'text-text-muted'">
                  <span>{{ reschedule.quote.newNights - reschedule.quote.oldNights > 0 ? '+' : '' }}{{ reschedule.quote.newNights - reschedule.quote.oldNights }} noche(s) × {{ reschedule.quote.basePrice }}</span>
                  <span>{{ reschedule.quote.difference > 0 ? '+' : '' }}{{ reschedule.quote.currency }} {{ reschedule.quote.difference }}</span>
                </div>
                <div class="flex justify-between text-navy font-bold pt-1 border-t border-border/50"><span>Nuevo total</span><span>{{ reschedule.quote.currency }} {{ reschedule.quote.quotedNewPrice }}</span></div>
              </div>

              <!-- Cobro (solo si hay diferencia a favor del hotel) -->
              <div v-if="reschedule.quote.difference > 0" class="space-y-3 pt-1 border-t border-border">
                <div>
                  <label class="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Cómo se cobra</label>
                  <div class="grid grid-cols-3 gap-2">
                    <button v-for="m in [{k:'folio',l:'Folio'},{k:'cash',l:'Efectivo'},{k:'card',l:'Tarjeta'}]" :key="m.k"
                      @click="reschedule.method = m.k as any"
                      class="px-2 py-2 rounded-xl text-xs font-bold border cursor-pointer transition"
                      :class="reschedule.method === m.k ? 'bg-navy text-white border-navy' : 'bg-white text-navy border-border hover:border-navy/40'">
                      {{ m.l }}
                    </button>
                  </div>
                  <p v-if="reschedule.method === 'folio'" class="text-[10px] text-text-muted mt-1">Se agrega a la cuenta abierta; se salda en el checkout.</p>
                  <p v-else-if="reschedule.method === 'cash'" class="text-[10px] text-text-muted mt-1">Se registra un pago en efectivo (entra a caja).</p>
                  <p v-else class="text-[10px] text-text-muted mt-1">Genera un link de pago Stripe (el huésped paga con su tarjeta).</p>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Monto a cobrar</label>
                    <input v-model="reschedule.amount" type="number" min="0" class="w-full px-3 py-2 rounded-xl border border-border text-sm" />
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Motivo (opcional)</label>
                    <input v-model="reschedule.reason" type="text" maxlength="300" placeholder="ej. descuento" class="w-full px-3 py-2 rounded-xl border border-border text-sm" />
                  </div>
                </div>
              </div>
              <div v-else class="text-xs text-text-muted italic">Sin diferencia a cobrar.</div>
            </template>
          </div>

          <div class="px-5 py-3 border-t border-border flex justify-end gap-2">
            <button @click="closeReschedule" class="px-4 py-2 rounded-xl text-sm font-bold text-navy hover:bg-surface cursor-pointer">Cancelar</button>
            <button @click="confirmReschedule" :disabled="reschedule.loading || reschedule.submitting || !reschedule.quote?.available"
              class="px-5 py-2 rounded-xl text-sm font-black text-white bg-teal hover:brightness-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              {{ reschedule.submitting ? 'Aplicando…' : 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal de operaciones rápidas del planning -->
    <Teleport to="body">
      <div v-if="quickAction" class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" @click.self="quickAction = null">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[82vh] flex flex-col">
          <div class="flex items-center justify-between p-4 border-b border-border shrink-0">
            <h3 class="text-sm font-black text-navy">
              <span v-if="quickAction === 'arrivals'">🚪 Llegadas y Salidas de hoy</span>
              <span v-else-if="quickAction === 'search'">🔍 Buscar reserva</span>
              <span v-else-if="quickAction === 'locks'">🔐 Cerraduras</span>
              <span v-else-if="quickAction === 'sync'">🔄 Sincronizar canales</span>
            </h3>
            <button @click="quickAction = null" class="text-text-muted hover:text-coral font-bold cursor-pointer">✕</button>
          </div>
          <div class="p-4 overflow-y-auto flex-1 space-y-3">
            <!-- Llegadas / Salidas -->
            <template v-if="quickAction === 'arrivals'">
              <!-- Sin movimientos: estado vacio claro -->
              <div v-if="!arrivalsToday.length && !departuresToday.length" class="flex flex-col items-center justify-center py-8 text-center">
                <div class="text-3xl mb-2">🗓️</div>
                <div class="text-sm font-bold text-navy">Sin movimientos para hoy</div>
                <div class="text-xs text-text-muted mt-0.5">No hay llegadas ni salidas programadas.</div>
              </div>

              <template v-else>
                <!-- LLEGADAS -->
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-[10px] font-black text-teal uppercase tracking-wide">🛬 Llegadas de hoy</span>
                  <span class="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-teal/10 text-teal">{{ arrivalsToday.length }}</span>
                </div>
                <div v-if="!arrivalsToday.length" class="text-xs text-text-muted mb-2">Sin llegadas para hoy.</div>
                <div v-for="r in arrivalsToday" :key="r.id" class="rounded-xl border border-border mb-2 overflow-hidden">
                  <div class="flex items-center justify-between gap-2 p-2.5">
                    <div class="min-w-0 flex items-center gap-2">
                      <ChannelIcon :channel="r.channel || 'direct'" :size="18" class="shrink-0" />
                      <div class="min-w-0">
                        <div class="text-sm font-bold text-navy truncate">{{ r.guestName || 'Huésped' }}</div>
                        <div class="text-[10px] text-text-muted">Hab. {{ roomNoOf(r) }} · {{ (Number(r.adults) || 0) + (Number(r.children) || 0) }}P · {{ resNights(r) }}n</div>
                      </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                      <button @click="toggleRes(r.id)" class="px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-bold text-navy hover:bg-surface cursor-pointer">{{ expandedRes.has(r.id) ? 'Menos ▴' : 'Ver más ▾' }}</button>
                      <button v-if="r.status !== 'checked_in'" @click="quickCheckin(r)" class="px-2.5 py-1.5 rounded-lg bg-teal text-white text-[11px] font-bold hover:brightness-95 cursor-pointer">Check-in</button>
                      <span v-else class="px-2.5 py-1.5 rounded-lg bg-teal/10 text-teal text-[11px] font-bold">✓ Ingresado</span>
                    </div>
                  </div>
                  <div v-if="expandedRes.has(r.id)" class="px-2.5 pb-2.5 pt-2 border-t border-border bg-surface/40 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                    <div><div class="text-text-muted">Canal</div><div class="font-bold text-navy">{{ CH[(r.channel || 'direct').toLowerCase()]?.l || r.channel || 'Directa' }}</div></div>
                    <div><div class="text-text-muted">Estado</div><div><span class="font-bold px-1.5 py-0.5 rounded-full" :class="ST[r.status]?.b || 'bg-surface text-text-muted'">{{ ST[r.status]?.l || r.status }}</span></div></div>
                    <div><div class="text-text-muted">Entrada</div><div class="font-bold text-navy">{{ String(r.checkIn || '').slice(0, 10) }}</div></div>
                    <div><div class="text-text-muted">Salida</div><div class="font-bold text-navy">{{ String(r.checkOut || '').slice(0, 10) }}</div></div>
                    <div><div class="text-text-muted">Huéspedes</div><div class="font-bold text-navy">{{ Number(r.adults) || 0 }} ad · {{ Number(r.children) || 0 }} ni</div></div>
                    <div><div class="text-text-muted">Pago</div><div class="font-bold text-navy">{{ PAY_ICON[r.paymentStatus || 'pending'] }} {{ PAY_LABEL[r.paymentStatus || 'pending'] }}</div></div>
                    <div v-if="r.price || r.totalAmount"><div class="text-text-muted">Total</div><div class="font-bold text-navy">RD$ {{ Number(r.price || r.totalAmount || 0).toLocaleString('es-DO') }}</div></div>
                    <div v-if="r.externalLocator"><div class="text-text-muted">Localizador</div><div class="font-bold text-navy truncate">{{ r.externalLocator }}</div></div>
                    <div class="col-span-2 pt-1"><button @click="quickOpenRes(r)" class="w-full py-1.5 rounded-lg bg-navy text-white text-[11px] font-bold hover:bg-navy/90 cursor-pointer">Abrir reserva completa →</button></div>
                  </div>
                </div>

                <!-- SALIDAS -->
                <div class="flex items-center gap-2 mb-1.5 pt-2 border-t border-border">
                  <span class="text-[10px] font-black text-gray-500 uppercase tracking-wide">🛫 Salidas de hoy</span>
                  <span class="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ departuresToday.length }}</span>
                </div>
                <div v-if="!departuresToday.length" class="text-xs text-text-muted">Sin salidas para hoy.</div>
                <div v-for="r in departuresToday" :key="'d-' + r.id" class="rounded-xl border border-border mb-2 overflow-hidden">
                  <div class="flex items-center justify-between gap-2 p-2.5">
                    <div class="min-w-0 flex items-center gap-2">
                      <ChannelIcon :channel="r.channel || 'direct'" :size="18" class="shrink-0" />
                      <div class="min-w-0">
                        <div class="text-sm font-bold text-navy truncate">{{ r.guestName || 'Huésped' }}</div>
                        <div class="text-[10px] text-text-muted">Hab. {{ roomNoOf(r) }} · {{ resNights(r) }}n</div>
                      </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                      <button @click="toggleRes('d-' + r.id)" class="px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-bold text-navy hover:bg-surface cursor-pointer">{{ expandedRes.has('d-' + r.id) ? 'Menos ▴' : 'Ver más ▾' }}</button>
                      <button @click="quickOpenRes(r)" class="px-2.5 py-1.5 rounded-lg bg-navy text-white text-[11px] font-bold hover:bg-navy/90 cursor-pointer">Check-out</button>
                    </div>
                  </div>
                  <div v-if="expandedRes.has('d-' + r.id)" class="px-2.5 pb-2.5 pt-2 border-t border-border bg-surface/40 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                    <div><div class="text-text-muted">Canal</div><div class="font-bold text-navy">{{ CH[(r.channel || 'direct').toLowerCase()]?.l || r.channel || 'Directa' }}</div></div>
                    <div><div class="text-text-muted">Estado</div><div><span class="font-bold px-1.5 py-0.5 rounded-full" :class="ST[r.status]?.b || 'bg-surface text-text-muted'">{{ ST[r.status]?.l || r.status }}</span></div></div>
                    <div><div class="text-text-muted">Entrada</div><div class="font-bold text-navy">{{ String(r.checkIn || '').slice(0, 10) }}</div></div>
                    <div><div class="text-text-muted">Salida</div><div class="font-bold text-navy">{{ String(r.checkOut || '').slice(0, 10) }}</div></div>
                    <div><div class="text-text-muted">Huéspedes</div><div class="font-bold text-navy">{{ Number(r.adults) || 0 }} ad · {{ Number(r.children) || 0 }} ni</div></div>
                    <div><div class="text-text-muted">Pago</div><div class="font-bold text-navy">{{ PAY_ICON[r.paymentStatus || 'pending'] }} {{ PAY_LABEL[r.paymentStatus || 'pending'] }}</div></div>
                    <div v-if="r.price || r.totalAmount"><div class="text-text-muted">Total</div><div class="font-bold text-navy">RD$ {{ Number(r.price || r.totalAmount || 0).toLocaleString('es-DO') }}</div></div>
                    <div v-if="r.externalLocator"><div class="text-text-muted">Localizador</div><div class="font-bold text-navy truncate">{{ r.externalLocator }}</div></div>
                    <div class="col-span-2 pt-1"><button @click="quickOpenRes(r)" class="w-full py-1.5 rounded-lg bg-navy text-white text-[11px] font-bold hover:bg-navy/90 cursor-pointer">Abrir reserva completa →</button></div>
                  </div>
                </div>
              </template>
            </template>
            <!-- Buscar -->
            <template v-else-if="quickAction === 'search'">
              <input v-model="quickSearch" type="text" placeholder="Nombre, localizador o habitación…" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
              <div v-if="quickSearch && !quickSearchResults.length" class="text-xs text-text-muted">Sin resultados.</div>
              <div v-for="r in quickSearchResults" :key="r.id" @click="quickOpenRes(r)" class="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border hover:border-navy cursor-pointer">
                <div class="min-w-0">
                  <div class="text-sm font-bold text-navy truncate">{{ r.guestName || 'Huésped' }}</div>
                  <div class="text-[10px] text-text-muted">Hab. {{ roomNoOf(r) }} · {{ String(r.checkIn || '').slice(0, 10) }} → {{ String(r.checkOut || '').slice(0, 10) }}</div>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-text-muted shrink-0">{{ (ST[r.status] && ST[r.status].l) || r.status }}</span>
              </div>
            </template>
            <!-- Cerraduras: TODAS las del hotel, con gestión completa por cerradura -->
            <template v-else-if="quickAction === 'locks'">
              <div v-if="!hotelLocks.length" class="text-xs text-text-muted text-center py-4">No hay cerraduras sincronizadas. Conectá y sincronizá TTLock en Configuración.</div>
              <div v-for="l in hotelLocks" :key="l.id" class="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border">
                <div class="flex items-center gap-2 min-w-0">
                  <svg class="w-4 h-4 shrink-0" :class="l.status === 'online' ? 'text-teal' : 'text-navy/40'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="10" width="14" height="11" rx="2"/><path stroke-linecap="round" d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
                  <div class="min-w-0">
                    <div class="text-sm font-bold text-navy truncate">{{ l.name || 'Cerradura' }}</div>
                    <div class="text-[10px] text-text-muted">{{ l.roomId ? ('Hab. ' + (l.roomNumber || '—')) : 'Sin habitación asignada' }}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[11px] font-bold" :class="(l.batteryLevel||0) > 50 ? 'text-teal' : (l.batteryLevel||0) > 20 ? 'text-gold' : 'text-coral'">🔋 {{ l.batteryLevel || 0 }}%</span>
                  <span class="text-[9px] font-bold px-2 py-1 rounded-full" :class="l.status === 'online' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">{{ l.status === 'online' ? 'online' : 'offline' }}</span>
                  <button @click="manageLock(l)" class="px-2.5 py-1.5 rounded-lg bg-navy text-white text-[11px] font-bold hover:bg-navy/90 cursor-pointer">Gestionar</button>
                </div>
              </div>
            </template>
            <!-- Sincronizar -->
            <template v-else-if="quickAction === 'sync'">
              <p class="text-xs text-text-muted">Fuerza la sincronización con los canales y OTAs conectados, y trae al calendario las reservas nuevas.</p>
              <button @click="doSync" :disabled="syncing" class="w-full py-2.5 rounded-xl bg-navy text-white text-sm font-black hover:bg-navy/90 disabled:opacity-50 cursor-pointer">{{ syncing ? 'Sincronizando…' : '🔄 Sincronizar ahora' }}</button>
              <div v-if="syncMsg" class="text-xs font-bold text-center" :class="syncMsg.includes('No se pudo') ? 'text-coral' : 'text-teal'">{{ syncMsg }}</div>
            </template>
          </div>
          <div class="p-3 border-t border-border shrink-0 flex justify-end">
            <button @click="goAdvanced(quickAdvancedPath)" class="px-4 py-2 rounded-xl bg-surface text-navy text-xs font-black hover:bg-navy hover:text-white transition-colors cursor-pointer">{{ quickAction === 'locks' ? 'Configuración TTLock →' : 'Avanzado → página completa' }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Editor de colores de canales (#138) -->
    <Teleport to="body">
      <div v-if="colorPicker" class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" @click.self="colorPicker = false">
        <div class="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-sm">
          <div class="flex items-center justify-between p-4 border-b border-border">
            <h3 class="text-sm font-black text-navy">🎨 Colores de los canales</h3>
            <button @click="colorPicker = false" class="text-text-muted hover:text-coral font-bold cursor-pointer">✕</button>
          </div>
          <div class="p-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
            <p class="text-[11px] text-text-muted mb-1">Elegí con qué color se ven en el calendario las reservas de cada canal.</p>
            <div v-for="c in CH_LIST" :key="c.key" class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-2 text-sm font-bold text-navy"><ChannelIcon :channel="c.key" :size="18" />{{ c.label }}</span>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-mono text-text-muted uppercase">{{ colorDraft[c.key] }}</span>
                <input type="color" v-model="colorDraft[c.key]" class="w-9 h-9 rounded cursor-pointer border border-border bg-white p-0.5">
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between gap-2 p-4 border-t border-border">
            <button @click="resetChannelColors" class="px-3 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-navy cursor-pointer">Restablecer</button>
            <button @click="saveChannelColors" class="px-5 py-2 rounded-xl text-sm font-black text-white bg-teal hover:brightness-95 cursor-pointer">Guardar</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Reservation detail — ReservationModal (F3 match-misterplan) -->
    <ReservationModal
      v-if="detailId"
      :reservation-id="detailId"
      @close="detailId = null"
      @edit="onEditFromPlanning"
    />

    <!-- Cerradura por habitación (Fase A) -->
    <RoomLockModal
      :room-id="lockRoom?.id ?? null"
      :room-number="lockRoom?.number ?? ''"
      :reservation-id="lockRoom?.reservationId ?? null"
      @close="lockRoom = null"
      @changed="onLockChanged"
    />

    <!-- Diálogo: Asignación de temporadas (estilo MrPlan) -->
    <Teleport to="body">
      <div v-if="seasonDlg.show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="seasonDlg.show = false">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div class="flex items-center justify-between px-5 py-3.5 bg-navy text-white">
            <h3 class="text-sm font-black">Asignación de temporadas</h3>
            <button @click="seasonDlg.show = false" class="text-white/80 hover:text-white cursor-pointer text-xl leading-none">×</button>
          </div>
          <div class="p-5 space-y-4">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase">Rango de fechas</label>
              <div class="flex items-center gap-2 mt-1">
                <input type="date" v-model="seasonDlg.from" class="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-navy" />
                <span class="text-text-muted">→</span>
                <input type="date" v-model="seasonDlg.to" class="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-navy" />
              </div>
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase">Días de la semana</label>
              <div class="grid grid-cols-2 gap-2 mt-1.5">
                <button v-for="wd in WEEKDAYS_UI" :key="wd.idx" type="button" @click="seasonDlg.weekdays[wd.idx] = !seasonDlg.weekdays[wd.idx]"
                  class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
                  :class="seasonDlg.weekdays[wd.idx] ? 'bg-teal/15 border-teal text-teal' : 'bg-surface border-border text-text-muted'">
                  <span class="w-2.5 h-2.5 rounded-full" :class="seasonDlg.weekdays[wd.idx] ? 'bg-teal' : 'bg-gray-300'"></span>
                  {{ wd.label }}
                </button>
              </div>
            </div>
            <div class="space-y-2 pt-1">
              <button v-for="s in seasonsCatalog" :key="s.name" type="button" @click="applySeason(s.name)"
                class="w-full py-2.5 rounded-lg text-sm font-black text-white shadow-sm hover:opacity-90 cursor-pointer"
                :style="{ background: s.color }">
                {{ s.label }}
              </button>
              <p v-if="!seasonsCatalog.length" class="text-center text-xs text-text-muted py-2">Configurá temporadas en Ajustes › Tarifas primero.</p>
              <button type="button" @click="applySeason('')" class="w-full py-2 rounded-lg text-xs font-bold text-coral border border-coral/40 hover:bg-coral/5 cursor-pointer">Quitar temporada del rango</button>
            </div>
          </div>
          <div class="px-5 py-3 bg-surface/60 text-right">
            <button @click="seasonDlg.show = false" class="text-sm font-bold text-text-muted hover:text-navy cursor-pointer">Cancelar</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { OperationsService } from '@/services/Operations.service'
import { ReservationService, type RescheduleQuote, type RescheduleCommitInput } from '@/services/Reservation.service'
import { GuestService } from '@/services/Guest.service'
import { HotelService } from '@/services/Hotel.service'
import { ConfigService } from '@/services/Platform.service'
import { ChannelService } from '@/services/Channel.service'
import { http } from '@/services/http'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import ReservationModal from '@/components/features/ReservationModal.vue'
import RoomLockModal from '@/components/features/RoomLockModal.vue'
import ChannelIcon from '@/components/ui/ChannelIcon.vue'
import { TTLockService } from '@/services/TTLock.service'
import { useRouter } from 'vue-router'

// `embedded`: cuando el calendario se monta dentro del dashboard (home) en vez de la
// página Planning — oculta el título de página y ajusta el marco al card del widget.
const props = defineProps<{ embedded?: boolean }>()
// `changed`: se emite tras cada mutación que persiste en la DB (crear/mover/extender/
// pagar/bloquear/check-in/cancelar) para que el host (dashboard) refresque sus KPIs.
const emit = defineEmits<{ changed: [] }>()

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

// Acceso a la cerradura por habitación (🔒 en la fila). Pasa la reserva activa HOY (si la hay)
// para poder generar el código desde acá; el modal resuelve la cerradura por roomId.
const lockRoom = ref<{ id: string; number: string; reservationId: string | null } | null>(null)
// roomIds que tienen una cerradura TTLock asignada → el candado de esas filas se pinta distinto.
const lockedRoomIds = ref<Set<string>>(new Set())
const hotelLocks = ref<any[]>([])   // todas las cerraduras del hotel (para el panel de la barra)
function hasLock(roomId: any) { return lockedRoomIds.value.has(String(roomId)) }
async function loadLocks() {
  if (props.embedded) return   // el widget del dashboard no muestra cerraduras
  try {
    const r = await TTLockService.listLocks()
    hotelLocks.value = r.data || []
    lockedRoomIds.value = new Set(hotelLocks.value.filter(l => l.roomId).map(l => String(l.roomId)))
  } catch { /* TTLock no configurado en este hotel: sin cerraduras marcadas */ }
}
/** Abrir la gestión completa de una cerradura desde el panel de la barra (reusa RoomLockModal). */
function manageLock(l: any) {
  const room = planRooms.value.find((r: any) => String(r.id) === String(l.roomId))
  if (!room) { toast.info('Asigná esta cerradura a una habitación para gestionarla'); return }
  quickAction.value = null
  openRoomLock(room)
}
function openRoomLock(room: any) {
  const today = visibleDays.value.find(d => d.isToday)
  const res = today ? gRes(room.id, today.dateStr) : null
  lockRoom.value = { id: String(room.id), number: String(room.number ?? ''), reservationId: res?.id ?? null }
}
async function onLockChanged() {
  // Recargar el planning para reflejar el badge 🔐 de la reserva si cambió su código.
  try {
    const d = await OperationsService.planning(hid.value)
    planRooms.value = d.rooms ?? planRooms.value
    planReservas.value = d.reservas ?? planReservas.value
  } catch { /* recarga best-effort */ }
  loadLocks()
}
const hid = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

type DI = { dateStr: string; dayName: string; dayNum: number; monthShort: string; isToday: boolean; isWeekend: boolean; date: Date }

const MS_PER_DAY = 86_400_000

// El widget del dashboard ("de adelante") arranca en 7 días — más compacto y distinto del Planning.
const viewDays = ref(props.embedded ? 7 : 14)
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

// Mover/extender reserva — preview reactivo en vivo (#204/#207).
// Mientras se arrastra, este override reemplaza roomId/checkIn/checkOut de la reserva
// para que el bloque se estire (extender) o se mueva (mover) siguiendo el cursor.
const resDrag = ref<{ id: string; mode: 'move' | 'resize'; roomId: string; checkIn: string; checkOut: string; origRoomId: string; origCheckIn: string; origCheckOut: string; moved: boolean } | null>(null)
// Reservas efectivas para el render: aplica el preview del drag sobre planReservas.
const dispReservas = computed(() => {
  const rd = resDrag.value
  if (!rd) return planReservas.value
  return planReservas.value.map((r: any) => r.id === rd.id ? { ...r, roomId: rd.roomId, checkIn: rd.checkIn, checkOut: rd.checkOut } : r)
})
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
const quote = ref<{ show: boolean; id: string; today: string; hotel: string; hotelAddress: string; hotelPhone: string; hotelEmail: string; rooms: { type: string; qty: number; price: number }[]; checkIn: string; checkOut: string; nights: number; guest: string; email: string; phone: string; adults: number; kids: number; taxName: string; taxRate: number; notes: string }>({ show: false, id: '', today: '', hotel: '', hotelAddress: '', hotelPhone: '', hotelEmail: '', rooms: [{ type: 'Standard', qty: 1, price: 100 }], checkIn: '', checkOut: '', nights: 0, guest: '', email: '', phone: '', adults: 1, kids: 0, taxName: 'ITBIS', taxRate: 18, notes: '' })
// Noches de la cotización: se calculan de check-in/check-out (ahora editables en el modal).
// Antes era un valor fijo tomado del rango inicial y NO reaccionaba al cambiar las fechas,
// así que "Noches" quedaba en 1 aunque el usuario ajustara las fechas o pusiera otra cosa.
const quoteNights = computed(() => {
  const ci = quote.value.checkIn, co = quote.value.checkOut
  if (!ci || !co) return 0
  return Math.max(0, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / MS_PER_DAY))
})
const quoteSubtotal = computed(() => quote.value.rooms.reduce((s, r) => s + r.qty * r.price * quoteNights.value, 0))
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
// Impuesto del hotel — config real, NO el 10% hardcodeado de antes (C2). Cargado en onMounted.
const hotelTaxRate = ref(0)
const hotelTaxName = ref('Impuesto')
// Total de la nueva reserva: REACTIVO a fechas (noches) y tarifa (A1). Antes era un `amt`
// fijo que no reaccionaba al cambiar las fechas y usaba impuesto 10% fijo (C2).
const newResRoomBase = computed(() => Number(newRes.value.room?.basePrice) || 0)
const newResTax = computed(() => Math.round(newResRoomBase.value * newResNights.value * hotelTaxRate.value / 100))
const newResAmt = computed(() => newResRoomBase.value * newResNights.value + newResTax.value)
// Depósito sincronizado con el total y el % (A3): al abrir, cambiar fechas o el %, se
// recalcula y clampa a [0, total] (m3). El usuario puede sobreescribir el monto a mano.
watch([newResAmt, () => newRes.value.depositPercentage, () => newRes.value.show], () => {
  if (!newRes.value.show) return
  const pct = Number(newRes.value.depositPercentage) || 0
  newRes.value.deposit = Math.min(newResAmt.value, Math.max(0, Math.round(newResAmt.value * pct / 100)))
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
// El logo de marca de cada canal lo renderiza <ChannelIcon> (SVG). El nombre queda en su `title`.

// ── Colores de canal personalizables (#138) ──────────────────────────────
// El hotel elige el color de cada canal; se guarda en config `channel_colors`.
// SIN personalización, el calendario usa los colores por defecto (clases del theme):
// chOverride() devuelve null → el template cae a las clases bg-teal/bg-cyan/... de siempre.
const CH_DEFAULT: Record<string, string> = {
  direct: '#117A65', booking: '#00B4D8', expedia: '#B7950B', airbnb: '#E74C3C',
  google: '#3B82F6', whatsapp: '#10B981', phone: '#6B7280',
}
const CH_LIST = [
  { key: 'direct', label: 'Directa' }, { key: 'booking', label: 'Booking' },
  { key: 'expedia', label: 'Expedia' }, { key: 'airbnb', label: 'Airbnb' },
  { key: 'google', label: 'Google' }, { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'phone', label: 'Teléfono' },
]
// Canales reales de la leyenda (con su logo de marca vía <ChannelIcon>).
const LEGEND_CH = [
  { k: 'direct', l: 'Directa' },
  { k: 'booking', l: 'Booking.com' },
  { k: 'expedia', l: 'Expedia' },
  { k: 'airbnb', l: 'Airbnb' },
  { k: 'google', l: 'Google' },
  { k: 'whatsapp', l: 'WhatsApp' },
  { k: 'phone', l: 'Teléfono' },
]

// ── Barra de operaciones rápidas del planning (centro de operaciones) ─────
// Cada acción abre un modal para resolver en el momento; con "Avanzado →" a la página.
// Solo en la vista completa (no en el widget embebido del home).
const QUICK_TOOLBAR = [
  { key: 'arrivals', icon: '🚪', label: 'Llegadas / Salidas' },
  { key: 'search', icon: '🔍', label: 'Buscar' },
  { key: 'locks', icon: '🔐', label: 'Cerraduras' },
  { key: 'sync', icon: '🔄', label: 'Sincronizar' },
] as const
type QuickKey = typeof QUICK_TOOLBAR[number]['key']
const quickAction = ref<QuickKey | null>(null)
const quickSearch = ref('')
const syncing = ref(false)
const syncMsg = ref('')
// Reservas con el detalle desplegado ("Ver más") en el modal de llegadas/salidas.
// Las salidas se prefijan con 'd-' para no colisionar con la misma reserva en llegadas.
const expandedRes = ref<Set<string>>(new Set())
function toggleRes(id: string) {
  const s = new Set(expandedRes.value)
  s.has(id) ? s.delete(id) : s.add(id)
  expandedRes.value = s
}
function resNights(r: any): number {
  return nightsBetween(String(r.checkIn || '').slice(0, 10), String(r.checkOut || '').slice(0, 10))
}
const PAY_LABEL: Record<string, string> = { paid: 'Pagada', partial: 'Pago parcial', pending: 'Pendiente' }
function todayStr(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function openQuick(key: QuickKey) { quickAction.value = key; quickSearch.value = ''; syncMsg.value = ''; expandedRes.value = new Set() }
function goAdvanced(path: string) { quickAction.value = null; router.push(path) }

// Llegadas de hoy pendientes de check-in (checkIn = hoy, no canceladas ni ya salidas).
const arrivalsToday = computed(() => {
  const t = todayStr()
  return planReservas.value.filter((r: any) => String(r.checkIn || '').slice(0, 10) === t && r.status !== 'cancelled' && r.status !== 'checked_out')
})
// Salidas de hoy (checkOut = hoy, no canceladas).
const departuresToday = computed(() => {
  const t = todayStr()
  return planReservas.value.filter((r: any) => String(r.checkOut || '').slice(0, 10) === t && r.status !== 'cancelled')
})
// Buscar por nombre / localizador / habitación / id corto.
const quickSearchResults = computed(() => {
  const q = quickSearch.value.trim().toLowerCase()
  if (!q) return []
  return planReservas.value.filter((r: any) =>
    String(r.guestName || '').toLowerCase().includes(q) ||
    String(r.externalLocator || '').toLowerCase().includes(q) ||
    String(r.roomNumber || '').toLowerCase().includes(q) ||
    String(r.id || '').slice(-6).toLowerCase().includes(q),
  ).slice(0, 25)
})
// Reservas activas con código de cerradura.
function roomNoOf(r: any): string { return r.roomNumber || roomNumberOf(String(r.roomId)) }

async function quickCheckin(res: any) {
  try {
    await ReservationService.update(res.id, { status: 'checked_in' } as any)
    res.status = 'checked_in'
    toast.success(`Check-in: ${res.guestName || 'Huésped'}`)
    emit('changed')
  } catch { toast.error('No se pudo hacer el check-in') }
}
function quickOpenRes(res: any) { quickAction.value = null; viewResDetail(res) }

async function doSync() {
  syncing.value = true; syncMsg.value = ''
  try {
    const r = await ChannelService.sync(hid.value)
    syncMsg.value = r?.message || 'Sincronización completada'
    const d = await OperationsService.planning(hid.value)   // recargar por si entraron reservas de OTAs
    planRooms.value = d.rooms ?? planRooms.value; planReservas.value = d.reservas ?? planReservas.value
    emit('changed')
    toast.success('Canales sincronizados')
  } catch { syncMsg.value = 'No se pudo sincronizar en este momento'; toast.error('No se pudo sincronizar los canales') }
  finally { syncing.value = false }
}
// Página dedicada de cada acción rápida (botón "Avanzado").
const quickAdvancedPath = computed(() => {
  switch (quickAction.value) {
    case 'arrivals': return '/panel/checkin'
    case 'search': return '/panel/reservations'
    case 'locks': return '/panel/cerraduras'
    case 'sync': return '/panel/channel-manager'
    default: return '/panel/planning'
  }
})
const CH_COLOR_ALIAS: Record<string, string> = { directa: 'direct', 'booking.com': 'booking', walk_in: 'direct', email: 'direct' }
function normCh(key?: string): string { const k = (key || 'direct').toLowerCase().trim(); return CH_COLOR_ALIAS[k] || k }
// Colores elegidos por el hotel (solo los que difieren del default). Vacío = todo por defecto.
const channelColors = ref<Record<string, string>>({})
// Hex custom de un canal, o null si usa el color por defecto (clase del theme).
function chOverride(key?: string): string | null { return channelColors.value[normCh(key)] || null }

const colorPicker = ref(false)
const colorDraft = ref<Record<string, string>>({})
function openColorPicker() {
  const d: Record<string, string> = {}
  for (const c of CH_LIST) d[c.key] = channelColors.value[c.key] || CH_DEFAULT[c.key]
  colorDraft.value = d
  colorPicker.value = true
}
function resetChannelColors() { for (const c of CH_LIST) colorDraft.value[c.key] = CH_DEFAULT[c.key] }
async function saveChannelColors() {
  // Guardar solo lo que difiere del default → config chica y "restablecer" vuelve al theme.
  const out: Record<string, string> = {}
  for (const c of CH_LIST) { const v = (colorDraft.value[c.key] || '').toLowerCase(); if (v && v !== CH_DEFAULT[c.key].toLowerCase()) out[c.key] = v }
  try {
    await ConfigService.set('channel_colors', out, hid.value)
    channelColors.value = out
    toast.success('Colores de canales guardados')
    colorPicker.value = false
  } catch { toast.error('No se pudieron guardar los colores') }
}
// Estilo de la barra de reserva: ancho (calc de celdas) + color custom del canal si lo hay.
function barStyle(rid: any, day: DI) {
  const s: Record<string, string> = { width: `calc(${resSpan(rid, day)} * 100%)`, minWidth: '60px' }
  if (colorMode.value === 'channel') {
    const res = gRes(rid, day.dateStr)
    const c = res && chOverride(res.chKey)
    if (c) s.background = c
  }
  return s
}
const ST: Record<string, any> = {
  pending: { l: 'Pendiente', b: 'bg-gold/10 text-gold' }, confirmed: { l: 'Confirmada', b: 'bg-teal/10 text-teal' },
  checked_in: { l: 'Check-in', b: 'bg-cyan/10 text-cyan' }, checked_out: { l: 'Check-out', b: 'bg-gray-100 text-gray-500' },
  cancelled: { l: 'Cancelada', b: 'bg-coral/10 text-coral' },
}
const detectedChannels = computed(() => {
  const s = new Set<string>(); const l: any[] = []
  for (const r of planReservas.value) { const k = (r.channel || 'direct').toLowerCase(); if (!s.has(k)) { s.add(k); const c = CH[k] || { l: r.channel, bg: 'bg-gray-400' }; l.push({ ...c, key: k, text: c.bg.replace('bg-', 'text-') }) } }
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
  checked_out: 'bg-gray-400', cancelled: 'bg-coral',
}
const PAY_ICON: Record<string, string> = { paid: '✅', partial: '🟡', pending: '🔴' }
const PAY_METHODS: readonly { v: string; l: string }[] = [
  { v: 'cash', l: 'Efectivo' },
  { v: 'card', l: 'Tarjeta' },
  { v: 'transfer', l: 'Transferencia' },
  { v: 'payment_link', l: 'Link de pago' },
]

function gRes(rid: any, ds: string) {
  const r = dispReservas.value.find((b: any) => String(b.roomId) === String(rid) && b.status !== 'cancelled' && ds >= String(b.checkIn||'').slice(0,10) && ds < String(b.checkOut||'').slice(0,10))
  if (!r) return null
  const ch = (r.channel || 'direct').toLowerCase(); const cc = CH[ch] || { l: r.channel || 'Directa', bg: 'bg-gray-400' }
  const status = r.status || 'pending'
  return {
    id: r.id, name: r.guestName || 'Guest', ch: cc.l, chKey: ch,
    bg: colorMode.value === 'status' ? (ST_COLOR[status] || 'bg-gray-400') : cc.bg,
    amt: r.totalAmount || 0,
    pax: (Number(r.adults) || 0) + (Number(r.children) || 0),
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
  const orig = dispReservas.value.find((b: any) => b.id === res.id)
  if (!orig) return false
  const ci = String(orig.checkIn || '').slice(0, 10)
  const firstVisible = visibleDays.value[0]?.dateStr
  // Use the later of checkIn date and first visible date
  const renderDate = ci > (firstVisible || '') ? ci : (firstVisible || ci)
  return ds === renderDate
}
// Devuelve cuántas celdas-día cubre la reserva (NO px). El ancho real se resuelve en el
// template como calc(N * 100%): las celdas son flex-1 (ancho dinámico), así que la barra
// abarca los días COMPLETOS. Antes multiplicaba por 68px fijo y quedaba corta cuando la
// celda se estiraba, cortando la barra a mitad de día.
function resSpan(rid: any, day: DI) {
  const res = gRes(rid, day.dateStr)
  if (!res) return 1
  const orig = dispReservas.value.find((b: any) => b.id === res.id)
  if (!orig) return 1
  const ci = String(orig.checkIn || '').slice(0, 10)
  const co = String(orig.checkOut || '').slice(0, 10)
  const firstVisible = visibleDays.value[0]?.dateStr
  const startDate = ci > (firstVisible || '') ? ci : (firstVisible || ci)
  const si = visibleDays.value.findIndex(d => d.dateStr === startDate)
  const ei = visibleDays.value.findIndex(d => d.dateStr === co)
  return Math.max(1, (ei >= 0 ? ei : viewDays.value) - (si >= 0 ? si : 0))
}
function gBlk(rid: any, ds: string) { return planBlocks.value.find((b: any) => String(b.roomId) === String(rid) && ds >= b.startDate && ds <= b.endDate) || null }
function isBlkFirst(rid: any, ds: string) { return planBlocks.value.some((b: any) => String(b.roomId) === String(rid) && b.startDate === ds) }
function blkSpan(rid: any, day: DI) {
  const b = planBlocks.value.find((b: any) => String(b.roomId) === String(rid) && b.startDate === day.dateStr)
  if (!b) return 1; const si = visibleDays.value.findIndex(d => d.dateStr === b.startDate); const ei = visibleDays.value.findIndex(d => d.dateStr === b.endDate)
  return Math.max(1, (ei >= 0 ? ei : viewDays.value) - (si >= 0 ? si : 0) + 1)
}
function dayOcc(ds: string) {
  const n = planRooms.value.length; if (!n) return 0; const o = new Set<string>()
  dispReservas.value.forEach((b: any) => { if (b.status !== 'cancelled' && ds >= String(b.checkIn||'').slice(0,10) && ds < String(b.checkOut||'').slice(0,10)) o.add(String(b.roomId)) })
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
  if (onResDragMove(e)) return
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
  if (onResDragEnd()) return
  if (!isDragging.value) return
  isDragging.value = false

  const room = dragRoom.value
  const s = dragStart.value; const end = dragEnd.value
  const [from, to] = s <= end ? [s, end] : [end, s]

  dragRoom.value = null; dragStart.value = ''; dragEnd.value = ''

  if (room && (dragStarted || from !== to)) {
    // Keep selection visible
    lastSel.value = { room, from, to }
    // El rango de celdas es INCLUSIVO en ambos extremos: de `from` a `to` hay (to-from)+1
    // celdas = noches. Antes faltaba el +1 y la reserva salía una noche corta (C1).
    const nights = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / MS_PER_DAY) + 1)
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
  if (suppressClick) { suppressClick = false; return } // venía de un drag, no de un click
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
// ── Mover / extender reserva por drag de puntero, con preview en vivo (#204/#207) ──
function addDaysStr(ds: string, n: number): string { const d = new Date(ds + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
function nightsBetween(a: string, b: string): number { return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY)) }
let suppressClick = false

// mousedown en el cuerpo del bloque → arrastrar para mover (empieza a moverse al cambiar de celda).
function onResDown(rb: any, e: MouseEvent) {
  e.stopPropagation()
  const orig = planReservas.value.find((x: any) => x.id === rb.id)
  if (!orig) return
  const ci = String(orig.checkIn || '').slice(0, 10), co = String(orig.checkOut || '').slice(0, 10)
  resDrag.value = { id: rb.id, mode: 'move', roomId: String(orig.roomId), checkIn: ci, checkOut: co, origRoomId: String(orig.roomId), origCheckIn: ci, origCheckOut: co, moved: false }
}
// mousedown en el borde derecho → arrastrar para extender/acortar.
function onResizeDown(rb: any, e: MouseEvent) {
  e.stopPropagation(); e.preventDefault()
  const orig = planReservas.value.find((x: any) => x.id === rb.id)
  if (!orig) return
  const ci = String(orig.checkIn || '').slice(0, 10), co = String(orig.checkOut || '').slice(0, 10)
  resDrag.value = { id: rb.id, mode: 'resize', roomId: String(orig.roomId), checkIn: ci, checkOut: co, origRoomId: String(orig.roomId), origCheckIn: ci, origCheckOut: co, moved: false }
}
// Actualiza el preview según la celda bajo el cursor. Devuelve true si consumió el evento.
function onResDragMove(e: MouseEvent): boolean {
  const rd = resDrag.value
  if (!rd) return false
  // elementsFromPoint (PLURAL): la barra que se arrastra sigue al cursor y queda ENCIMA de las
  // celdas. Con elementFromPoint (singular) el punto caía sobre la barra → su celda origen, y
  // `moved` nunca se activaba: mover no hacía nada y al soltar se abría el menú contextual.
  // Buscamos la celda que está DEBAJO de la barra en la pila de elementos del cursor.
  const stack = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[]
  const cell = stack.find(el => el.matches?.('[data-rid][data-date]'))
  if (!cell) return true
  const rid = cell.dataset.rid, date = cell.dataset.date
  if (!rid || !date) return true
  if (rd.mode === 'resize') {
    const newCo = addDaysStr(date, 1) // el borde cae sobre la última noche → checkout exclusivo
    if (newCo > rd.checkIn) { if (newCo !== rd.checkOut) rd.moved = true; rd.checkOut = newCo }
  } else {
    const nights = nightsBetween(rd.origCheckIn, rd.origCheckOut)
    if (date !== rd.checkIn || String(rid) !== rd.roomId) rd.moved = true
    rd.roomId = String(rid); rd.checkIn = date; rd.checkOut = addDaysStr(date, nights)
  }
  return true
}
// Al soltar: si hubo cambio real, abre el modal de cobro; si no, deja pasar el click (context menu).
function onResDragEnd(): boolean {
  const rd = resDrag.value
  if (!rd) return false
  resDrag.value = null
  if (!rd.moved) return true // fue un click, no un drag → onResDown ya frenó; el click abrirá el context
  if (rd.roomId === rd.origRoomId && rd.checkIn === rd.origCheckIn && rd.checkOut === rd.origCheckOut) return true
  suppressClick = true
  const orig = planReservas.value.find((x: any) => x.id === rd.id)
  if (orig) openReschedule(orig, { roomId: rd.roomId, checkIn: rd.checkIn, checkOut: rd.checkOut })
  return true
}

// ── Modal de reprogramación / cobro de diferencia ──
const reschedule = ref<{
  show: boolean; res: any; target: { roomId: string; checkIn: string; checkOut: string } | null
  quote: RescheduleQuote | null; loading: boolean; submitting: boolean; editable: boolean
  method: 'folio' | 'cash' | 'card'; amount: string; reason: string
}>({ show: false, res: null, target: null, quote: null, loading: false, submitting: false, editable: false, method: 'folio', amount: '', reason: '' })

// Cursor global durante el arrastre: ✥ para mover, ↔ para extender. Sin esto, al poner el
// bloque en pointer-events-none el cursor "cae" a la celda (👆 pointer) durante todo el drag.
const dragCursorClass = computed(() => resDrag.value ? (resDrag.value.mode === 'resize' ? 'planning-dragging-resize' : 'planning-dragging-move') : '')

function roomNumberOf(id: string): string { return planRooms.value.find((r: any) => String(r.id) === String(id))?.number || id }
function closeReschedule() { reschedule.value.show = false }

async function openReschedule(res: any, target: { roomId: string; checkIn: string; checkOut: string }, editable = false) {
  reschedule.value = { show: true, res, target, quote: null, loading: true, submitting: false, editable, method: 'folio', amount: '', reason: '' }
  await refreshQuote()
}

// Recalcula la cotización con el target actual (se usa al abrir y al cambiar la fecha en modo editable).
async function refreshQuote() {
  const rv = reschedule.value
  if (!rv.res || !rv.target) return
  rv.loading = true
  try {
    const q = await ReservationService.rescheduleQuote(rv.res.id, rv.target)
    rv.quote = q
    rv.amount = q.difference > 0 ? String(q.difference) : ''
  } catch (e: any) {
    toast.error(e?.message || 'No se pudo calcular el cambio')
  } finally {
    rv.loading = false
  }
}

// Cambio de la fecha de salida desde el modal (modo "Extender" del menú).
function onExtendDateChange(newCheckOut: string) {
  const rv = reschedule.value
  if (!rv.target || !newCheckOut) return
  if (newCheckOut <= rv.target.checkIn) { toast.error('La salida debe ser posterior a la entrada'); return }
  rv.target = { ...rv.target, checkOut: newCheckOut }
  refreshQuote()
}

async function confirmReschedule() {
  const rv = reschedule.value; const q = rv.quote
  if (!rv.res || !rv.target || !q || !q.available) return
  rv.submitting = true
  try {
    const body: RescheduleCommitInput = { ...rv.target }
    const amountNum = rv.amount === '' ? null : Number(rv.amount)
    const wantsCharge = (amountNum ?? q.difference) > 0
    if (wantsCharge) {
      body.charge = { method: rv.method, reason: rv.reason || undefined }
      if (amountNum !== null && amountNum !== q.difference) body.charge.amount = amountNum
      if (rv.method === 'card') { body.successUrl = window.location.href; body.cancelUrl = window.location.href }
    }
    const result = await ReservationService.reschedule(rv.res.id, body)
    // Actualización optimista del bloque en el planning.
    const r = planReservas.value.find((x: any) => x.id === rv.res.id)
    if (r) {
      r.roomId = rv.target.roomId; r.checkIn = rv.target.checkIn; r.checkOut = rv.target.checkOut
      r.amt = result.reservation.totalAmount
    }
    if (result.charge?.method === 'card') {
      if (result.charge.applied && result.charge.checkoutUrl) { window.open(result.charge.checkoutUrl, '_blank'); toast.success('Cambio aplicado — link de pago abierto') }
      else { toast.error(result.charge.message || 'No se pudo generar el cobro con tarjeta; cobrá en efectivo/POS') }
    } else if (result.charge?.applied) {
      toast.success(result.charge.target === 'folio' ? 'Cambio aplicado — cargado al folio' : 'Cambio aplicado — cobrado en efectivo')
    } else {
      toast.success('Reserva actualizada')
    }
    rv.show = false
    emit('changed')
  } catch (e: any) {
    toast.error(e?.message || 'Error al aplicar el cambio')
  } finally {
    rv.submitting = false
  }
}

// Popup actions
function closePopup() { popup.value.show = false; lastSel.value = null }
async function popupCheckin() {
  const res = popup.value.res
  if (!res) return
  try {
    await ReservationService.update(res.id, { status: 'checked_in' } as any)
    res.status = 'checked_in'
    toast.success(`Check-in: ${res.guestName}`)
    closePopup()
    emit('changed')
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
    emit('changed')
  } catch { toast.error('Error') }
}
function popupNewRes() {
  const p = popup.value
  lastSel.value = null
  const roomData = planRooms.value.find((r: any) => r.id === p.room?.id)
  // Checkout EXCLUSIVO: la última celda seleccionada es la última noche; el checkout es el día
  // siguiente. Así N celdas resaltadas = N noches y la barra cubre las celdas exactas (C1).
  const cout = addDaysStr(p.toDate, 1)
  newRes.value = {
    show: true, room: { ...p.room, basePrice: roomData?.basePrice ?? p.room?.basePrice ?? 0 }, cin: p.fromDate, cout,
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
    amt: 0, // el total real es el computed `newResAmt` (reactivo)
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
    checkIn: p.fromDate, checkOut: addDaysStr(p.toDate, 1), nights: p.nights,
    guest: '', email: '', phone: '', adults: 1, kids: 0,
    taxName: hotelTaxName.value, taxRate: hotelTaxRate.value, notes: '',
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

// Extender desde el menú: abre el modal con la fecha de salida editable (+1 noche por defecto).
function popupExtend() {
  const r = popup.value.res; if (!r) return
  lastSel.value = null; popup.value.show = false
  const ci = String(r.checkIn).slice(0, 10), co = String(r.checkOut).slice(0, 10)
  openReschedule(r, { roomId: String(r.roomId), checkIn: ci, checkOut: addDaysStr(co, 1) }, true)
}

// Duplicar: crea una copia de la reserva justo después (mismas noches, misma habitación).
async function popupDuplicate() {
  const r = popup.value.res; if (!r) return
  lastSel.value = null; popup.value.show = false
  const ci = String(r.checkIn).slice(0, 10), co = String(r.checkOut).slice(0, 10)
  const nights = nightsBetween(ci, co)
  const newCheckIn = co // arranca donde terminaba la original (sin solape)
  const newCheckOut = addDaysStr(newCheckIn, nights)
  try {
    await ReservationService.create({
      hotelId: r.hotelId || hid.value || '', roomId: String(r.roomId),
      checkIn: newCheckIn, checkOut: newCheckOut, totalAmount: Number(r.totalAmount) || 0,
      guestId: r.guestId || undefined, channel: r.channel || 'direct',
      adults: r.adults ?? 2, children: r.children ?? 0,
    } as any)
    toast.success(`Reserva duplicada (${newCheckIn} → ${newCheckOut})`)
    const d = await OperationsService.planning(hid.value)
    planRooms.value = d.rooms ?? planRooms.value; planReservas.value = d.reservas ?? planReservas.value
    emit('changed')
  } catch (e: any) {
    toast.error(e?.message?.includes('disponible') || e?.message?.includes('409') ? 'No hay disponibilidad para duplicar en esas fechas' : (e?.message || 'No se pudo duplicar'))
  }
}

// Block / Unblock
async function saveBlock() {
  const { from, to, reason, customReason, rid } = blockDlg.value
  if (!rid || !from || !to) return
  const finalReason = reason || customReason || ''
  try { const r = await HotelService.createBlock({ roomIds: [rid], reason: finalReason, startDate: from, endDate: to }); if ((r as any).data) planBlocks.value.push(...(r as any).data); toast.success('Bloqueado'); blockDlg.value.show = false; emit('changed') } catch { toast.error('Error') }
}
function confirmUnblock(b: any) {
  const room = planRooms.value.find((r: any) => r.id === b.roomId)
  unblock.value = { show: true, id: b.id, room: room?.number || '?', reason: b.reason, from: b.startDate, to: b.endDate }
}
async function doUnblock() {
  try { await HotelService.deleteBlock(unblock.value.id); planBlocks.value = planBlocks.value.filter((b: any) => b.id !== unblock.value.id); toast.success('Desbloqueado'); emit('changed') } catch { toast.error('Error') }
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
      checkIn: n.cin, checkOut: cout, totalAmount: newResAmt.value,
      channel: n.ch, status: 'confirmed',
      paymentMethod: n.payMethod, deposit: n.deposit || 0,
      depositPercentage: n.depositPercentage,
      depositStatus: newResAmt.value > 0 && (n.deposit || 0) >= newResAmt.value ? 'paid' : (n.deposit || 0) > 0 ? 'partial' : 'unpaid',
      adults: n.adults, children: n.kids,
      notes: n.guestNotes,
      regime: n.regime,
      commission: n.commission,
      externalLocator: n.extLocator,
    })
    // 3. Push local
    const amt = newResAmt.value || 0
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
    emit('changed')
  } catch (e: any) {
    toast.error(e?.message || 'Error al crear la reserva')
  }
}

// ── Días Mínimos por fecha (estadía mínima de una reserva que ENTRA ese día) ──
// La fila del planning muestra las noches mínimas por columna. Default 1; solo se guardan
// overrides (>1). Editable por admin del hotel — el backend valida (settings:edit) y la reserva
// se rechaza si dura menos que el mínimo de su fecha de entrada.
const minStayByDate = ref<Record<string, number>>({})
const minStayEditDate = ref<string | null>(null)
const minStayDraft = ref<number>(1)
const canEditMinStay = computed(() => auth.isHotelAdmin || auth.isSuperAdmin)
function minStayFor(dateStr: string) { return minStayByDate.value[dateStr] || 1 }
// Function-ref: enfoca el input al montarse (confiable dentro de v-for, a diferencia de un ref plano).
function setMinStayInput(el: any) { if (el) { el.focus?.(); el.select?.() } }
async function loadDateRestrictions() {
  const days = visibleDays.value
  if (!days.length) return
  try {
    const r = await HotelService.dateRestrictions(days[0].dateStr, days[days.length - 1].dateStr)
    const map: Record<string, number> = {}
    for (const it of r.data || []) map[it.date] = Number(it.minStay) || 1
    minStayByDate.value = map
  } catch { /* sin permiso o error: la fila queda en el default (1) */ }
}
function startMinStayEdit(dateStr: string) {
  if (!canEditMinStay.value) return
  minStayDraft.value = minStayFor(dateStr)
  minStayEditDate.value = dateStr
}
async function commitMinStay(dateStr: string) {
  if (minStayEditDate.value !== dateStr) return
  minStayEditDate.value = null
  const v = Math.max(1, Math.min(365, Math.floor(Number(minStayDraft.value) || 1)))
  if (v === minStayFor(dateStr)) return
  const prev = { ...minStayByDate.value }
  const next = { ...minStayByDate.value }
  if (v > 1) next[dateStr] = v; else delete next[dateStr]
  minStayByDate.value = next
  try {
    await HotelService.saveDateRestrictions([{ date: dateStr, minStay: v }])
    toast.success(v > 1 ? `Mínimo ${v} noches para el ${dateStr}` : `Sin mínimo para el ${dateStr}`)
  } catch (e: any) {
    minStayByDate.value = prev
    toast.error(e?.message || 'No se pudo guardar el mínimo')
  }
}
// ── Temporada por fecha (diálogo "Asignación de temporadas", estilo MrPlan) ──
interface SeasonCat { name: string; label: string; color: string }
// Orden de UI (Lun→Dom); idx = getDay() (0=Dom..6=Sáb) para coincidir con el backend.
const WEEKDAYS_UI = [
  { label: 'Lunes', idx: 1 }, { label: 'Martes', idx: 2 }, { label: 'Miércoles', idx: 3 },
  { label: 'Jueves', idx: 4 }, { label: 'Viernes', idx: 5 }, { label: 'Sábado', idx: 6 }, { label: 'Domingo', idx: 0 },
]
const seasonsCatalog = ref<SeasonCat[]>([])
const seasonByDate = ref<Record<string, string>>({})   // date → season.name
const seasonDlg = ref<{ show: boolean; from: string; to: string; weekdays: boolean[] }>({
  show: false, from: '', to: '', weekdays: [true, true, true, true, true, true, true],
})
function seasonMeta(name: string) { return seasonsCatalog.value.find(s => s.name === name) }
function seasonColorFor(dateStr: string) { const n = seasonByDate.value[dateStr]; return n ? (seasonMeta(n)?.color || '#94a3b8') : '' }
function seasonLabelFor(dateStr: string) { const n = seasonByDate.value[dateStr]; return n ? (seasonMeta(n)?.label || n) : '' }
// Tinta la columna de la fecha con el color de su temporada (fondo suave + barra sólida abajo).
function seasonHeaderStyle(dateStr: string) {
  const c = seasonColorFor(dateStr)
  return c ? { backgroundColor: `${c}2e`, boxShadow: `inset 0 -3px 0 ${c}` } : {}
}
async function loadSeasonsCatalog() {
  try { const r = await HotelService.seasons(); seasonsCatalog.value = (r.data || []).map((s: any) => ({ name: s.name, label: s.label || s.name, color: s.color || '#94a3b8' })) } catch { /* sin catálogo */ }
}
async function loadSeasonAssignments() {
  const days = visibleDays.value
  if (!days.length) return
  try {
    const r = await HotelService.seasonAssignments(days[0].dateStr, days[days.length - 1].dateStr)
    const map: Record<string, string> = {}
    for (const it of r.data || []) map[it.date] = it.season
    seasonByDate.value = map
  } catch { /* sin permiso o error: la fila queda sin temporada */ }
}
function openSeasonDialog() {
  const days = visibleDays.value
  seasonDlg.value = { show: true, from: days[0]?.dateStr || '', to: days[days.length - 1]?.dateStr || '', weekdays: [true, true, true, true, true, true, true] }
}
async function applySeason(seasonName: string) {
  const d = seasonDlg.value
  if (!d.from || !d.to || d.to < d.from) { toast.error('Rango de fechas inválido'); return }
  const weekdays = d.weekdays.map((on, i) => on ? i : -1).filter(i => i >= 0)
  try {
    const r = await HotelService.assignSeason({ from: d.from, to: d.to, weekdays, season: seasonName })
    seasonDlg.value.show = false
    await loadSeasonAssignments()
    toast.success(seasonName ? `Temporada asignada (${r.count} día/s)` : `Temporada quitada (${r.count} día/s)`)
  } catch (e: any) { toast.error(e?.message || 'No se pudo asignar la temporada') }
}

// Recargar overrides por fecha (mínimos + temporadas) cuando cambia el rango visible (semana/vista).
watch(() => visibleDays.value.length ? `${visibleDays.value[0].dateStr}|${visibleDays.value[visibleDays.value.length - 1].dateStr}` : '', () => { loadDateRestrictions(); loadSeasonAssignments() })

// Load
onMounted(async () => {
  try { const d = await OperationsService.planning(hid.value); planRooms.value = d.rooms ?? []; planReservas.value = d.reservas ?? [] } catch {}
  loadLocks()
  loadDateRestrictions()
  loadSeasonsCatalog()
  loadSeasonAssignments()
  try { const b = await HotelService.blocks(); planBlocks.value = (b.data ?? []) as any[] } catch {}
  try {
    const s = await HotelService.settings(hid.value)
    const h = (s as any).hotel || {}
    hotelInfo.value = { name: h.name || auth.user?.hotelName || '', address: h.address || '', phone: h.phone || '', email: h.email || '' }
    hotelTaxRate.value = Number(h.taxRate) || 0
    hotelTaxName.value = h.taxName || 'Impuesto'
  } catch {}
  try { const c = await ConfigService.get('channel_colors', hid.value); if (c && typeof c === 'object' && !Array.isArray(c)) channelColors.value = c } catch {}
})
function prevWeek() { weekOffset.value--; lastSel.value = null; popup.value.show = false }
function nextWeek() { weekOffset.value++; lastSel.value = null; popup.value.show = false }
function goToday() { weekOffset.value = 0; lastSel.value = null; popup.value.show = false }
</script>

<style>
/* Cursor consistente durante el arrastre de reservas (mover / extender). */
.planning-dragging-move, .planning-dragging-move * { cursor: move !important; }
.planning-dragging-resize, .planning-dragging-resize * { cursor: ew-resize !important; }
@media screen { .print-only { display: none !important; } }
@media print { .no-print, .screen-only { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }
</style>
