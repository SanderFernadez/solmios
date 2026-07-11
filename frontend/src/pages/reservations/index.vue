<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-black text-navy">Reservas</h1>
        <div class="mt-0.5 flex items-center gap-2.5">
          <p class="text-sm text-text-muted">Gestión de reservaciones del hotel</p>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
            </span>
            En vivo
          </span>
        </div>
      </div>
      <div class="flex gap-2.5">
        <button @click="exportCSV" class="flex items-center gap-2 border border-border bg-white text-text-secondary font-semibold text-sm px-4 py-2.5 rounded-full hover:bg-surface transition-colors cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
          </svg>
          Exportar
        </button>
        <button @click="openNew" class="flex items-center gap-2 bg-navy text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-navy-light transition-colors cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
          </svg>
          Nueva Reserva
        </button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <div v-for="s in statsCards" :key="s.label"
        class="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5">
        <div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl" :style="{ background: s.bg, color: s.accent }">
          <svg v-if="s.icon === 'checkin'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H4.5"/>
          </svg>
          <svg v-else-if="s.icon === 'checkout'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M9 12h12m0 0l-3-3m3 3l-3 3"/>
          </svg>
          <svg v-else-if="s.icon === 'money'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <svg v-else-if="s.icon === 'wallet'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9v.75"/>
          </svg>
          <svg v-else-if="s.icon === 'clock'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <svg v-else-if="s.icon === 'confirmed'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div class="min-w-0">
          <div class="text-xl font-black leading-tight tabular-nums text-navy">{{ s.prefix }}{{ Math.round(s.value).toLocaleString('en-US') }}</div>
          <div class="text-[11px] text-text-secondary font-semibold leading-tight mt-0.5 truncate">{{ s.label }}</div>
          <button v-if="s.link" @click="s.link()" class="mt-1 text-[10px] font-bold text-blue hover:underline cursor-pointer">Ver detalles</button>
          <div v-else-if="s.caption" class="mt-1 text-[10px] font-semibold text-text-muted">{{ s.caption }}</div>
          <div v-else class="mt-1 text-[10px] font-semibold" :class="trendClass(s.trend)">{{ trendLabel(s.trend) }}</div>
        </div>
      </div>
    </div>

    <!-- Filters + Table -->
    <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <!-- Toolbar -->
      <div class="flex items-center gap-3 p-4 border-b border-border flex-wrap">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
          </svg>
          <input v-model="search" type="text" placeholder="Buscar huésped, reserva, correo..." class="pl-9 pr-4 py-2 text-sm rounded-full border border-border bg-surface focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/10 w-64 transition-all" />
        </div>
        <select v-model="filterStatus" class="px-3 py-2 rounded-full border border-border text-xs font-semibold text-text-secondary bg-white cursor-pointer focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/10 transition-all">
          <option value="">Todos los estados</option>
          <option value="confirmed">Confirmadas</option>
          <option value="pending">Pendientes</option>
          <option value="checked_in">Check-in</option>
          <option value="checked_out">Check-out</option>
          <option value="cancelled">Canceladas</option>
        </select>
        <select v-model="filterChannel" class="px-3 py-2 rounded-full border border-border text-xs font-semibold text-text-secondary bg-white cursor-pointer focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/10 transition-all">
          <option value="">Todos los canales</option>
          <option value="direct">Directa</option>
          <option value="booking">Booking</option>
          <option value="expedia">Expedia</option>
          <option value="airbnb">Airbnb</option>
        </select>
        <span class="text-xs text-text-muted ml-auto font-medium">{{ filtered.length }} reservas encontradas</span>
      </div>

      <!-- Table -->
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-surface/50">
            <th class="text-left px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Huésped</th>
            <th class="text-left px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Hab.</th>
            <th class="text-left px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Check-in</th>
            <th class="text-left px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Check-out</th>
            <th class="text-left px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">N</th>
            <th class="text-left px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Estado</th>
            <th class="text-left px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Canal</th>
            <th class="text-right px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Total</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border/40">
          <tr v-for="(r, i) in filtered" :key="r.id"
            class="hover:bg-surface/60 cursor-pointer transition-colors"
            @click="openDetail(r)">
            <td class="px-4 py-5">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0" :class="[avatarStyle(i).bg, avatarStyle(i).text]">
                  {{ (r.guestName || '?').slice(0,1).toUpperCase() }}
                </div>
                <div>
                  <div class="font-bold text-sm text-navy">{{ r.guestName }}</div>
                  <div class="text-[11px] text-text-muted">{{ r.email }}</div>
                </div>
              </div>
            </td>
            <td class="px-4 py-5">
              <span class="text-sm font-bold text-navy">{{ r.roomNumber }}</span>
            </td>
            <td class="px-4 py-5">
              <div class="flex items-baseline gap-1">
                <span class="text-sm font-black text-navy">{{ fmtDay(r.checkIn) }}</span>
                <span class="text-[10px] font-bold text-text-muted uppercase">{{ fmtMonthAbbr(r.checkIn) }}</span>
              </div>
              <div class="text-[10px] text-text-muted capitalize">{{ fmtWeekdayAbbr(r.checkIn) }}</div>
            </td>
            <td class="px-4 py-5">
              <div class="flex items-baseline gap-1">
                <span class="text-sm font-black text-navy">{{ fmtDay(r.checkOut) }}</span>
                <span class="text-[10px] font-bold text-text-muted uppercase">{{ fmtMonthAbbr(r.checkOut) }}</span>
              </div>
              <div class="text-[10px] text-text-muted capitalize">{{ fmtWeekdayAbbr(r.checkOut) }}</div>
            </td>
            <td class="px-4 py-5">
              <span class="text-xs font-bold text-text-secondary">{{ r.nights }}n</span>
            </td>
            <td class="px-4 py-5">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold" :class="stClass(r.status)">
                <span class="h-1.5 w-1.5 rounded-full shrink-0" :class="stDotClass(r.status)"></span>{{ stLabel(r.status) }}
              </span>
            </td>
            <td class="px-4 py-5">
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold" :class="srcClass(r.source)">
                <span class="inline-flex w-3.5 h-3.5 shrink-0" v-html="srcIcon(r.source)"></span>
                {{ srcLabel(r.source) }}
              </span>
            </td>
            <td class="px-4 py-5 text-right">
              <div class="text-sm font-extrabold text-navy">${{ r.total }}</div>
              <div class="text-[9px] font-semibold text-text-muted">USD</div>
            </td>
            <td class="px-4 py-5" @click.stop>
              <div class="flex items-center justify-end gap-1.5">
                <button @click="openDetail(r)" class="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-[10px] font-bold text-text-secondary cursor-pointer hover:bg-surface transition-colors">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.01 9.963 7.183.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.01-9.964-7.178z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  Ver
                </button>
                <button v-if="r.status==='confirmed'" @click="confirmAction('checkin',r)" class="flex items-center gap-1 px-2.5 py-1.5 bg-teal/10 text-teal rounded-lg text-[10px] font-bold cursor-pointer hover:bg-teal/20 transition-colors">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                  </svg>
                  Check-in
                </button>
                <button v-if="r.status==='pending'||r.status==='confirmed'" @click="confirmAction('cancel',r)" class="flex items-center gap-1 px-2.5 py-1.5 bg-coral/10 text-coral rounded-lg text-[10px] font-bold cursor-pointer hover:bg-coral/20 transition-colors">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  Cancelar
                </button>
                <div class="relative">
                  <button @click.stop="openMenuId = openMenuId === r.id ? '' : r.id" class="w-7 h-7 grid place-items-center rounded-lg text-text-muted cursor-pointer hover:bg-surface hover:text-navy transition-colors">⋮</button>
                  <template v-if="openMenuId === r.id">
                    <div class="fixed inset-0 z-20" @click="openMenuId = ''"></div>
                    <div class="absolute right-0 top-8 z-30 w-36 rounded-xl border border-border bg-white shadow-lg py-1 text-left" @click.stop>
                      <button @click="openEdit(r); openMenuId=''" class="w-full text-left px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface cursor-pointer">Editar</button>
                      <button v-if="r.status==='pending'||r.status==='cancelled'" @click="confirmAction('delete',r); openMenuId=''" class="w-full text-left px-3 py-2 text-xs font-semibold text-coral hover:bg-coral/10 cursor-pointer">Eliminar</button>
                    </div>
                  </template>
                </div>
              </div>
            </td>
          </tr>
          <tr v-if="filtered.length === 0">
            <td colspan="9" class="px-4 py-12 text-center">
              <div class="flex flex-col items-center gap-2 text-text-muted">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"/>
                </svg>
                <span class="text-sm font-medium">No hay reservas que coincidan con los filtros</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ═══════════════════════════ MODAL NUEVA RESERVA ═══════════════════════════ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-2xl sm:rounded-[24px] shadow-2xl w-full max-w-5xl max-h-[95vh] sm:max-h-[92vh] overflow-hidden flex flex-col">

            <!-- Header -->
            <div class="p-4 sm:p-6 pb-4 sm:pb-5 shrink-0 bg-gradient-to-r from-navy to-navy/85">
              <div class="flex items-center justify-between gap-3 mb-4 sm:mb-5">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                    <span class="w-4 h-4 sm:w-5 sm:h-5 text-white" v-html="ICON_CALENDAR_PLUS"></span>
                  </div>
                  <div class="min-w-0">
                    <h3 class="text-base sm:text-lg font-black text-white leading-tight truncate">{{ modal.edit ? 'Editar' : 'Nueva' }} Reserva</h3>
                    <p class="text-[10px] sm:text-[11px] text-white/60 truncate">Paso {{ wizardStep }} de {{ WIZARD_STEPS.length }} — {{ WIZARD_STEPS[wizardStep-1].label }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div class="hidden md:flex gap-1.5">
                    <button v-for="s in ['confirmed','pending','checked_in','cancelled']" :key="s" @click="form.status=s"
                      class="px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-pointer transition-all"
                      :class="form.status===s ? stBtnActive(s) : 'border-white/20 text-white/60 hover:text-white'">
                      {{ stLabel(s) }}
                    </button>
                  </div>
                  <button @click="modal.show=false" class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white cursor-pointer hover:bg-white/20 transition-colors shrink-0">
                    <span class="w-4 h-4 block" v-html="ICON_X"></span>
                  </button>
                </div>
              </div>

              <!-- Step indicator -->
              <div class="flex items-center overflow-x-auto">
                <template v-for="(step, i) in WIZARD_STEPS" :key="step.n">
                  <button type="button" @click="goToStep(step.n)" class="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0">
                    <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black transition-all"
                      :class="wizardStep === step.n ? 'bg-cyan text-navy' : wizardStep > step.n ? 'bg-teal text-white' : 'bg-white/10 text-white/50 group-hover:bg-white/20'">
                      <span v-if="wizardStep > step.n" class="w-3.5 h-3.5" v-html="ICON_CHECK"></span>
                      <span v-else>{{ step.n }}</span>
                    </div>
                    <span class="hidden sm:block text-[9px] font-bold uppercase tracking-wide" :class="wizardStep === step.n ? 'text-white' : 'text-white/40'">{{ step.label }}</span>
                  </button>
                  <div v-if="i < WIZARD_STEPS.length - 1" class="w-4 sm:flex-1 h-0.5 mx-1.5 sm:mx-2 sm:mb-4 rounded-full transition-all shrink-0 sm:shrink" :class="wizardStep > step.n ? 'bg-teal' : 'bg-white/15'"></div>
                </template>
              </div>
            </div>

            <!-- Body scrollable -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-6">

              <!-- ═══ PASO 1: HUÉSPED ═══ -->
              <div v-if="wizardStep === 1" class="space-y-4">
                <!-- Buscador de huésped existente -->
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-xl bg-teal/10 text-teal hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_SEARCH"></span></div>
                  <div class="flex-1 min-w-0">
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Buscar huésped existente</label>
                    <div class="relative">
                      <input :value="guestSearch" @input="onGuestSearchInput" type="text" maxlength="100" placeholder="Nombre, documento o email…" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition" @blur="blurGuestSearch" />
                      <ul v-if="guestSearchOpen && guestResults.length" class="absolute z-40 mt-1 w-full max-h-48 overflow-auto bg-white border border-border rounded-xl shadow-lg">
                        <li v-for="g in guestResults" :key="g.id" @mousedown.prevent="selectGuest(g)" class="px-3 py-2 text-sm cursor-pointer hover:bg-teal/10">
                          <div class="font-bold text-navy">{{ g.name }}</div>
                          <div class="text-[11px] text-text-muted">{{ g.document || 'Sin documento' }} · {{ g.email || g.phone || 'Sin contacto' }}</div>
                        </li>
                      </ul>
                    </div>
                    <p v-if="selectedGuestId" class="text-[11px] text-teal mt-1 font-semibold">Huésped existente: se reutiliza (no se crea uno nuevo)</p>
                    <p v-else class="text-[10px] text-text-muted mt-1">Evita duplicar huéspedes ya registrados</p>
                  </div>
                </div>

                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-xl bg-navy/10 text-navy hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_USER"></span></div>
                  <div class="flex-1 min-w-0">
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Nombre completo <span class="text-coral">*</span></label>
                    <input v-model="form.name" type="text" maxlength="80" placeholder="Nombre y apellido" class="w-full px-3.5 py-2.5 rounded-xl border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 transition" :class="nameError ? 'border-coral ring-2 ring-coral/20' : 'border-border focus:ring-navy/20 focus:border-navy'" />
                    <p v-if="nameError" class="text-[10px] text-coral font-semibold mt-1">{{ nameError }}</p>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-cyan/10 text-cyan hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_MAIL"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Email <span class="text-coral">*</span></label>
                      <input v-model="form.email" type="email" maxlength="100" placeholder="correo@ejemplo.com" class="w-full px-3.5 py-2.5 rounded-xl border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 transition" :class="(contactError || emailError) ? 'border-coral ring-2 ring-coral/20' : 'border-border focus:ring-cyan/20 focus:border-cyan'" />
                      <p v-if="emailError" class="text-[10px] text-coral font-semibold mt-1">{{ emailError }}</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-purple/10 text-purple hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_PHONE"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Teléfono <span class="text-coral">*</span></label>
                      <input v-model="form.phone" type="tel" maxlength="20" placeholder="+1 809 000 0000" class="w-full px-3.5 py-2.5 rounded-xl border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 transition" :class="contactError ? 'border-coral ring-2 ring-coral/20' : 'border-border focus:ring-purple/20 focus:border-purple'" />
                    </div>
                  </div>
                  <p v-if="contactError" class="sm:col-span-2 text-[10px] text-coral font-semibold -mt-2">{{ contactError }}</p>
                  <p v-else class="sm:col-span-2 text-[10px] text-text-muted -mt-2">* Se requiere al menos un email o teléfono de contacto</p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gold/10 text-gold hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_GLOBE"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">País</label>
                      <SearchSelect v-model="form.country" :options="countries" placeholder="Buscar..." />
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-coral/10 text-coral hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_FLAG"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Nacionalidad</label>
                      <SearchSelect v-model="form.nationality" :options="nationalities" placeholder="Buscar..." />
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue/10 text-blue hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_LANGUAGE"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Idioma</label>
                      <select v-model="form.language" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition">
                        <option v-for="l in languages" :key="l.v" :value="l.v">{{ l.l }}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ═══ PASO 2: DETALLES ═══ -->
              <div v-if="wizardStep === 2" class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-cyan/10 text-cyan hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_MAP_PIN"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Dirección</label>
                      <input v-model="form.address" type="text" maxlength="150" placeholder="Calle, número..." class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan transition" />
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-teal/10 text-teal hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_BUILDING"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Ciudad</label>
                      <input v-model="form.city" type="text" maxlength="60" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition" />
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-purple/10 text-purple hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_MAP"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Provincia</label>
                      <input v-model="form.province" type="text" maxlength="60" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple transition" />
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gold/10 text-gold hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_USERS"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Sexo</label>
                      <select v-model="form.sex" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition">
                        <option value="">—</option>
                        <option value="male">Masculino</option>
                        <option value="female">Femenino</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-coral/10 text-coral hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_CAKE"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Nacimiento</label>
                      <input v-model="form.birthDate" type="date" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition" />
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-navy/10 text-navy hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_ID"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Tipo documento</label>
                      <select v-model="form.documentType" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition">
                        <option v-for="d in docTypes" :key="d.v" :value="d.v">{{ d.l }}</option>
                      </select>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue/10 text-blue hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_HASH"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">N° documento</label>
                      <input v-model="form.document" type="text" maxlength="30" placeholder="000-0000000-0" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition" />
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-purple/10 text-purple hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_CALENDAR"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Exp. documento</label>
                      <input v-model="form.documentIssueDate" type="date" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple transition" />
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-teal/10 text-teal hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_SEND"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Comunicar al cliente</label>
                      <select v-model="form.communicateClient" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition">
                        <option value="none">No enviar bono</option>
                        <option value="email_confirmation">Enviar email de confirmación</option>
                        <option value="email_presaless">Enviar email preventa</option>
                      </select>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-navy/10 text-navy hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_NOTE"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Observaciones</label>
                      <input v-model="form.guestNotes" type="text" maxlength="300" placeholder="Notas para el bono..." class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                    </div>
                  </div>
                </div>

                <!-- Acompañantes -->
                <div class="pt-3 border-t border-border">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="w-4 h-4 text-navy" v-html="ICON_USERS"></span>
                    <h4 class="text-[11px] font-black text-navy uppercase tracking-wide">Acompañantes</h4>
                    <button type="button" @click="addCompanion" class="ml-auto text-[11px] font-bold text-cyan hover:underline cursor-pointer">+ agregar</button>
                  </div>
                  <p v-if="!form.companions.length" class="text-[11px] text-text-muted italic">Sin acompañantes adicionales</p>
                  <div v-for="(c, i) in form.companions" :key="i" class="grid grid-cols-2 sm:grid-cols-12 gap-2 mb-2 items-center">
                    <input v-model="c.name" type="text" maxlength="80" placeholder="Nombre completo" class="col-span-2 sm:col-span-5 px-3 py-2 rounded-full border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                    <select v-model="c.documentType" class="col-span-1 sm:col-span-3 px-2 py-2 rounded-full border border-border text-xs bg-surface/60 cursor-pointer">
                      <option value="dni">DNI</option><option value="passport">Pasaporte</option><option value="other">Otro</option>
                    </select>
                    <input v-model="c.documentNumber" type="text" maxlength="30" placeholder="N° documento" class="col-span-1 sm:col-span-3 px-2 py-2 rounded-full border border-border text-xs bg-surface/60" />
                    <button type="button" @click="removeCompanion(i)" class="col-span-2 sm:col-span-1 flex items-center justify-center w-6 h-6 mx-auto text-coral hover:bg-coral/10 rounded-full cursor-pointer" v-html="ICON_X"></button>
                  </div>
                </div>

                <!-- OTA (condicional) -->
                <div v-if="form.source!=='direct'" class="pt-3 border-t border-border">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="w-4 h-4 text-navy" v-html="ICON_GLOBE"></span>
                    <h4 class="text-[11px] font-black text-navy uppercase tracking-wide">Datos del Canal</h4>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-xl bg-gold/10 text-gold hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_PERCENT"></span></div>
                      <div class="flex-1 min-w-0">
                        <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Comisión (%)</label>
                        <input v-model.number="form.commission" type="number" min="0" max="50" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white transition" />
                      </div>
                    </div>
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-xl bg-cyan/10 text-cyan hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_LINK"></span></div>
                      <div class="flex-1 min-w-0">
                        <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Locator OTA</label>
                        <input v-model="form.extLocator" type="text" maxlength="50" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white transition" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ═══ PASO 3: EMERGENCIA ═══ -->
              <div v-if="wizardStep === 3" class="space-y-4">
                <div class="flex items-center gap-2 mb-1">
                  <span class="w-4 h-4 text-coral" v-html="ICON_ALERT"></span>
                  <h4 class="text-[11px] font-black text-coral uppercase tracking-wide">Contacto de Emergencia</h4>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-coral/10 text-coral hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_USER"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Nombre completo</label>
                      <input v-model="form.emergencyName" type="text" maxlength="80" placeholder="Contacto de emergencia" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition" />
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gold/10 text-gold hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_PHONE"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Teléfono</label>
                      <input v-model="form.emergencyPhone" type="tel" maxlength="20" placeholder="+1 809 000 0000" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition" />
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-purple/10 text-purple hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_HEART"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Parentesco</label>
                      <select v-model="form.emergencyRelation" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple transition">
                        <option value="">Seleccionar...</option>
                        <option v-for="r in relations" :key="r" :value="r">{{ r }}</option>
                      </select>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-cyan/10 text-cyan hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_MAIL"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Email <span class="text-text-muted font-normal normal-case">(opcional)</span></label>
                      <input v-model="form.emergencyEmail" type="email" maxlength="100" placeholder="contacto@ejemplo.com" class="w-full px-3.5 py-2.5 rounded-xl border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 transition" :class="emergencyEmailFormatError ? 'border-coral ring-2 ring-coral/20' : 'border-border focus:ring-cyan/20 focus:border-cyan'" />
                      <p v-if="emergencyEmailFormatError" class="text-[10px] text-coral font-semibold mt-1">{{ emergencyEmailFormatError }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ═══ PASO 4: ALOJAMIENTO ═══ -->
              <div v-if="wizardStep === 4" class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-teal/10 text-teal hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_CALENDAR"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Check-in <span class="text-coral">*</span></label>
                      <input v-model="form.checkIn" type="date" class="w-full px-3.5 py-2.5 rounded-xl border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 transition" :class="checkInError ? 'border-coral ring-2 ring-coral/20' : 'border-border focus:ring-teal/20 focus:border-teal'" />
                      <p v-if="checkInError" class="text-[10px] text-coral font-semibold mt-1">{{ checkInError }}</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-coral/10 text-coral hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_CALENDAR"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Check-out <span class="text-coral">*</span></label>
                      <input v-model="form.checkOut" type="date" class="w-full px-3.5 py-2.5 rounded-xl border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 transition" :class="checkOutError ? 'border-coral ring-2 ring-coral/20' : 'border-border focus:ring-coral/20 focus:border-coral'" />
                      <p v-if="checkOutError" class="text-[10px] text-coral font-semibold mt-1">{{ checkOutError }}</p>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-navy/10 text-navy hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_BED"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Habitación <span class="text-coral">*</span></label>
                      <SearchSelect v-model="form.roomId" :options="roomOptions" placeholder="Seleccionar..." />
                      <p v-if="roomError" class="text-[10px] text-coral font-semibold mt-1">{{ roomError }}</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-purple/10 text-purple hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_UTENSILS"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Régimen</label>
                      <select v-model="form.regime" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple transition">
                        <option value="room_only">Solo alojamiento</option>
                        <option value="breakfast">Desayuno incluido</option>
                        <option value="half_board">Media pensión</option>
                        <option value="full_board">Pensión completa</option>
                        <option value="all_inclusive">Todo incluido</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-cyan/10 text-cyan hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_USER"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Adultos</label>
                      <input v-model.number="form.adults" type="number" min="1" max="10" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan transition" />
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gold/10 text-gold hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_USERS"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Niños</label>
                      <input v-model.number="form.children" type="number" min="0" max="10" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition" />
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-navy/10 text-navy hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_MOON"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Noches</label>
                      <div class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface font-bold text-navy">{{ nights }}</div>
                    </div>
                  </div>
                </div>

                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-xl bg-teal/10 text-teal hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_TAG"></span></div>
                  <div class="flex-1 min-w-0">
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Código promocional</label>
                    <input v-model="form.promoCode" type="text" maxlength="30" placeholder="Opcional" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition" />
                  </div>
                </div>

                <!-- Resumen precio -->
                <div v-if="selRoom && form.checkIn && form.checkOut" class="bg-surface rounded-2xl p-4 space-y-2">
                  <div class="text-[11px] font-bold text-text-muted uppercase mb-2">Habitación {{ selRoom.number }} — {{ selRoom.type }}</div>
                  <div class="flex justify-between text-sm"><span class="text-text-secondary">{{ nights }} noches × ${{ selRoom.basePrice }}</span><span class="font-bold text-navy">${{ selRoom.basePrice * nights }}</span></div>
                  <div class="flex justify-between text-sm"><span class="text-text-secondary">Impuestos (10%)</span><span class="font-bold text-navy">${{ taxes }}</span></div>
                  <div v-if="form.regime !== 'room_only'" class="flex justify-between text-sm"><span class="text-text-secondary">Régimen</span><span class="font-bold text-teal">{{ regimeLabel }}</span></div>
                </div>
              </div>

              <!-- ═══ PASO 5: PAGO ═══ -->
              <div v-if="wizardStep === 5" class="space-y-4">
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-xl bg-navy/10 text-navy hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_WALLET"></span></div>
                  <div class="flex-1 min-w-0">
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Método de pago</label>
                    <select v-model="form.payMethod" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition">
                      <option value="transfer">Transferencia</option>
                      <option value="card">Tarjeta</option>
                      <option value="cash">Efectivo</option>
                      <option value="link">Link de pago</option>
                    </select>
                  </div>
                </div>

                <!-- Tarjeta de garantía -->
                <div class="pt-3 border-t border-border">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="w-4 h-4 text-purple" v-html="ICON_LOCK"></span>
                    <h4 class="text-[11px] font-black text-purple uppercase tracking-wide">Tarjeta de garantía</h4>
                  </div>
                  <div v-if="existingGuarantee" class="mb-3 rounded-xl bg-navy/5 border border-navy/15 px-3 py-2 text-[11px] leading-relaxed text-navy">
                    Ya hay una tarjeta de garantía cargada. Para verla abrí <strong>Ver reserva</strong> e ingresá el PIN. Ingresá una nueva tarjeta acá solo si querés <strong>reemplazarla</strong>.
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-xl bg-purple/10 text-purple hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_USER"></span></div>
                      <div class="flex-1 min-w-0">
                        <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Titular de la tarjeta</label>
                        <input v-model="form.cardHolder" type="text" maxlength="80" placeholder="Nombre como aparece en la tarjeta" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple transition" />
                      </div>
                    </div>
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-xl bg-gold/10 text-gold hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_CARD"></span></div>
                      <div class="flex-1 min-w-0">
                        <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Tipo</label>
                        <select v-model="form.cardBrand" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition">
                          <option value="visa">Visa</option>
                          <option value="mastercard">Mastercard</option>
                          <option value="amex">Amex</option>
                          <option value="discover">Discover</option>
                          <option value="other">Otra</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-xl bg-navy/10 text-navy hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_CARD"></span></div>
                      <div class="flex-1 min-w-0">
                        <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">N° tarjeta</label>
                        <input v-model="form.cardNumber" type="text" maxlength="19" placeholder="XXXX XXXX XXXX XXXX" @input="formatCardNumber" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm font-mono bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                      </div>
                    </div>
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-xl bg-coral/10 text-coral hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_LOCK"></span></div>
                      <div class="flex-1 min-w-0">
                        <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">CVV</label>
                        <input v-model="form.cardCvv" type="text" maxlength="4" placeholder="XXX" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm font-mono bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition" />
                      </div>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-purple/10 text-purple hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_CALENDAR"></span></div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Caducidad</label>
                      <input v-model="form.cardExpiry" @input="formatExpiry" type="text" inputmode="numeric" maxlength="7" placeholder="MM/AAAA" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm font-mono bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple transition" />
                    </div>
                  </div>
                </div>

                <!-- Anticipo -->
                <div class="pt-3 border-t border-border">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="w-4 h-4 text-teal" v-html="ICON_PERCENT"></span>
                    <h4 class="text-[11px] font-black text-teal uppercase tracking-wide">Anticipo y total</h4>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-xl bg-teal/10 text-teal hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_PERCENT"></span></div>
                      <div class="flex-1 min-w-0">
                        <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">% de anticipo</label>
                        <input v-model.number="form.depositPercentage" type="number" min="0" max="100" @input="calcDepositFromPercentage" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition" />
                      </div>
                    </div>
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-xl bg-gold/10 text-gold hidden sm:flex items-center justify-center shrink-0"><span class="w-5 h-5" v-html="ICON_WALLET"></span></div>
                      <div class="flex-1 min-w-0">
                        <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Estado</label>
                        <select v-model="form.depositStatus" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition">
                          <option value="unpaid">Sin pagar</option>
                          <option value="partial">Parcial</option>
                          <option value="paid">Pagado</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div v-if="selRoom && form.checkIn && form.checkOut" class="bg-surface rounded-2xl border border-border p-4 space-y-1.5 text-sm">
                    <div class="flex justify-between"><span class="text-text-secondary">{{ nights }} noches × ${{ selRoom.basePrice }}</span><span class="font-bold text-navy">${{ subtotal }}</span></div>
                    <div class="flex justify-between"><span class="text-text-secondary">Impuestos (10%)</span><span class="font-bold text-navy">${{ taxes }}</span></div>
                    <div class="border-t border-border pt-1.5 flex justify-between items-center">
                      <span class="font-black text-navy">Total Reserva</span>
                      <span class="font-black text-navy text-lg">${{ total }}</span>
                    </div>
                    <div class="flex justify-between"><span class="text-text-secondary">Anticipo ({{ form.depositPercentage }}%)</span><span class="font-bold text-teal">${{ form.deposit }}</span></div>
                    <div class="flex justify-between"><span class="text-text-secondary">Pendiente de pago</span><span class="font-black" :class="pend > 0 ? 'text-coral' : 'text-teal'">${{ pend }}</span></div>
                  </div>
                  <div v-else class="text-xs text-text-muted text-center py-3">Seleccioná habitación y fechas para ver el desglose</div>
                </div>

                <!-- Cerradura (solo edición) -->
                <div v-if="editId" class="pt-3 border-t border-border">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <span class="w-4 h-4 text-cyan" v-html="ICON_KEY"></span>
                      <span class="text-[11px] font-black text-navy uppercase tracking-wide">Cerradura</span>
                    </div>
                    <button @click="generateLockCode" class="text-xs font-bold text-teal hover:underline cursor-pointer">
                      {{ lockCode ? 'Regenerar' : '+ Generar código' }}
                    </button>
                  </div>
                  <div v-if="lockCode" class="text-center py-3 bg-surface rounded-2xl border-2 border-dashed border-teal">
                    <div class="text-[10px] font-bold text-text-muted uppercase">Código de acceso</div>
                    <div class="text-2xl font-black text-teal tracking-wider mt-1">{{ lockCode }}</div>
                  </div>
                  <div v-else class="text-xs text-text-muted text-center py-2">Sin código generado</div>
                </div>
              </div>
            </div>

            <!-- Error de validación / disponibilidad (visible para el usuario) -->
            <div v-if="err" class="px-4 py-3 bg-coral/10 border-t border-b border-coral/30 text-sm font-bold text-coral flex items-center gap-2 shrink-0">
              <span class="w-4 h-4 shrink-0" v-html="ICON_ALERT"></span><span>{{ err }}</span>
            </div>

            <!-- Footer -->
            <div class="p-4 sm:p-5 border-t border-border shrink-0 flex flex-wrap items-center justify-between gap-3">
              <div class="text-sm font-extrabold text-navy">Total: <span class="text-xl text-navy">${{ total }}</span></div>
              <div class="flex items-center gap-3 sm:gap-4 flex-wrap">
                <button @click="modal.show=false" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button v-if="wizardStep > 1" @click="wizardStep--" class="px-4 py-2 border border-border rounded-full text-[11px] font-bold text-text-secondary hover:border-navy/30 transition-all cursor-pointer">Atrás</button>
                <button v-if="wizardStep < WIZARD_STEPS.length" @click="goNextStep" class="px-5 py-2.5 bg-navy text-white rounded-full text-sm font-black cursor-pointer hover:shadow-lg transition-all">Siguiente</button>
                <button v-else @click="save" :disabled="saving" class="px-6 py-2.5 bg-teal text-white rounded-full text-sm font-black cursor-pointer hover:opacity-90 disabled:opacity-50 transition-all">
                  {{ saving ? 'Guardando...' : (modal.edit ? 'Actualizar Reserva' : 'Crear Reserva') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Confirm Dialog -->
    <Teleport to="body">
      <div v-if="cfg.show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
          <div class="text-3xl mb-3">{{ cfg.icon }}</div>
          <h3 class="text-lg font-black text-navy mb-2">{{ cfg.title }}</h3>
          <p class="text-sm text-text-secondary">{{ cfg.msg }}</p>
          <div class="flex items-center justify-center gap-4 mt-6">
            <button @click="cfg.show=false" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
            <button @click="cfg.fn();cfg.show=false" class="rounded-full px-5 py-2.5 text-sm font-extrabold text-white cursor-pointer" :class="cfg.btn">Confirmar</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ═══ Vista de DETALLE (F3 match-misterplan) ═══ -->
    <ReservationModal
      v-if="detailId"
      :reservation-id="detailId"
      @close="detailId = ''"
      @edit="onEditDetail"
      @changed="load"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCountUp } from '@/composables/useCountUp'
import { ReservationService } from '@/services/Reservation.service'
import { CompanionsService } from '@/services/Companions.service'
import ReservationModal from '@/components/features/ReservationModal.vue'
import SearchSelect from '@/components/ui/SearchSelect.vue'
import { COUNTRIES, NATIONALITIES, LANGUAGES, DOC_TYPES } from '@/data/locales'
import type { Guest } from '@/types'
import { PaymentsService } from '@/services/Payments.service'
import { TTLockService } from '@/services/TTLock.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { useRoute, useRouter } from 'vue-router'
import { http } from '@/services/http'

// ── Wizard (modal Nueva/Editar Reserva) ──
const WIZARD_STEPS = [
  { n: 1, label: 'Huésped' },
  { n: 2, label: 'Detalles' },
  { n: 3, label: 'Emergencia' },
  { n: 4, label: 'Alojamiento' },
  { n: 5, label: 'Pago' },
]
const wizardStep = ref(1)

const SVG_OPEN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
const ICON_X = `${SVG_OPEN}<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
const ICON_CHECK = `${SVG_OPEN}<path d="M20 6 9 17l-5-5"/></svg>`
const ICON_CALENDAR_PLUS = `${SVG_OPEN}<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M12 14v6"/><path d="M9 17h6"/></svg>`
const ICON_SEARCH = `${SVG_OPEN}<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`
const ICON_USER = `${SVG_OPEN}<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
const ICON_MAIL = `${SVG_OPEN}<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`
const ICON_PHONE = `${SVG_OPEN}<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg>`
const ICON_GLOBE = `${SVG_OPEN}<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`
const ICON_FLAG = `${SVG_OPEN}<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 8 2a6 6 0 0 0 3.6-1.2A1 1 0 0 1 21 3.6v10.8a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.5"/></svg>`
const ICON_LANGUAGE = `${SVG_OPEN}<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`
const ICON_MAP_PIN = `${SVG_OPEN}<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`
const ICON_BUILDING = `${SVG_OPEN}<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`
const ICON_MAP = `${SVG_OPEN}<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M9 4v13"/><path d="M15 7v13"/></svg>`
const ICON_CAKE = `${SVG_OPEN}<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>`
const ICON_ID = `${SVG_OPEN}<rect width="18" height="14" x="3" y="5" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2"/><path d="M15 12h2"/><path d="M7 16h10"/></svg>`
const ICON_HASH = `${SVG_OPEN}<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>`
const ICON_CALENDAR = `${SVG_OPEN}<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/></svg>`
const ICON_SEND = `${SVG_OPEN}<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`
const ICON_NOTE = `${SVG_OPEN}<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`
const ICON_ALERT = `${SVG_OPEN}<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`
const ICON_HEART = `${SVG_OPEN}<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`
const ICON_USERS = `${SVG_OPEN}<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
const ICON_PERCENT = `${SVG_OPEN}<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`
const ICON_LINK = `${SVG_OPEN}<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
const ICON_BED = `${SVG_OPEN}<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`
const ICON_UTENSILS = `${SVG_OPEN}<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`
const ICON_MOON = `${SVG_OPEN}<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`
const ICON_TAG = `${SVG_OPEN}<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`
const ICON_WALLET = `${SVG_OPEN}<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>`
const ICON_LOCK = `${SVG_OPEN}<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
const ICON_CARD = `${SVG_OPEN}<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`
const ICON_KEY = `${SVG_OPEN}<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4a5 5 0 1 0-7 7l1 1"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>`

const auth = useAuthStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const hid = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

// ── State ──
const search = ref('')
const filterStatus = ref('')
const filterChannel = ref('')
const list = ref<any[]>([])
const rooms = ref<any[]>([])
const saving = ref(false)
const err = ref('')
const editId = ref('')
const modal = ref({ show: false, edit: false })
const lockCode = ref('')
// Detalle (F3): clic en fila abre ReservationModal (vista lectura), no el form directo.
const detailId = ref('')
const lastRow = ref<Record<string, unknown> | null>(null)
// Tarjeta de garantía existente al editar (bandera; los datos no se exponen sin PIN).
const existingGuarantee = ref(false)
const cfg = ref({ show: false, icon: '', title: '', msg: '', btn: '', fn: () => {} })
// Menú contextual (⋮) de la fila abierta en la tabla de reservas
const openMenuId = ref('')

const MS_PER_DAY = 86_400_000

// ── Form completo ──
const form = ref({
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
  checkIn: '', checkOut: '', roomId: '', adults: 2, children: 0,
  regime: 'room_only', promoCode: '',
  // Canal / OTA
  source: 'direct', commission: 0, commissionAmount: 0, extLocator: '', otaNotes: '',
  // Tarjeta
  cardHolder: '', cardBrand: 'visa', cardNumber: '', cardCvv: '', cardExpMonth: '', cardExpYear: '', cardExpiry: '',
  // Anticipo / Pago
  depositPercentage: 100, deposit: 0, depositStatus: 'unpaid', payMethod: 'transfer',
  // Otros
  status: 'pending', notes: '', autoSendEnabled: true,
  companions: [] as { id?: string; name: string; documentNumber: string; documentType?: string; nationality?: string }[],
})

// ── Datos para dropdowns ──
const languages = LANGUAGES

const countries = COUNTRIES
const nationalities = NATIONALITIES

const docTypes = DOC_TYPES

const relations = ['Familiar', 'Amigo/a', 'Empleado/a', 'Agente de viajes', 'Otro']

// ── Computed ──
const today = new Date().toISOString().split('T')[0]
const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })()

// Fuentes numéricas de cada KPI — separadas de statsCards para poder animarlas con useCountUp
// (el composable debe llamarse en el cuerpo de setup, no dentro del computed que arma las cards).
const checkinsTodayCount = computed(() => list.value.filter((r: any) => r.checkIn === today && (r.status === 'confirmed' || r.status === 'checked_in')).length)
const checkoutsTodayCount = computed(() => list.value.filter((r: any) => r.checkOut === today && r.status === 'checked_in').length)
const revenueTodayAmount = computed(() => list.value.filter((r: any) => r.checkIn === today).reduce((s: number, r: any) => s + (r.total || 0), 0))
const totalBilledAmount = computed(() => list.value.filter((r: any) => r.status !== 'cancelled').reduce((s: number, r: any) => s + (r.total || 0), 0))
const pendingCount = computed(() => list.value.filter((r: any) => r.status === 'pending').length)
const confirmedCount = computed(() => list.value.filter((r: any) => r.status === 'confirmed').length)

// "vs ayer": mismas métricas de check-in/out/ingresos pero con fecha de ayer — ya tenemos
// todas las reservas cargadas en `list`, no hace falta pedir un histórico aparte.
const checkinsYesterdayCount = computed(() => list.value.filter((r: any) => r.checkIn === yesterday && r.status !== 'cancelled').length)
const checkoutsYesterdayCount = computed(() => list.value.filter((r: any) => r.checkOut === yesterday && r.status !== 'cancelled').length)
const revenueYesterdayAmount = computed(() => list.value.filter((r: any) => r.checkIn === yesterday).reduce((s: number, r: any) => s + (r.total || 0), 0))

function pctChange(cur: number, prev: number) {
  if (!prev) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}
const checkinsTrend = computed(() => pctChange(checkinsTodayCount.value, checkinsYesterdayCount.value))
const checkoutsTrend = computed(() => pctChange(checkoutsTodayCount.value, checkoutsYesterdayCount.value))
const revenueTrend = computed(() => pctChange(revenueTodayAmount.value, revenueYesterdayAmount.value))

const checkinsAnim = useCountUp(checkinsTodayCount)
const checkoutsAnim = useCountUp(checkoutsTodayCount)
const revenueAnim = useCountUp(revenueTodayAmount)
const totalBilledAnim = useCountUp(totalBilledAmount)
const pendingAnim = useCountUp(pendingCount)
const confirmedAnim = useCountUp(confirmedCount)

function setStatusFilter(status: string) { filterStatus.value = status }

const statsCards = computed(() => [
  { label: 'Check-ins Hoy', value: checkinsAnim.value, icon: 'checkin', bg: '#DBEAFE', accent: '#1D67E3', trend: checkinsTrend.value },
  { label: 'Check-outs Hoy', value: checkoutsAnim.value, icon: 'checkout', bg: '#FEE2E2', accent: '#EF4444', trend: checkoutsTrend.value },
  { label: 'Ingresos Hoy', value: revenueAnim.value, prefix: '$', icon: 'money', bg: '#D1FAE5', accent: '#10B981', trend: revenueTrend.value },
  { label: 'Total Facturado', value: totalBilledAnim.value, prefix: '$', icon: 'wallet', bg: '#EDE9FE', accent: '#6C3483', caption: 'Acumulado' },
  { label: 'Pendientes', value: pendingAnim.value, icon: 'clock', bg: '#FEF3C7', accent: '#F59E0B', link: () => setStatusFilter('pending') },
  { label: 'Confirmadas', value: confirmedAnim.value, icon: 'confirmed', bg: '#CFFAFE', accent: '#00B4D8', link: () => setStatusFilter('confirmed') },
])

const filtered = computed(() => {
  let l = list.value
  if (search.value) { const q = search.value.toLowerCase(); l = l.filter((r: any) => (r.guestName || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q)) }
  if (filterStatus.value) l = l.filter((r: any) => r.status === filterStatus.value)
  if (filterChannel.value) l = l.filter((r: any) => r.source === filterChannel.value)
  return l
})

const selRoom = computed(() => rooms.value.find((r: any) => r.id === form.value.roomId))
// Opciones del selector de habitación (buscador dinámico): value=id, label='número — tipo ($precio/n)'.
const roomOptions = computed(() => rooms.value.map((r: any) => ({ value: String(r.id), label: `${r.number} — ${r.type} ($${r.basePrice}/n)` })))
const nights = computed(() => {
  if (!form.value.checkIn || !form.value.checkOut) return 0
  return Math.max(1, Math.round((new Date(form.value.checkOut).getTime() - new Date(form.value.checkIn).getTime()) / MS_PER_DAY))
})
const subtotal = computed(() => selRoom.value ? selRoom.value.basePrice * nights.value : 0)
const taxes = computed(() => Math.round(subtotal.value * 0.1))
const total = computed(() => subtotal.value + taxes.value)
const pend = computed(() => Math.max(0, total.value - (form.value.deposit || 0)))

// ── Validación del wizard ──
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const step1Attempted = ref(false)
const step4Attempted = ref(false)

const emailFormatError = computed(() => {
  const e = form.value.email.trim()
  if (!e) return ''
  return EMAIL_RE.test(e) ? '' : 'Formato de email inválido'
})
const emergencyEmailFormatError = computed(() => {
  const e = form.value.emergencyEmail.trim()
  if (!e) return ''
  return EMAIL_RE.test(e) ? '' : 'Formato de email inválido'
})
const nameError = computed(() => step1Attempted.value && !form.value.name.trim() ? 'El nombre es obligatorio' : '')
const contactError = computed(() => step1Attempted.value && !form.value.email.trim() && !form.value.phone.trim() ? 'Ingresá al menos un email o teléfono' : '')
const emailError = computed(() => step1Attempted.value ? emailFormatError.value : '')

const roomError = computed(() => step4Attempted.value && !form.value.roomId ? 'Seleccioná una habitación' : '')
const checkInError = computed(() => step4Attempted.value && !form.value.checkIn ? 'Seleccioná la fecha de check-in' : '')
const checkOutError = computed(() => {
  if (!step4Attempted.value) return ''
  if (!form.value.checkOut) return 'Seleccioná la fecha de check-out'
  if (form.value.checkIn && form.value.checkOut <= form.value.checkIn) return 'Debe ser posterior al check-in'
  return ''
})

function isStep1Valid() {
  return !!form.value.name.trim() && (!!form.value.email.trim() || !!form.value.phone.trim()) && !emailFormatError.value
}
function isStep4Valid() {
  return !!form.value.roomId && !!form.value.checkIn && !!form.value.checkOut && form.value.checkOut > form.value.checkIn
}

function goToStep(n: number) {
  if (n <= wizardStep.value) { wizardStep.value = n; return }
  if (n > 1) {
    step1Attempted.value = true
    if (!isStep1Valid()) { toast.error('Completá los campos obligatorios de Huésped'); return }
  }
  if (n > 4) {
    step4Attempted.value = true
    if (!isStep4Valid()) { toast.error('Completá los campos obligatorios de Alojamiento'); return }
  }
  wizardStep.value = n
}

function goNextStep() {
  if (wizardStep.value < WIZARD_STEPS.length) goToStep(wizardStep.value + 1)
}

const regimeLabel = computed(() => {
  const m: Record<string, string> = {
    room_only: 'Sólo alojamiento', breakfast: 'Desayuno incluido',
    half_board: 'Media pensión', full_board: 'Pensión completa', all_inclusive: 'Todo incluido',
  }
  return m[form.value.regime] || form.value.regime
})

// ── Helpers ──
function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) }
function fmtDay(d: string) { return d ? new Date(d + 'T12:00:00').getDate() : '--' }
function fmtMonthAbbr(d: string) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') : '' }
function fmtWeekdayAbbr(d: string) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '') : '' }
function stLabel(s: string) { const m: any = { pending: 'Pendiente', confirmed: 'Confirmada', checked_in: 'Check-in', checked_out: 'Check-out', cancelled: 'Cancelada' }; return m[s] || s }
function stClass(s: string) { const m: any = { pending: 'bg-gold/10 text-gold', confirmed: 'bg-teal/10 text-teal', checked_in: 'bg-cyan/10 text-cyan', checked_out: 'bg-gray-100 text-gray-500', cancelled: 'bg-coral/10 text-coral' }; return m[s] || '' }
function stDotClass(s: string) { const m: any = { pending: 'bg-gold', confirmed: 'bg-teal', checked_in: 'bg-cyan', checked_out: 'bg-gray-400', cancelled: 'bg-coral' }; return m[s] || 'bg-gray-400' }
function stBtnActive(s: string) { const m: any = { pending: 'border-gold bg-gold text-white', confirmed: 'border-blue-500 bg-blue-500 text-white', checked_in: 'border-teal bg-teal text-white', cancelled: 'border-coral bg-coral text-white' }; return m[s] || '' }
function srcLabel(s: string) { const m: any = { direct: 'Directa', booking: 'Booking', expedia: 'Expedia', airbnb: 'Airbnb', google: 'Google', whatsapp: 'WhatsApp', phone: 'Teléfono' }; return m[s] || s }
function srcClass(s: string) { const m: any = { direct: 'bg-teal/10 text-teal', booking: 'bg-cyan/10 text-cyan', expedia: 'bg-gold/10 text-gold', airbnb: 'bg-coral/10 text-coral', google: 'bg-blue-100 text-blue-700', whatsapp: 'bg-emerald-100 text-emerald-700' }; return m[s] || 'bg-gray-100 text-gray-500' }

