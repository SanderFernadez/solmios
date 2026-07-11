<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Huéspedes</h2>
        <p class="text-sm text-text-muted mt-0.5">CRM y fidelización de clientes</p>
      </div>
      <button @click="openNewGuest" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
        Nuevo Huésped
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_USERS_GROUP"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-navy">{{ guests.length }}</div>
            <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-1 truncate">Total Huéspedes</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10">
            <span class="w-5 h-5 text-cyan" v-html="ICON_HOME"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-cyan">{{ activeToday }}</div>
            <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-1 truncate">Activos Hoy</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10">
            <span class="w-5 h-5 text-teal" v-html="ICON_STAR"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-teal">{{ frequentGuests }}</div>
            <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-1 truncate">Frecuentes</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold/10">
            <span class="w-5 h-5 text-gold" v-html="ICON_WALLET"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-gold">{{ totalPoints.toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-1 truncate">Puntos Otorgados</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Guest List -->
    <div class="card overflow-hidden">
      <div class="p-4 border-b border-border">
        <div class="flex items-center gap-3">
          <input v-model="searchQuery" type="text" placeholder="Buscar por nombre, email o teléfono..." class="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
          <select v-model="filterType" class="px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
            <option value="all">Todos</option>
            <option value="frequent">Frecuentes (5+ estadías)</option>
            <option value="new">Nuevos (1 estadía)</option>
            <option value="vip">VIP ($5,000+ gastados)</option>
          </select>
        </div>
      </div>
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Huésped</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Contacto</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estadías</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Total Gastado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Puntos</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Última Visita</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="guest in paginatedGuests"
            :key="guest.id"
            @click="openViewGuest(guest)"
            class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors cursor-pointer"
          >
            <td class="p-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" :class="guestAvatarClass(guest)">
                  {{ guest.initials }}
                </div>
                <div>
                  <div class="text-sm font-bold text-navy">{{ guest.name }}</div>
                  <div class="text-[10px] text-text-muted">{{ guest.nationality }}</div>
                </div>
              </div>
            </td>
            <td class="p-4">
              <div class="text-sm">{{ guest.email }}</div>
              <div class="text-[10px] text-text-muted">{{ guest.phone }}</div>
            </td>
            <td class="p-4 text-sm font-bold">{{ guest.stays }}</td>
            <td class="p-4 text-sm font-extrabold text-navy">${{ guest.totalSpent.toLocaleString() }}</td>
            <td class="p-4">
              <span class="badge badge-info">{{ guest.points.toLocaleString() }}</span>
            </td>
            <td class="p-4 text-sm text-text-secondary">{{ guest.lastVisit }}</td>
            <td class="p-4 text-right">
              <div class="flex gap-1 justify-end">
                <button @click.stop="openViewGuest(guest)" class="px-2 py-1 bg-cyan/10 text-cyan rounded-lg text-[10px] font-bold hover:bg-cyan/20 transition-colors cursor-pointer">Ver</button>
                <button @click.stop="openEditGuest(guest)" class="px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 transition-colors cursor-pointer">Editar</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Paginación del listado -->
      <div v-if="totalFiltered > PAGE_SIZE" class="flex items-center justify-between px-4 py-3 border-t border-border">
        <span class="text-[10px] text-text-muted font-bold">{{ totalFiltered }} huésped(es)</span>
        <div class="flex items-center gap-1">
          <button @click="goToPage(1)" :disabled="currentPage <= 1" class="px-2 py-1 rounded-lg text-xs font-bold text-navy hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">«</button>
          <button @click="goToPage(currentPage - 1)" :disabled="currentPage <= 1" class="px-2 py-1 rounded-lg text-xs font-bold text-navy hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">‹</button>
          <span class="px-2 text-xs font-bold text-navy">{{ currentPage }} / {{ totalPages }}</span>
          <button @click="goToPage(currentPage + 1)" :disabled="currentPage >= totalPages" class="px-2 py-1 rounded-lg text-xs font-bold text-navy hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">›</button>
          <button @click="goToPage(totalPages)" :disabled="currentPage >= totalPages" class="px-2 py-1 rounded-lg text-xs font-bold text-navy hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">»</button>
        </div>
      </div>
    </div>

    <!-- View Guest Profile Modal -->
    <Teleport to="body">
      <div v-if="showViewModal && viewGuest" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>

        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <!-- Header -->
          <div class="p-6 border-b border-border bg-gradient-to-r from-navy to-navy-light">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black" :class="viewGuestAvatarClass">
                  {{ viewGuest.initials }}
                </div>
                <div>
                  <h3 class="text-xl font-black text-white">{{ viewGuest.name }}</h3>
                  <p class="text-sm text-gray-300">{{ viewGuest.nationality }} · {{ viewGuest.email }}</p>
                </div>
              </div>
              <button @click="closeViewModal" class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-6">
            <!-- Stats Row -->
            <div class="grid grid-cols-4 gap-4">
              <div class="bg-surface rounded-xl p-4 text-center">
                <div class="text-2xl font-black text-navy">{{ viewGuest.stays }}</div>
                <div class="text-[10px] text-text-muted uppercase">Estadías</div>
              </div>
              <div class="bg-surface rounded-xl p-4 text-center">
                <div class="text-2xl font-black text-cyan">${{ viewGuest.totalSpent.toLocaleString() }}</div>
                <div class="text-[10px] text-text-muted uppercase">Total Gastado</div>
              </div>
              <div class="bg-surface rounded-xl p-4 text-center">
                <div class="text-2xl font-black text-gold">{{ viewGuest.points.toLocaleString() }}</div>
                <div class="text-[10px] text-text-muted uppercase">Puntos</div>
              </div>
              <div class="bg-surface rounded-xl p-4 text-center">
                <div class="text-2xl font-black" :class="viewGuestTier.color">{{ viewGuestTier.label }}</div>
                <div class="text-[10px] text-text-muted uppercase">Tier</div>
              </div>
            </div>

            <!-- Información de Ventas / Valor del cliente -->
            <div>
              <h4 class="text-sm font-bold text-navy mb-3">Información de Ventas</h4>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Ticket Promedio</div>
                  <div class="text-sm font-extrabold text-navy">${{ viewGuest.sales ? viewGuest.sales.avgPerStay.toLocaleString() : '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Reservas</div>
                  <div class="text-sm font-extrabold text-navy">{{ viewGuest.sales ? viewGuest.sales.reservationsCount : '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Facturado (reservas)</div>
                  <div class="text-sm font-extrabold text-navy">${{ viewGuest.sales ? viewGuest.sales.totalResvSpent.toLocaleString() : '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Primera visita</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.sales ? fmtDate(viewGuest.sales.firstVisit) : '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Última visita</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.sales ? fmtDate(viewGuest.sales.lastVisit) : '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Días desde última</div>
                  <div class="text-sm font-extrabold" :class="viewGuest.sales?.daysSinceLastVisit != null && viewGuest.sales.daysSinceLastVisit <= RECENT_VISIT_DAYS ? 'text-teal' : 'text-text-secondary'">
                    {{ viewGuest.sales?.daysSinceLastVisit != null ? viewGuest.sales.daysSinceLastVisit : '—' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Contact Info -->
            <div>
              <h4 class="text-sm font-bold text-navy mb-3">Información de Contacto</h4>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-surface rounded-xl p-4">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Email</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.email || '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-4">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Teléfono</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.phone || '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-4">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Documento</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.document || '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-4">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Fecha de Nacimiento</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.birthDate ? fmtDate(viewGuest.birthDate) : '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-4">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Nacionalidad</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.nationality || '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-4">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Idioma</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.language || '—' }}</div>
                </div>
              </div>
            </div>

            <!-- Datos personales y dirección -->
            <div>
              <h4 class="text-sm font-bold text-navy mb-3">Datos Personales y Dirección</h4>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Sexo</div>
                  <div class="text-sm font-bold text-navy">{{ sexLabel(viewGuest.sex) }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">País</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.country || '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Tipo Doc.</div>
                  <div class="text-sm font-bold text-navy">{{ docTypeLabel(viewGuest.documentType) }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Exp. Doc.</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.documentIssueDate ? fmtDate(viewGuest.documentIssueDate) : '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Dirección</div>
                  <div class="text-sm font-bold text-navy">{{ [viewGuest.address, viewGuest.city, viewGuest.province].filter(Boolean).join(', ') || '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Profesión</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.profession || '—' }}</div>
                </div>
              </div>
            </div>

            <!-- Contacto de emergencia -->
            <div v-if="viewGuest.emergencyContact && (viewGuest.emergencyContact.name || viewGuest.emergencyContact.phone || viewGuest.emergencyContact.email)">
              <h4 class="text-sm font-bold text-navy mb-3">Contacto de Emergencia</h4>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Nombre</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.emergencyContact.name || '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Teléfono</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.emergencyContact.phone || '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Relación</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.emergencyContact.relation || '—' }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3">
                  <div class="text-[10px] text-text-muted uppercase mb-1">Email</div>
                  <div class="text-sm font-bold text-navy">{{ viewGuest.emergencyContact.email || '—' }}</div>
                </div>
              </div>
            </div>

            <!-- Preferences -->
            <div v-if="viewGuest.preferences?.length">
              <h4 class="text-sm font-bold text-navy mb-3">Preferencias</h4>
              <div class="flex flex-wrap gap-2">
                <span v-for="pref in viewGuest.preferences" :key="pref" class="px-3 py-1.5 bg-navy/5 rounded-lg text-[11px] font-bold text-navy">
                  {{ pref }}
                </span>
              </div>
            </div>

            <!-- Stay History -->
            <div>
              <h4 class="text-sm font-bold text-navy mb-3">Historial de Estadías</h4>
              <div v-if="viewGuest.loadingDetail" class="text-xs text-text-muted py-3">Cargando estadías…</div>
              <div v-else-if="!viewGuest.history?.length" class="text-xs text-text-muted py-3">Sin estadías registradas</div>
              <div v-else class="space-y-3">
                <div v-for="stay in viewGuest.history" :key="stay.id" class="bg-surface rounded-xl p-4 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-10 rounded-lg bg-navy/10 flex items-center justify-center text-[9px] font-bold text-navy uppercase">
                      {{ stay.channel || '—' }}
                    </div>
                    <div>
                      <div class="text-sm font-bold text-navy">{{ stay.dates }}</div>
                      <div class="text-[10px] text-text-muted">{{ stay.nights }} noches · ${{ stay.total }}</div>
                    </div>
                  </div>
                  <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="stayBadgeClass(stay.status)">
                    {{ stayLabel(stay.status) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Points History -->
            <div>
              <h4 class="text-sm font-bold text-navy mb-3">Historial de Puntos</h4>
              <div v-if="viewGuest.loadingDetail" class="text-xs text-text-muted py-3">Cargando puntos…</div>
              <div v-else-if="!viewGuest.pointsHistory?.length" class="text-xs text-text-muted py-3">Sin movimientos de puntos</div>
              <div v-else class="space-y-2">
                <div v-for="tx in viewGuest.pointsHistory" :key="tx.id" class="bg-surface rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div class="text-xs font-bold text-navy">{{ tx.description || tx.type }}</div>
                    <div class="text-[10px] text-text-muted">{{ fmtDate(tx.createdAt) }}</div>
                  </div>
                  <span class="text-sm font-black" :class="tx.points >= 0 ? 'text-teal' : 'text-gold'">
                    {{ tx.points >= 0 ? '+' : '' }}{{ tx.points }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Notes -->
            <div v-if="viewGuest.notes">
              <h4 class="text-sm font-bold text-navy mb-3">Notas</h4>
              <div class="bg-surface rounded-xl p-4 text-sm text-text-secondary whitespace-pre-wrap">
                {{ viewGuest.notes }}
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="p-6 border-t border-border bg-surface/50">
            <div class="flex gap-3">
              <button @click="closeViewModal(); openEditGuest(viewGuest)" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light transition-colors cursor-pointer">
                Editar Perfil
              </button>
              <button @click="closeViewModal" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- New/Edit Guest Modal -->
    <Teleport to="body">
      <div v-if="showFormModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>

        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div class="p-6 border-b border-border sticky top-0 bg-white z-10">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-black text-navy">{{ editingGuest ? 'Editar Huésped' : 'Nuevo Huésped' }}</h3>
              <button @click="closeFormModal" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-secondary hover:text-navy transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <!-- Wizard progress -->
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-navy">Paso {{ formStep }} de {{ FORM_STEPS.length }}</span>
              <span class="text-xs font-bold text-text-muted">{{ FORM_STEPS[formStep - 1].label }}</span>
            </div>
            <div class="h-1.5 bg-surface-dark rounded-full overflow-hidden">
              <div class="h-full bg-navy rounded-full transition-all" :style="{ width: (formStep / FORM_STEPS.length * 100) + '%' }"></div>
            </div>
          </div>

          <div class="p-6 space-y-4">
            <p v-if="formStep === 1" class="text-[11px] text-text-muted">Los campos marcados con <span class="text-red-500 font-bold">*</span> son obligatorios.</p>

            <!-- Paso 1: Datos Personales -->
            <template v-if="formStep === 1">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Nombre Completo <span class="text-red-500">*</span></label>
                  <input v-model="form.name" type="text" placeholder="Nombre y apellido" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Nacionalidad</label>
                  <SearchSelect v-model="form.nationality" :options="NATIONALITIES" placeholder="Buscar nacionalidad..." />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Email <span class="text-red-500">*</span></label>
                  <input v-model="form.email" type="email" placeholder="email@ejemplo.com" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Teléfono</label>
                  <input v-model="form.phone" type="tel" placeholder="+1 809-555-0101" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Documento</label>
                  <input v-model="form.document" type="text" placeholder="Pasaporte o ID" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Tipo Documento</label>
                  <select v-model="form.documentType" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                    <option value="">—</option>
                    <option v-for="d in DOC_TYPES" :key="d.v" :value="d.v">{{ d.l }}</option>
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Exp. Documento</label>
                  <input v-model="form.documentIssueDate" type="date" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Fecha de Nacimiento</label>
                  <input v-model="form.birthDate" type="date" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
              </div>
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Sexo</label>
                <select v-model="form.sex" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                  <option value="">—</option>
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            </template>

            <!-- Paso 2: Dirección y Profesión -->
            <template v-if="formStep === 2">
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">País</label>
                <SearchSelect v-model="form.country" :options="COUNTRIES" placeholder="Buscar país..." />
              </div>
              <div class="grid grid-cols-3 gap-4">
                <div class="col-span-2">
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Dirección</label>
                  <input v-model="form.address" type="text" placeholder="Calle, número..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Ciudad</label>
                  <input v-model="form.city" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Provincia</label>
                  <input v-model="form.province" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Profesión</label>
                  <input v-model="form.profession" type="text" placeholder="Médico, ingeniero..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
              </div>
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Idioma</label>
                <select v-model="form.language" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                  <option value="">Sin preferencia</option>
                  <option v-for="l in LANGUAGES" :key="l.v" :value="l.v">{{ l.l }}</option>
                </select>
              </div>
            </template>

            <!-- Paso 3: Fidelización y Emergencia -->
            <template v-if="formStep === 3">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Tier (fidelización)</label>
                  <select v-model="form.tier" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                    <option value="">Sin tier</option>
                    <option value="bronze">Bronce</option>
                    <option value="silver">Plata</option>
                    <option value="gold">Oro</option>
                    <option value="platinum">Platino</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Puntos de Fidelización</label>
                  <input v-model.number="form.loyaltyPoints" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
              </div>
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Contacto de Emergencia</label>
                <div class="grid grid-cols-2 gap-3">
                  <input v-model="form.emergencyContact.name" type="text" placeholder="Nombre" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                  <input v-model="form.emergencyContact.phone" type="text" placeholder="Teléfono" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                  <input v-model="form.emergencyContact.relation" type="text" placeholder="Relación (esposa, hijo...)" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                  <input v-model="form.emergencyContact.email" type="email" placeholder="Email" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
              </div>
            </template>

            <!-- Paso 4: Preferencias y Notas -->
            <template v-if="formStep === 4">
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Preferencias</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="pref in allPreferences"
                    :key="pref"
                    @click="togglePreference(pref)"
                    class="px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer"
                    :class="form.preferences.includes(pref) ? 'border-navy bg-navy/5 text-navy' : 'border-border text-text-secondary hover:border-navy/30'"
                  >
                    {{ pref }}
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Notas</label>
                <textarea v-model="form.notes" rows="3" placeholder="Alergias, solicitudes especiales, etc." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-none"></textarea>
              </div>
            </template>
          </div>

          <div class="p-6 border-t border-border bg-surface/50 sticky bottom-0">
            <div class="flex gap-3 justify-between">
              <button v-if="formStep === 1" @click="closeFormModal" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">Cancelar</button>
              <button v-else @click="prevFormStep" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">Atrás</button>
              <button v-if="formStep < FORM_STEPS.length" @click="nextFormStep" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light transition-colors cursor-pointer">Siguiente</button>
              <button v-else @click="saveGuest" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light transition-colors cursor-pointer">
                {{ editingGuest ? 'Guardar Cambios' : 'Crear Huésped' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { GuestService } from '@/services/Guest.service'
import { ReservationService } from '@/services/Reservation.service'
import { CrmService } from '@/services/Crm.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import SearchSelect from '@/components/ui/SearchSelect.vue'
import { COUNTRIES, NATIONALITIES, LANGUAGES, DOC_TYPES } from '@/data/locales'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_USERS_GROUP = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72M18 18.72a9.094 9.094 0 0 1-3.741-.479 3 3 0 0 1 4.682-2.72M18 18.72v-.235a3 3 0 0 0-3-3M6 18.72a9.094 9.094 0 0 1-3.741-.479 3 3 0 0 1 4.682-2.72M6 18.72v-.235a3 3 0 0 1 3-3m3.75-6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"/></svg>'
const ICON_HOME = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"/></svg>'
const ICON_STAR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 21.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 12h.01M3 10h18"/></svg>'

// Umbrales de segmentación de clientes (VIP por gasto, Frecuente por estadías)
const VIP_SPEND_THRESHOLD = 5000
const FREQUENT_STAYS_THRESHOLD = 5
// Cliente "reciente" si volvió en los últimos N días (color del detalle)
const RECENT_VISIT_DAYS = 90
// Límites de fetch/display (no son de negocio: paginación + top-N en el modal)
const RESV_FETCH_LIMIT = 100
const DETAIL_HISTORY_LIMIT = 10
const PAGE_SIZE = 10

const searchQuery = ref('')
const filterType = ref('all')
const currentPage = ref(1)
const showViewModal = ref(false)
const showFormModal = ref(false)
const viewGuest = ref<any>(null)
const editingGuest = ref<any>(null)

const formStep = ref(1)
const FORM_STEPS = [
  { n: 1, label: 'Datos Personales' },
  { n: 2, label: 'Dirección y Profesión' },
  { n: 3, label: 'Fidelización y Emergencia' },
  { n: 4, label: 'Preferencias y Notas' },
]

function nextFormStep() {
  if (formStep.value === 1 && (!form.value.name || !form.value.email)) {
    toast.warning('Nombre y email requeridos')
    return
  }
  formStep.value = Math.min(formStep.value + 1, FORM_STEPS.length)
}

function prevFormStep() {
  formStep.value = Math.max(formStep.value - 1, 1)
}

const form = ref({
  name: '',
  email: '',
  phone: '',
  nationality: '',
  document: '',
  documentType: '',
  documentIssueDate: '',
  birthDate: '',
  sex: '',
  language: '',
  country: '',
  address: '',
  city: '',
  province: '',
  loyaltyPoints: 0,
  tier: '',
  profession: '',
  emergencyContact: { name: '', phone: '', relation: '', email: '' },
  preferences: [] as string[],
  notes: '',
})

const allPreferences = ['Habitación silenciosa', 'Piso alto', 'Vista al mar', 'Cama king', 'Almohadas extras', 'Sin gluten', 'Vegetariano', 'Business center', 'Gimnasio', 'Piscina']

function initialsOf(name?: string): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

const guests = ref<any[]>([])
const reservationsCache = ref<any[]>([])

const MS_PER_DAY = 86_400_000

function fmtDate(iso?: string | Date): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso).slice(0, 10) // fallback: truncar ISO a YYYY-MM-DD
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
}

function nightsBetween(checkIn?: string | Date, checkOut?: string | Date): number {
  if (!checkIn || !checkOut) return 0
  const n = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / MS_PER_DAY)
  return n > 0 ? n : 0
}

function daysSince(iso?: string | Date): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / MS_PER_DAY))
}

// ¿Reserva con huésped hospedado hoy (checkIn ≤ hoy ≤ checkOut, status checked_in)?
function isActiveNow(r: any): boolean {
  if (r.status !== 'checked_in') return false
  const now = Date.now()
  const ci = new Date(r.checkIn).getTime()
  const co = new Date(r.checkOut).getTime()
  return now >= ci && now <= co
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmada', checked_in: 'En curso',
  checked_out: 'Completada', cancelled: 'Cancelada', no_show: 'No-show',
}
const STATUS_BADGES: Record<string, string> = {
  checked_out: 'bg-teal/10 text-teal',
  checked_in: 'bg-cyan/10 text-cyan',
  confirmed: 'bg-navy/10 text-navy',
  pending: 'bg-gold/10 text-gold',
  cancelled: 'bg-gold/10 text-gold',
  no_show: 'bg-gold/10 text-gold',
}
const stayLabel = (s: string): string => STATUS_LABELS[s] ?? s
const stayBadgeClass = (s: string): string => STATUS_BADGES[s] ?? 'bg-surface text-text-secondary'

// Labels de opciones de datos personales (mismos valores que el form y que reservations/index.vue).
const SEX_LABELS: Record<string, string> = { male: 'Masculino', female: 'Femenino', other: 'Otro' }
const sexLabel = (v?: string): string => (v && SEX_LABELS[v]) || '—'
const docTypeLabel = (v?: string): string => DOC_TYPES.find(d => d.v === v)?.l ?? (v || '—')

// Mapea un guest del backend a la fila de tabla, enriquecida con su última visita
// y si está hospedado hoy (cruzando contra las reservas del hotel ya cargadas).
function mapGuestRow(g: any) {
  const gResv = reservationsCache.value.filter((r: any) => r.guestId === g.id && r.status !== 'cancelled')
  const counted = gResv.filter((r: any) => r.status === 'checked_out' || r.status === 'checked_in')
  const lastVisitIso = counted.length ? counted.map((r: any) => r.checkOut).filter(Boolean).sort().reverse()[0] : ''
  return {
    id: g.id,
    name: g.name ?? '',
    initials: initialsOf(g.name),
    email: g.email ?? '',
    phone: g.phone ?? '',
    nationality: g.nationality ?? '',
    document: g.document ?? '',
    birthDate: g.birthDate ?? '',
    stays: g.totalStays,
    totalSpent: g.totalSpent,
    points: g.loyaltyPoints,
    lastVisit: lastVisitIso ? fmtDate(lastVisitIso) : '',
    preferences: g.preferences ?? [],
    notes: g.notes ?? '',
    language: g.language ?? '',
    loyaltyPoints: g.loyaltyPoints ?? 0,
    tier: g.tier ?? '',
    sex: g.sex ?? '',
    country: g.country ?? '',
    address: g.address ?? '',
    city: g.city ?? '',
    province: g.province ?? '',
    documentType: g.documentType ?? '',
    documentIssueDate: g.documentIssueDate ?? '',
    profession: g.profession ?? '',
    emergencyContact: g.emergencyContact ?? { name: '', phone: '', relation: '', email: '' },
    isActiveToday: gResv.some(isActiveNow),
    history: [],
  }
}

// Carga guests + reservas del hotel (limit 100) en paralelo; 1 sola llamada de reservas
// sirve para derivar lastVisit y activeToday por fila (sin N+1).
async function loadGuests() {
  try {
    const [{ guests: data }, resResult] = await Promise.all([
      GuestService.list({ hotelId: hotelId.value }),
      ReservationService.list({ hotelId: hotelId.value, limit: RESV_FETCH_LIMIT }).catch(() => ({ reservations: [], total: 0 })),
    ])
    reservationsCache.value = resResult.reservations
    guests.value = data.map(mapGuestRow)
  } catch { toast.error("Error al cargar datos") }
}

onMounted(loadGuests)

const activeToday = computed(() => guests.value.filter((g: any) => g.isActiveToday).length)
const frequentGuests = computed(() => guests.value.filter((g: any) => g.stays >= FREQUENT_STAYS_THRESHOLD).length)
const totalPoints = computed(() => guests.value.reduce((sum: number, g: any) => sum + (g.points ?? 0), 0))

const filteredGuests = computed(() => {
  let result = guests.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.phone.includes(q)
    )
  }

  if (filterType.value === 'frequent') result = result.filter(g => g.stays >= FREQUENT_STAYS_THRESHOLD)
  else if (filterType.value === 'new') result = result.filter(g => g.stays <= 1)
  else if (filterType.value === 'vip') result = result.filter(g => g.totalSpent >= VIP_SPEND_THRESHOLD)

  return result
})

// Paginación de la vista (client-side) sobre el resultado filtrado.
const totalFiltered = computed(() => filteredGuests.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalFiltered.value / PAGE_SIZE)))
const paginatedGuests = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredGuests.value.slice(start, start + PAGE_SIZE)
})

// Al buscar o cambiar de filtro, volver a la primera página; clampear si el universo se reduce (p.ej. tras borrar).
watch([searchQuery, filterType], () => { currentPage.value = 1 })
watch(totalPages, (tp) => { if (currentPage.value > tp) currentPage.value = tp })

function goToPage(n: number) {
  currentPage.value = Math.min(Math.max(1, n), totalPages.value)
}

function guestAvatarClass(guest: any) {
  if (guest.totalSpent >= VIP_SPEND_THRESHOLD) return 'bg-gold/10 text-gold'
  if (guest.stays >= FREQUENT_STAYS_THRESHOLD) return 'bg-teal/10 text-teal'
  return 'bg-navy/10 text-navy'
}

const viewGuestAvatarClass = computed(() => {
  if (!viewGuest.value) return ''
  if (viewGuest.value.totalSpent >= VIP_SPEND_THRESHOLD) return 'bg-gold/20 text-gold'
  if (viewGuest.value.stays >= FREQUENT_STAYS_THRESHOLD) return 'bg-teal/20 text-teal'
  return 'bg-navy/20 text-navy'
})

const TIER_META: Record<string, { label: string; color: string }> = {
  bronze: { label: 'Bronce', color: 'text-text-secondary' },
  silver: { label: 'Plata', color: 'text-text-muted' },
  gold: { label: 'Oro', color: 'text-gold' },
  platinum: { label: 'Platino', color: 'text-cyan' },
}

const viewGuestTier = computed(() => {
  if (!viewGuest.value) return { label: '', color: '' }
  // tier real persistido en el guest; si no hay, se infiere por gasto/estadías
  const t = viewGuest.value.tier
  if (t && TIER_META[t]) return TIER_META[t]
  if (viewGuest.value.totalSpent >= VIP_SPEND_THRESHOLD) return { label: 'VIP', color: 'text-gold' }
  if (viewGuest.value.stays >= FREQUENT_STAYS_THRESHOLD) return { label: 'Frecuente', color: 'text-teal' }
  return { label: 'Regular', color: 'text-navy' }
})

async function openViewGuest(guest: any) {
  // Abre el modal con placeholders y carga reservas + historial de puntos en paralelo.
  viewGuest.value = { ...guest, history: [], pointsHistory: [], sales: null, loadingDetail: true }
  showViewModal.value = true
  try {
    const [{ reservations }, pointsHistory] = await Promise.all([
      ReservationService.list({ guestId: guest.id, hotelId: hotelId.value, limit: RESV_FETCH_LIMIT }),
      CrmService.getPointsHistory(guest.id).catch(() => []),
    ])
    const stays = reservations
      .filter(r => r.status !== 'cancelled')
      .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime())
    const counted = stays.filter(r => r.status === 'checked_out' || r.status === 'checked_in')
    const firstVisit = stays.length ? stays[stays.length - 1].checkIn : ''
    const lastVisit = counted.length ? counted[0].checkOut : (stays[0]?.checkOut ?? '')
    const totalResvSpent = stays.reduce((s, r) => s + (r.totalAmount ?? 0), 0)
    viewGuest.value = {
      ...viewGuest.value,
      history: stays.slice(0, DETAIL_HISTORY_LIMIT).map(r => ({
        id: r.id,
        dates: `${fmtDate(r.checkIn)} → ${fmtDate(r.checkOut)}`,
        nights: nightsBetween(r.checkIn, r.checkOut),
        total: (r.totalAmount ?? 0).toLocaleString(),
        status: r.status,
        channel: r.source ?? '',
      })),
      pointsHistory: [...pointsHistory].sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, DETAIL_HISTORY_LIMIT),
      sales: {
        reservationsCount: reservations.length,
        avgPerStay: counted.length > 0 ? Math.round(totalResvSpent / counted.length) : 0,
        firstVisit,
        lastVisit,
        daysSinceLastVisit: daysSince(lastVisit),
        totalResvSpent,
      },
      loadingDetail: false,
    }
  } catch {
    viewGuest.value = { ...viewGuest.value, loadingDetail: false }
  }
}

function closeViewModal() {
  showViewModal.value = false
  viewGuest.value = null
}

function openNewGuest() {
  editingGuest.value = null
  form.value = { name: '', email: '', phone: '', nationality: '', document: '', documentType: '', documentIssueDate: '', birthDate: '', sex: '', language: '', country: '', address: '', city: '', province: '', loyaltyPoints: 0, tier: '', profession: '', emergencyContact: { name: '', phone: '', relation: '', email: '' }, preferences: [], notes: '' }
  formStep.value = 1
  showFormModal.value = true
}

function openEditGuest(guest: any) {
  editingGuest.value = { id: guest.id }
  form.value = {
    name: guest.name,
    email: guest.email,
    phone: guest.phone,
    nationality: guest.nationality,
    document: guest.document,
    documentType: guest.documentType ?? '',
    documentIssueDate: guest.documentIssueDate ?? '',
    birthDate: guest.birthDate ?? '',
    sex: guest.sex ?? '',
    language: guest.language ?? '',
    country: guest.country ?? '',
    address: guest.address ?? '',
    city: guest.city ?? '',
    province: guest.province ?? '',
    loyaltyPoints: guest.loyaltyPoints ?? 0,
    tier: guest.tier ?? '',
    profession: guest.profession ?? '',
    emergencyContact: { name: guest.emergencyContact?.name ?? '', phone: guest.emergencyContact?.phone ?? '', relation: guest.emergencyContact?.relation ?? '', email: guest.emergencyContact?.email ?? '' },
    preferences: [...(guest.preferences ?? [])],
    notes: guest.notes ?? '',
  }
  formStep.value = 1
  showFormModal.value = true
}

function closeFormModal() {
  showFormModal.value = false
  editingGuest.value = null
}

function togglePreference(pref: string) {
  const idx = form.value.preferences.indexOf(pref)
  if (idx >= 0) form.value.preferences.splice(idx, 1)
  else form.value.preferences.push(pref)
}

async function saveGuest() {
  if (!form.value.name || !form.value.email) { toast.warning('Nombre y email requeridos'); return }

  try {
    if (editingGuest.value) {
      await GuestService.update(editingGuest.value.id, {
        name: form.value.name,
        email: form.value.email,
        phone: form.value.phone,
        nationality: form.value.nationality,
        document: form.value.document,
        documentType: form.value.documentType,
        documentIssueDate: form.value.documentIssueDate,
        birthDate: form.value.birthDate,
        sex: form.value.sex,
        country: form.value.country,
        address: form.value.address,
        city: form.value.city,
        province: form.value.province,
        language: form.value.language,
        loyaltyPoints: Number(form.value.loyaltyPoints) || 0,
        tier: form.value.tier,
        profession: form.value.profession,
        emergencyContact: form.value.emergencyContact,
        preferences: form.value.preferences,
        notes: form.value.notes,
        hotelId: hotelId.value,
      })
      toast.success('Huésped actualizado')
    } else {
      await GuestService.create({
        name: form.value.name,
        email: form.value.email,
        phone: form.value.phone,
        nationality: form.value.nationality,
        document: form.value.document,
        documentType: form.value.documentType,
        documentIssueDate: form.value.documentIssueDate,
        birthDate: form.value.birthDate,
        sex: form.value.sex,
        country: form.value.country,
        address: form.value.address,
        city: form.value.city,
        province: form.value.province,
        language: form.value.language,
        loyaltyPoints: Number(form.value.loyaltyPoints) || 0,
        tier: form.value.tier,
        profession: form.value.profession,
        emergencyContact: form.value.emergencyContact,
        preferences: form.value.preferences,
        notes: form.value.notes,
        hotelId: hotelId.value,
      })
      toast.success('Huésped creado')
    }
    await loadGuests()
    closeFormModal()
  } catch {
    toast.error('Error al guardar huésped')
  }
}
</script>