// Iconos de canal — logos reales de marca (mismo SVG que la sección #integrations del
// landing, frontend/src/pages/landing/index.vue) para las OTAs; ícono genérico de línea
// (currentColor) solo para canales sin marca propia (directa, teléfono) o sin asset
// verificado en el repo (Google — no se inventa un logo de marca no auditado).
const SRC_ICON_SVG: Record<string, string> = {
  direct: '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/></svg>',
  booking: '<svg class="w-full h-full" viewBox="0 0 24 24" fill="#003A9A"><path d="M24 0H0v24h24ZM8.575 6.563h2.658c2.108 0 3.473 1.15 3.473 2.898 0 1.15-.575 1.82-.91 2.108l-.287.263.335.192c.815.479 1.318 1.389 1.318 2.395 0 1.988-1.51 3.257-3.857 3.257H7.449V7.713c0-.623.503-1.126 1.126-1.15zm1.7 1.868c-.479.024-.694.264-.694.79v1.893h1.676c.958 0 1.294-.743 1.294-1.365 0-.815-.503-1.318-1.318-1.318zm-.096 4.36c-.407.071-.598.31-.598.79v2.251h1.868c.934 0 1.509-.55 1.509-1.533 0-.934-.599-1.509-1.51-1.509zm7.737 2.394c.743 0 1.341.599 1.341 1.342a1.34 1.34 0 0 1-1.341 1.341 1.355 1.355 0 0 1-1.341-1.341c0-.743.598-1.342 1.34-1.342z"/></svg>',
  expedia: '<svg class="w-full h-full" viewBox="0 0 24 24" fill="#191E3B"><path d="M19.067 0H4.933A4.94 4.94 0 0 0 0 4.933v14.134A4.932 4.932 0 0 0 4.933 24h14.134A4.932 4.932 0 0 0 24 19.067V4.933C24.01 2.213 21.797 0 19.067 0ZM7.336 19.341c0 .19-.148.337-.337.337h-2.33a.333.333 0 0 1-.337-.337v-2.33c0-.189.148-.336.337-.336H7c.19 0 .337.147.337.337zm12.121-1.486-2.308 2.298c-.169.168-.422.053-.422-.2V9.57l-6.44 6.44a.533.533 0 0 1-.421.17H8.169a.32.32 0 0 1-.338-.338v-1.697c0-.2.053-.316.169-.422l6.44-6.44H4.058c-.253 0-.369-.253-.2-.421l2.297-2.309c.137-.137.285-.232.517-.232H18.15c.854 0 1.539.686 1.539 1.54v11.478c-.01.231-.095.368-.232.516z"/></svg>',
  airbnb: '<svg class="w-full h-full" viewBox="0 0 24 24" fill="#FF5A5F"><path d="M12.001 18.275c-1.353-1.697-2.148-3.184-2.413-4.457-.263-1.027-.16-1.848.291-2.465.477-.71 1.188-1.056 2.121-1.056s1.643.345 2.12 1.063c.446.61.558 1.432.286 2.465-.291 1.298-1.085 2.785-2.412 4.458zm9.601 1.14c-.185 1.246-1.034 2.28-2.2 2.783-2.253.98-4.483-.583-6.392-2.704 3.157-3.951 3.74-7.028 2.385-9.018-.795-1.14-1.933-1.695-3.394-1.695-2.944 0-4.563 2.49-3.927 5.382.37 1.565 1.352 3.343 2.917 5.332-.98 1.085-1.91 1.856-2.732 2.333-.636.344-1.245.558-1.828.609-2.679.399-4.778-2.2-3.825-4.88.132-.345.395-.98.845-1.961l.025-.053c1.464-3.178 3.242-6.79 5.285-10.795l.053-.132.58-1.116c.45-.822.635-1.19 1.351-1.643.346-.21.77-.315 1.246-.315.954 0 1.698.558 2.016 1.007.158.239.345.557.582.953l.558 1.089.08.159c2.041 4.004 3.821 7.608 5.279 10.794l.026.025.533 1.22.318.764c.243.613.294 1.222.213 1.858zm1.22-2.39c-.186-.583-.505-1.271-.9-2.094v-.03c-1.889-4.006-3.642-7.608-5.307-10.844l-.111-.163C15.317 1.461 14.468 0 12.001 0c-2.44 0-3.476 1.695-4.535 3.898l-.081.16c-1.669 3.236-3.421 6.843-5.303 10.847v.053l-.559 1.22c-.21.504-.317.768-.345.847C-.172 20.74 2.611 24 5.98 24c.027 0 .132 0 .265-.027h.372c1.75-.213 3.554-1.325 5.384-3.317 1.829 1.989 3.635 3.104 5.382 3.317h.372c.133.027.239.027.265.027 3.37.003 6.152-3.261 4.802-6.975z"/></svg>',
  google: '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>',
  whatsapp: '<svg class="w-full h-full" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>',
  phone: '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106a1.125 1.125 0 0 0-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"/></svg>',
}
function srcIcon(s: string) { return SRC_ICON_SVG[s] ?? SRC_ICON_SVG.booking }

// Paleta de avatares del listado — reusa los tokens reales del tema (no hex sueltos) para
// que cada huésped tenga un color reconocible sin depender de datos que no tenemos (ids estables).
const AVATAR_PALETTE = [
  { bg: 'bg-blue/10', text: 'text-blue' },
  { bg: 'bg-purple/10', text: 'text-purple' },
  { bg: 'bg-gold/10', text: 'text-gold' },
  { bg: 'bg-teal/10', text: 'text-teal' },
  { bg: 'bg-coral/10', text: 'text-coral' },
  { bg: 'bg-cyan/10', text: 'text-cyan' },
]
function avatarStyle(i: number) { return AVATAR_PALETTE[i % AVATAR_PALETTE.length] }

function trendClass(pct: number) {
  if (pct > 0) return 'text-[#16A34A]'
  if (pct < 0) return 'text-[#DC2626]'
  return 'text-text-muted'
}
function trendLabel(pct: number) {
  if (pct > 0) return `+${pct}% vs ayer`
  return `${pct}% vs ayer`
}

function formatCardNumber() {
  let v = form.value.cardNumber.replace(/\D/g, '').substring(0, 16)
  form.value.cardNumber = v.replace(/(.{4})/g, '$1 ').trim()
}

// Caducidad como MM/AAAA (ej: 12/2024). Inserta la '/' automáticamente y sincroniza mes/año.
function formatExpiry() {
  const digits = form.value.cardExpiry.replace(/\D/g, '').slice(0, 6)
  let month = digits.slice(0, 2)
  if (month.length === 2) {
    if (Number(month) === 0) month = '01'
    else if (Number(month) > 12) month = '12'
  }
  const year = digits.slice(2)
  form.value.cardExpiry = year.length ? `${month}/${year}` : month
  form.value.cardExpMonth = month.length === 2 ? month : ''
  form.value.cardExpYear = year.length === 4 ? year : ''
}

function calcDepositFromPercentage() {
  form.value.deposit = Math.round(total.value * (form.value.depositPercentage || 0) / 100)
}

// ── Data Loading ──
async function load() {
  try {
    const [{ RoomService }, { GuestService }] = await Promise.all([import('@/services/Room.service'), import('@/services/Guest.service')])
    const [res, rom, gst] = await Promise.all([
      ReservationService.list({ hotelId: hid.value }).catch(() => ({ reservations: [], total: 0 })),
      RoomService.list({ hotelId: hid.value }).catch(() => ({ rooms: [], total: 0 })),
      GuestService.list({ hotelId: hid.value }).catch(() => ({ guests: [], total: 0 })),
    ])
    rooms.value = rom.rooms || []
    const rm = new Map(rooms.value.map((r: any) => [r.id, r]))
    const gm = new Map((gst.guests || []).map((g: any) => [g.id, g]))
    list.value = (res.reservations || []).map((r: any) => {
      const room = rm.get(r.roomId)
      const guest = gm.get(r.guestId)
      return {
        id: r.id, guestName: guest?.name || 'Guest', email: guest?.email || '',
        roomNumber: room?.number || r.roomNumber || '—', roomId: r.roomId, guestId: r.guestId,
        checkIn: String(r.checkIn || '').slice(0, 10), checkOut: String(r.checkOut || '').slice(0, 10),
        nights: nBetween(r.checkIn, r.checkOut), status: r.status, source: r.source,
        total: r.totalAmount, adults: r.adults, children: r.children, notes: r.notes || '',
      }
    })
  } catch (e: any) { console.error('[reservations/load]', e); toast.error('No se pudieron cargar las reservas') }
}

function nBetween(a?: string, b?: string): number {
  if (!a || !b) return 0
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY))
}

// ── Modal Open / Close ──
function resetForm() {
  form.value = {
    name: '', email: '', phone: '',
    language: 'Español', country: 'República Dominicana', nationality: 'Dominicana',
    address: '', city: '', province: '',
    sex: '', birthDate: '',
    documentType: 'dni', document: '', documentIssueDate: '',
    communicateClient: 'none', guestNotes: '',
    emergencyName: '', emergencyPhone: '', emergencyRelation: '', emergencyEmail: '',
    checkIn: '', checkOut: '', roomId: '', adults: 2, children: 0,
    regime: 'room_only', promoCode: '',
    source: 'direct', commission: 0, commissionAmount: 0, extLocator: '', otaNotes: '',
    cardHolder: '', cardBrand: 'visa', cardNumber: '', cardCvv: '', cardExpMonth: '', cardExpYear: '', cardExpiry: '',
    depositPercentage: 100, deposit: 0, depositStatus: 'unpaid', payMethod: 'transfer',
    status: 'pending', notes: '', autoSendEnabled: true, companions: [],
  }
  existingGuarantee.value = false
  selectedGuestId.value = null
  guestSearch.value = ''
  guestResults.value = []
  guestSearchOpen.value = false
}

function openNew() {
  editId.value = ''
  err.value = ''
  lockCode.value = ''
  resetForm()
  wizardStep.value = 1
  step1Attempted.value = false
  step4Attempted.value = false
  modal.value = { show: true, edit: false }
}

async function openEdit(r: any) {
  editId.value = r.id
  err.value = ''
  lockCode.value = ''
  resetForm()

  // Mapear datos básicos de la reserva
  const f = form.value
  f.checkIn = r.checkIn
  f.checkOut = r.checkOut
  f.roomId = r.roomId || ''
  f.adults = r.adults || 2
  f.children = r.children || 0
  f.status = r.status
  f.source = r.source || 'direct'
  f.notes = r.notes || ''

  // Cargar datos extendidos (guest + companions + lock + pago/OTA)
  try {
    const ext = await ReservationService.getById(r.id)
    // Datos de pago y OTA de la reserva (bug: antes no se recordaban al editar)
    f.payMethod = ext.paymentMethod || 'transfer'
    existingGuarantee.value = !!ext.hasGuaranteeCard
    f.deposit = ext.deposit || 0
    f.depositPercentage = ext.depositPercentage ?? 100
    f.depositStatus = ext.depositStatus || 'unpaid'
    f.commission = ext.commission || 0
    f.extLocator = ext.externalLocator || ''
    f.otaNotes = ext.otaNotes || ''
    f.autoSendEnabled = ext.autoSendEnabled ?? true
    // Guest data
    if (ext.guest) {
      const g = ext.guest
      f.name = g.name || ''
      f.email = g.email || ''
      f.phone = g.phone || ''
      f.language = g.language || 'Español'
      f.country = g.country || 'República Dominicana'
      f.nationality = g.nationality || 'República Dominicana'
      f.address = g.address || ''
      f.city = g.city || ''
      f.province = g.province || ''
      f.sex = g.sex || ''
      f.birthDate = g.birthDate || ''
      f.documentType = g.documentType || 'dni'
      f.document = g.document || ''
      f.documentIssueDate = g.documentIssueDate || ''
      f.guestNotes = g.notes || ''
      f.communicateClient = g.communicateClient || 'none'
    }
    // Emergency contact
    if (ext.emergencyContact) {
      f.emergencyName = ext.emergencyContact.name || ''
      f.emergencyPhone = ext.emergencyContact.phone || ''
      f.emergencyRelation = ext.emergencyContact.relation || ''
      f.emergencyEmail = ext.emergencyContact.email || ''
    }
    // Companions
    form.value.companions = (ext.companions || []).map((c: any) => ({
      id: c.id, name: c.name || '', documentNumber: c.documentNumber || '',
      documentType: c.documentType, nationality: c.nationality,
    }))
    // Lock
    if (ext.lockCodes?.length) lockCode.value = ext.lockCodes[0].code || ''
  } catch (e: any) { console.warn('[reservations/openEdit]', e); toast.info('Algunos datos de la reserva no se pudieron cargar') }

  wizardStep.value = 1
  step1Attempted.value = false
  step4Attempted.value = false
  modal.value = { show: true, edit: true }
}

// ── Detalle (F3): abrir vista de lectura; Editar reusa el form existente ──
function openDetail(r: any) {
  lastRow.value = r
  detailId.value = r.id
}
function onEditDetail() {
  const r = lastRow.value
  detailId.value = ''
  if (r) openEdit(r)
}

// ── Save ──
// Buscador de huésped existente: evita duplicar huéspedes al crear reserva.
const guestSearch = ref('')
const guestResults = ref<Guest[]>([])
const guestSearchOpen = ref(false)
const selectedGuestId = ref<string | null>(null)
let guestSearchTimer: ReturnType<typeof setTimeout> | null = null

async function onGuestSearchInput(e: Event) {
  guestSearch.value = (e.target as HTMLInputElement).value
  selectedGuestId.value = null
  if (guestSearchTimer) clearTimeout(guestSearchTimer)
  const q = guestSearch.value.trim()
  if (q.length < 2) { guestResults.value = []; guestSearchOpen.value = false; return }
  guestSearchTimer = setTimeout(async () => {
    try {
      const { GuestService } = await import('@/services/Guest.service')
      const r = await GuestService.list({ hotelId: hid.value!, search: q })
      guestResults.value = r.guests.slice(0, 8)
      guestSearchOpen.value = true
    } catch {
      guestResults.value = []
      guestSearchOpen.value = false
    }
  }, 300)
}

function selectGuest(g: Guest) {
  selectedGuestId.value = g.id
  guestSearch.value = g.name || ''
  guestSearchOpen.value = false
  const f = form.value
  f.name = g.name || ''
  f.email = g.email || ''
  f.phone = g.phone || ''
  f.documentType = g.documentType || 'dni'
  f.document = g.document || ''
  f.documentIssueDate = g.documentIssueDate || ''
  f.nationality = g.nationality || 'Dominicana'
  f.country = g.country || g.nationality || 'República Dominicana'
  f.language = g.language || 'Español'
  f.sex = g.sex || ''
  f.birthDate = g.birthDate || ''
  f.address = g.address || ''
  f.city = g.city || ''
  f.province = g.province || ''
  f.guestNotes = g.notes || ''
  f.communicateClient = (g.communicateClient as string) || 'none'
}

function blurGuestSearch() {
  setTimeout(() => { guestSearchOpen.value = false }, 150)
}

// Acompañantes (companions): alta/edición inline en el form. La sync con el backend
// ya existe en save() (create/update/delete diff) — estas funciones solo manejan la UI.
function addCompanion() {
  form.value.companions.push({ name: '', documentNumber: '', documentType: 'passport', nationality: form.value.nationality || '' })
}
function removeCompanion(i: number) {
  form.value.companions.splice(i, 1)
}

async function save() {
  err.value = ''
  // Validación de campos obligatorios (igual que MisterPlan): nombre, habitación,
  // fechas coherentes y al menos un contacto. La disponibilidad de la habitación la valida el backend.
  step1Attempted.value = true
  step4Attempted.value = true
  if (!isStep1Valid()) {
    wizardStep.value = 1
    err.value = 'Completá los campos obligatorios de Huésped: ' + [nameError.value, contactError.value, emailFormatError.value].filter(Boolean).join(', ') + '.'
    return
  }
  if (!isStep4Valid()) {
    wizardStep.value = 4
    err.value = 'Completá los campos obligatorios de Alojamiento: ' + [roomError.value, checkInError.value, checkOutError.value].filter(Boolean).join(', ') + '.'
    return
  }
  saving.value = true
  try {
    // 1. Crear/actualizar huésped
    const guestPayload = {
      name: form.value.name,
      email: form.value.email,
      phone: form.value.phone,
      nationality: form.value.nationality,
      language: form.value.language,
      country: form.value.country,
      sex: form.value.sex,
      birthDate: form.value.birthDate,
      address: form.value.address,
      city: form.value.city,
      province: form.value.province,
      documentType: form.value.documentType,
      document: form.value.document,
      documentIssueDate: form.value.documentIssueDate,
      notes: form.value.guestNotes,
      communicateClient: form.value.communicateClient,
    }

    let guestId: string | undefined = undefined
    try {
      const { GuestService } = await import('@/services/Guest.service')
      if (editId.value) {
        // Editar: ya tiene guestId
        const existing = await ReservationService.getById(editId.value)
        if (existing?.guestId) {
          await GuestService.update(existing.guestId, guestPayload)
          guestId = existing.guestId
        }
      } else if (selectedGuestId.value) {
        // Huésped existente seleccionado del buscador: reutilizar (no crear nuevo).
        await GuestService.update(selectedGuestId.value, guestPayload)
        guestId = selectedGuestId.value
      } else {
        // Crear nuevo guest
        const newGuest = await GuestService.create({ hotelId: hid.value!, ...guestPayload })
        guestId = newGuest?.id
      }
    } catch { /* fallback: guest opcional */ }

    // 2. Crear/actualizar reserva
    const reservationPayload: any = {
      roomId: form.value.roomId,
      guestId,
      checkIn: form.value.checkIn,
      checkOut: form.value.checkOut,
      channel: form.value.source,
      source: form.value.source,
      totalAmount: total.value,
      status: form.value.status,
      notes: form.value.notes,
      adults: form.value.adults,
      children: form.value.children,
      deposit: form.value.deposit,
      paymentMethod: form.value.payMethod,
      commission: form.value.commission,
      commissionAmount: Math.round(total.value * form.value.commission / 100),
      externalLocator: form.value.extLocator,
      otaNotes: form.value.otaNotes,
      autoSendEnabled: !!form.value.autoSendEnabled,
    }

    // Tarjeta de garantía: se guarda solo si se ingresó un número válido (nueva o reemplazo).
    // Nunca se envía el número completo ni el CVV (PCI) — solo últimos 4 + datos parciales.
    const cardDigits = (form.value.cardNumber || '').replace(/\D/g, '')
    if (form.value.cardHolder && cardDigits.length >= 12) {
      reservationPayload.cardHolder = form.value.cardHolder
      reservationPayload.cardBrand = form.value.cardBrand
      reservationPayload.cardLast4 = cardDigits.slice(-4)
      reservationPayload.cardExpMonth = form.value.cardExpMonth
      reservationPayload.cardExpYear = form.value.cardExpYear
      reservationPayload.hasGuaranteeCard = true
    }

    let reservationId = editId.value
    if (editId.value) {
      await ReservationService.update(editId.value, reservationPayload)
    } else {
      const created: any = await ReservationService.create({
        hotelId: hid.value!,
        ...reservationPayload,
      } as any)
      reservationId = created?.id || created?.reservationId
    }

    // 3. Sincronizar companions
    if (reservationId) {
      const existing = await CompanionsService.listByReservation(reservationId)
      const existingIds = new Set(existing.data.map(c => c.id).filter((id): id is string => Boolean(id)))
      for (const c of form.value.companions) {
        if (c.id && existingIds.has(c.id)) {
          await CompanionsService.update(c.id, { name: c.name, documentNumber: c.documentNumber, documentType: c.documentType, nationality: c.nationality })
          existingIds.delete(c.id)
        } else if (c.name) {
          await CompanionsService.create(reservationId, { name: c.name, documentNumber: c.documentNumber, documentType: c.documentType || 'passport', nationality: c.nationality })
        }
      }
      for (const id of existingIds) { await CompanionsService.remove(id) }
    }

    modal.value.show = false
    await load()
    toast.success(editId.value ? 'Reserva actualizada' : 'Reserva creada')
  } catch (e: any) {
    err.value = e.message || 'Error al guardar'
  }
  saving.value = false
}

// ── Acciones ──
async function generateLockCode() {
  if (!editId.value) { toast.error('Guarda la reserva primero'); return }
  try {
    const code = await TTLockService.generateCode(editId.value)
    lockCode.value = code.code || ''
    toast.success(`Código generado: ${lockCode.value}`)
  } catch (e: any) { toast.error(e.message || 'Sin cerradura asignada') }
}

async function createPaymentRequest() {
  if (!editId.value) { toast.error('Guarda la reserva primero'); return }
  if (pend.value <= 0) { toast.info('Sin monto pendiente'); return }
  try {
    await PaymentsService.create({ reservationId: editId.value, amount: pend.value, sentTo: form.value.email, sentVia: 'email' })
    toast.success('Requerimiento de pago creado')
  } catch (e: any) { toast.error(e.message || 'Error') }
}

function confirmAction(type: string, r: any) {
  if (type === 'checkin') { cfg.value = { show: true, icon: '🛎️', title: '¿Check-in?', msg: `${r.guestName} — Hab. ${r.roomNumber} — ${r.checkIn}`, btn: 'bg-teal', fn: () => doCheckin(r) } }
  else if (type === 'delete') { cfg.value = { show: true, icon: '🗑️', title: '¿Eliminar reserva?', msg: `${r.guestName} — Hab. ${r.roomNumber} — esta acción no se puede deshacer`, btn: 'bg-coral', fn: () => doDelete(r) } }
  else { cfg.value = { show: true, icon: '⚠️', title: '¿Cancelar?', msg: `${r.guestName} — Hab. ${r.roomNumber} — $${r.total}`, btn: 'bg-coral', fn: () => doCancel(r) } }
}

async function doCheckin(r: any) {
  try {
    // Check-in real: abre el folio de la reserva + marca checked_in + habitación occupied.
    // NO usar update({status:'checked_in'}) — eso NO abriría el folio y rompería el cobro posterior.
    const res = await ReservationService.checkin(r.id)
    await load()
    const folioTag = res?.folioId ? ` · Folio ${String(res.folioId).slice(0, 8)}` : ''
    toast.success(`Check-in realizado${folioTag}`)
    // Toast de notificación de email de bienvenida (spec 11.1.1).
    if (r.email) toast.info(`Email de bienvenida enviado a ${r.email}`)
    else toast.info('Sin email registrado')
  } catch (e: any) { toast.error(e.message || 'Error en check-in') }
}
async function doCancel(r: any) { try { await ReservationService.update(r.id, { status: 'cancelled' } as any); await load(); toast.success('Cancelada') } catch { toast.error('Error') } }

async function doDelete(r: any) {
  try { await ReservationService.remove(r.id); await load(); toast.success('Reserva eliminada') }
  catch (e: any) { toast.error(e.message || 'Error al eliminar') }
}

// Export CSV de las reservas filtradas (BOM UTF-8 → Excel respeta tildes).
function exportCSV() {
  const head = ['Huésped', 'Email', 'Hab', 'CheckIn', 'CheckOut', 'Noches', 'Estado', 'Canal', 'Total']
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [head.join(','), ...filtered.value.map((r: any) =>
    [r.guestName, r.email, r.roomNumber, r.checkIn, r.checkOut, r.nights, r.status, r.source, r.total].map(esc).join(','),
  )]
  const csv = '﻿' + lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reservas-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function sendPayLink(ch: string) {
  const g = form.value.name
  const a = pend.value; const e = form.value.email; const p = form.value.phone
  if (ch === 'email' && e) { window.open(`mailto:${e}?subject=${encodeURIComponent('Pago pendiente - ' + g)}&body=${encodeURIComponent('Hola ' + g + ', tu reserva tiene $' + a + ' pendientes.')}`); toast.success('Email abierto') }
  else if (ch === 'whatsapp' && p) { window.open(`https://wa.me/${p.replace(/\D/g, '')}?text=${encodeURIComponent('Hola ' + g + ', pago pendiente: $' + a)}`); toast.success('WhatsApp abierto') }
  else { toast.error('Falta email/teléfono') }
}

onMounted(async () => {
  await load()
  // Si viene de planning con ?edit=id (botón Editar del ReservationModal), abrir el form.
  const editQ = route.query.edit
  if (editQ && typeof editQ === 'string') {
    const r = (list.value as any[]).find((x) => x.id === editQ)
    if (r) openEdit(r)
    router.replace({ query: {} })
  }
})
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-active .modal-panel, .modal-fade-leave-active .modal-panel { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-panel, .modal-fade-leave-to .modal-panel { opacity: 0; transform: translateY(8px) scale(0.98); }
</style>
