<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-black text-navy">Reservas</h2>
      <div class="flex gap-2">
        <button @click="exportCSV" class="bg-white border border-border text-navy font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-surface cursor-pointer">⬇ CSV</button>
        <button @click="openNew" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg cursor-pointer">+ Nueva Reserva</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <div v-for="s in statsCards" :key="s.label" class="card p-4 text-center">
        <div class="text-2xl font-black" :class="s.color">{{ s.value }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">{{ s.label }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <input v-model="search" type="text" placeholder="Buscar huésped..." class="px-4 py-2 rounded-xl border border-border text-sm w-48 focus:outline-none focus:border-navy" />
      <select v-model="filterStatus" class="px-3 py-2 rounded-xl border border-border text-xs font-bold cursor-pointer">
        <option value="">Todos</option>
        <option value="confirmed">Confirmadas</option><option value="pending">Pendientes</option>
        <option value="checked_in">Check-in</option><option value="checked_out">Check-out</option><option value="cancelled">Canceladas</option>
      </select>
      <select v-model="filterChannel" class="px-3 py-2 rounded-xl border border-border text-xs font-bold cursor-pointer">
        <option value="">Todos canales</option>
        <option value="direct">Directa</option><option value="booking">Booking</option><option value="expedia">Expedia</option><option value="airbnb">Airbnb</option>
      </select>
      <span class="text-xs text-text-muted ml-auto">{{ filtered.length }} reservas</span>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-border overflow-hidden">
      <table class="w-full">
        <thead><tr class="border-b border-border bg-surface/50">
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Huésped</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Hab</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Check-in</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Check-out</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">N</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Canal</th>
          <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Total</th>
          <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase"></th>
        </tr></thead>
        <tbody>
          <tr v-for="r in filtered" :key="r.id" class="border-b border-border last:border-0 hover:bg-surface/50 cursor-pointer" @click="openDetail(r)">
            <td class="p-4"><div class="font-bold text-sm text-navy">{{ r.guestName }}</div><div class="text-[10px] text-text-muted">{{ r.email }}</div></td>
            <td class="p-4 text-sm font-bold">{{ r.roomNumber }}</td>
            <td class="p-4 text-sm">{{ fmtDate(r.checkIn) }}</td>
            <td class="p-4 text-sm">{{ fmtDate(r.checkOut) }}</td>
            <td class="p-4 text-sm font-bold">{{ r.nights }}n</td>
            <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="stClass(r.status)">{{ stLabel(r.status) }}</span></td>
            <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="srcClass(r.source)">{{ srcLabel(r.source) }}</span></td>
            <td class="p-4 text-right text-sm font-extrabold text-navy">${{ r.total }}</td>
            <td class="p-4 text-right" @click.stop>
              <button v-if="r.status==='confirmed'" @click="confirmAction('checkin',r)" class="px-2 py-1 bg-teal/10 text-teal rounded-lg text-[10px] font-bold cursor-pointer hover:bg-teal/20 mr-1">Check-in</button>
              <button v-if="r.status==='pending'||r.status==='confirmed'" @click="confirmAction('cancel',r)" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold cursor-pointer hover:bg-coral/20 mr-1">Cancelar</button>
              <button v-if="r.status==='pending'||r.status==='cancelled'" @click="confirmAction('delete',r)" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold cursor-pointer hover:bg-coral/20">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ═══════════════════════════ MODAL NUEVA RESERVA ═══════════════════════════ -->
    <Teleport to="body">
      <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">

          <!-- Header -->
          <div class="p-5 border-b border-border flex items-center justify-between shrink-0 bg-gradient-to-r from-navy to-navy/90">
            <div class="flex items-center gap-3">
              <h3 class="text-lg font-black text-white">{{ modal.edit ? 'Editar' : 'Nueva' }} Reserva</h3>
              <div class="flex gap-1.5">
                <button v-for="s in ['confirmed','pending','checked_in','cancelled']" :key="s" @click="form.status=s"
                  class="px-3 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-all"
                  :class="form.status===s ? stBtnActive(s) : 'border-white/20 text-white/60 hover:text-white'">
                  {{ stLabel(s) }}
                </button>
              </div>
            </div>
            <button @click="modal.show=false" class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white cursor-pointer hover:bg-white/20">✕</button>
          </div>

          <!-- Body scrollable -->
          <div class="flex-1 overflow-y-auto">
            <div class="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

              <!-- ═══ COLUMNA IZQUIERDA: CLIENTE + EMERGENCIA ═══ -->
              <div class="p-5 space-y-6">

                <!-- ── Sección Cliente ── -->
                <div class="bg-navy/5 border border-navy/10 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-4 pb-2 border-b border-border/50">
                    <span class="w-6 h-6 rounded-lg bg-navy/10 flex items-center justify-center text-sm">👤</span>
                    <h4 class="text-sm font-black text-navy">Datos del Cliente</h4>
                  </div>
                  <div class="space-y-3">
                    <!-- Buscador de huésped existente (evita duplicar) -->
                    <div class="bg-teal/5 border border-teal/20 rounded-lg p-3">
                      <label class="block text-[11px] font-bold text-teal mb-1">🔎 Buscar huésped existente</label>
                      <div class="relative">
                        <input :value="guestSearch" @input="onGuestSearchInput" type="text" placeholder="Nombre, documento o email…" class="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition" @blur="blurGuestSearch" />
                        <ul v-if="guestSearchOpen && guestResults.length" class="absolute z-40 mt-1 w-full max-h-48 overflow-auto bg-white border border-border rounded-lg shadow-lg">
                          <li v-for="g in guestResults" :key="g.id" @mousedown.prevent="selectGuest(g)" class="px-3 py-2 text-sm cursor-pointer hover:bg-teal/10">
                            <div class="font-bold text-navy">{{ g.name }}</div>
                            <div class="text-[11px] text-text-muted">{{ g.document || 'Sin documento' }} · {{ g.email || g.phone || 'Sin contacto' }}</div>
                          </li>
                        </ul>
                      </div>
                      <p v-if="selectedGuestId" class="text-[11px] text-teal mt-1 font-semibold">✓ Huésped existente: se reutiliza (no se crea uno nuevo)</p>
                    </div>
                    <!-- Nombre completo -->
                    <div>
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">Nombre completo <span class="text-coral">*</span></label>
                      <input v-model="form.name" type="text" placeholder="Nombre y apellido" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                    </div>
                    <!-- Email + Teléfono -->
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Email</label>
                        <input v-model="form.email" type="email" placeholder="correo@ejemplo.com" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Teléfono</label>
                        <input v-model="form.phone" type="tel" placeholder="+1 809 000 0000" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                      </div>
                    </div>
                    <!-- País + Nacionalidad + Idioma -->
                    <div class="grid grid-cols-3 gap-3">
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">País</label>
                        <SearchSelect v-model="form.country" :options="countries" placeholder="Buscar país..." />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Nacionalidad</label>
                        <SearchSelect v-model="form.nationality" :options="nationalities" placeholder="Buscar nacionalidad..." />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Idioma</label>
                        <select v-model="form.language" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition">
                          <option v-for="l in languages" :key="l.v" :value="l.v">{{ l.l }}</option>
                        </select>
                      </div>
                    </div>
                    <!-- Dirección + Ciudad -->
                    <div class="grid grid-cols-3 gap-3">
                      <div class="col-span-2">
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Dirección</label>
                        <input v-model="form.address" type="text" placeholder="Calle, número..." class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Ciudad</label>
                        <input v-model="form.city" type="text" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                      </div>
                    </div>
                    <!-- Provincia + Sexo + Nacimiento -->
                    <div class="grid grid-cols-3 gap-3">
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Provincia</label>
                        <input v-model="form.province" type="text" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Sexo</label>
                        <select v-model="form.sex" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition">
                          <option value="">—</option>
                          <option value="male">Masculino</option>
                          <option value="female">Femenino</option>
                          <option value="other">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Nacimiento</label>
                        <input v-model="form.birthDate" type="date" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                      </div>
                    </div>
                    <!-- Documento -->
                    <div class="grid grid-cols-3 gap-3">
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Tipo documento</label>
                        <select v-model="form.documentType" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition">
                          <option v-for="d in docTypes" :key="d.v" :value="d.v">{{ d.l }}</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">N° documento</label>
                        <input v-model="form.document" type="text" placeholder="000-0000000-0" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Exp. documento</label>
                        <input v-model="form.documentIssueDate" type="date" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                      </div>
                    </div>
                    <!-- Comunicar + Observaciones -->
                    <div>
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">Comunicar al cliente</label>
                      <select v-model="form.communicateClient" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition">
                        <option value="none">No enviar bono</option>
                        <option value="email_confirmation">Enviar email de confirmación</option>
                        <option value="email_presaless">Enviar email preventa</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">Observaciones</label>
                      <textarea v-model="form.guestNotes" rows="2" placeholder="Notas para el propietario (se incluye en el bono)..." class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"></textarea>
                    </div>
                  </div>
                </div>

                <!-- ── Contacto de Emergencia ── -->
                <div class="bg-coral/5 border border-coral/15 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-4 pb-2 border-b border-coral/30">
                    <span class="w-6 h-6 rounded-lg bg-coral/10 flex items-center justify-center text-sm">🚨</span>
                    <h4 class="text-sm font-black text-coral">Contacto de Emergencia</h4>
                  </div>
                  <div class="space-y-3">
                    <div>
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">Nombre completo</label>
                      <input v-model="form.emergencyName" type="text" placeholder="Nombre del contacto de emergencia" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition" />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Teléfono</label>
                        <input v-model="form.emergencyPhone" type="tel" placeholder="+1 809 000 0000" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition" />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Parentesco</label>
                        <select v-model="form.emergencyRelation" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition">
                          <option value="">Seleccionar...</option>
                          <option v-for="r in relations" :key="r" :value="r">{{ r }}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">Email <span class="text-text-muted font-normal">(opcional)</span></label>
                      <input v-model="form.emergencyEmail" type="email" placeholder="contacto@ejemplo.com" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition" />
                    </div>
                  </div>
                </div>

                <!-- OTA (condicional) -->
                <div v-if="form.source!=='direct'" class="bg-surface rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                    <span class="text-sm">🌐</span>
                    <h4 class="text-sm font-black text-navy">Datos del Canal</h4>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">Comisión (%)</label>
                      <input v-model.number="form.commission" type="number" min="0" max="50" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white" />
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">Locator OTA</label>
                      <input v-model="form.extLocator" type="text" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white" />
                    </div>
                  </div>
                </div>

                <!-- ── Acompañantes (companions) ── -->
                <div class="bg-surface rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                    <span class="text-sm">👥</span>
                    <h4 class="text-sm font-black text-navy">Acompañantes</h4>
                    <button type="button" @click="addCompanion" class="ml-auto text-[11px] font-bold text-cyan hover:underline cursor-pointer">+ agregar</button>
                  </div>
                  <p v-if="!form.companions.length" class="text-[11px] text-text-muted italic">Sin acompañantes adicionales</p>
                  <div v-for="(c, i) in form.companions" :key="i" class="grid grid-cols-12 gap-2 mb-2 items-center">
                    <input v-model="c.name" type="text" placeholder="Nombre completo" class="col-span-5 px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                    <select v-model="c.documentType" class="col-span-3 px-2 py-2 rounded-lg border border-border text-xs bg-white cursor-pointer">
                      <option value="dni">DNI</option><option value="passport">Pasaporte</option><option value="other">Otro</option>
                    </select>
                    <input v-model="c.documentNumber" type="text" placeholder="N° documento" class="col-span-3 px-2 py-2 rounded-lg border border-border text-xs bg-white" />
                    <button type="button" @click="removeCompanion(i)" class="col-span-1 text-coral hover:bg-coral/10 rounded-lg text-sm cursor-pointer">✕</button>
                  </div>
                </div>
              </div>

              <!-- ═══ COLUMNA DERECHA: FORMA DE PAGO + TARJETA + ALOJAMIENTO + ANTICIPO ═══ -->
              <div class="p-5 space-y-6">

                <!-- ── Forma de pago (encima de datos de tarjeta) ── -->
                <div class="bg-navy/5 border border-navy/15 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-3 pb-2 border-b border-navy/20">
                    <span class="w-6 h-6 rounded-lg bg-navy/10 flex items-center justify-center text-sm">💰</span>
                    <h4 class="text-sm font-black text-navy">Forma de pago</h4>
                  </div>
                  <label class="block text-[11px] font-bold text-text-secondary mb-1">Método de pago</label>
                  <select v-model="form.payMethod" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition">
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                    <option value="cash">Efectivo</option>
                    <option value="link">Link de pago</option>
                  </select>
                </div>

                <!-- ── Tarjeta de garantía (siempre visible: es garantía, independiente de la forma de pago) ── -->
                <div class="bg-purple/5 border border-purple/15 rounded-xl p-4">
                  <h4 class="text-sm font-black text-navy mb-4">Tarjeta de garantía <span class="text-lg">🔒</span></h4>
                  <div v-if="existingGuarantee" class="mb-3 rounded-lg bg-navy/5 border border-navy/15 px-3 py-2 text-[11px] leading-relaxed text-navy">
                    Ya hay una tarjeta de garantía cargada. Para verla abrí <strong>Ver reserva</strong> e ingresá el PIN. Ingresá una nueva tarjeta acá solo si querés <strong>reemplazarla</strong>.
                  </div>
                  <div class="grid grid-cols-3 gap-3">
                    <div class="col-span-2">
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">Titular de la tarjeta</label>
                      <input v-model="form.cardHolder" type="text" placeholder="Nombre como aparece en la tarjeta" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">Tipo tarjeta</label>
                      <select v-model="form.cardBrand" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition">
                        <option value="visa">Visa</option>
                        <option value="mastercard">Mastercard</option>
                        <option value="amex">Amex</option>
                        <option value="discover">Discover</option>
                        <option value="other">Otra</option>
                      </select>
                    </div>
                  </div>
                  <div class="grid grid-cols-3 gap-3 mt-3">
                    <div class="col-span-2">
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">N° tarjeta</label>
                      <input v-model="form.cardNumber" type="text" maxlength="19" placeholder="XXXX XXXX XXXX XXXX" @input="formatCardNumber" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">CVV</label>
                      <input v-model="form.cardCvv" type="text" maxlength="4" placeholder="XXX" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                    </div>
                  </div>
                  <div class="mt-3">
                    <label class="block text-[11px] font-bold text-text-secondary mb-1">Caducidad</label>
                    <input v-model="form.cardExpiry" @input="formatExpiry" type="text" inputmode="numeric" maxlength="7" placeholder="MM/AAAA" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                  </div>
                </div>

                <!-- ── Alojamiento ── -->
                <div>
                  <div class="flex items-center gap-2 mb-4 pb-2 border-b border-border/50">
                    <span class="w-6 h-6 rounded-lg bg-navy/10 flex items-center justify-center text-sm">🏨</span>
                    <h4 class="text-sm font-black text-navy">Alojamiento</h4>
                  </div>
                  <div class="space-y-3">
                    <!-- Fechas -->
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Check-in <span class="text-coral">*</span></label>
                        <input v-model="form.checkIn" type="date" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Check-out <span class="text-coral">*</span></label>
                        <input v-model="form.checkOut" type="date" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                      </div>
                    </div>
                    <!-- Habitación + Régimen -->
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Habitación</label>
                        <SearchSelect v-model="form.roomId" :options="roomOptions" placeholder="Seleccionar..." />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Régimen</label>
                        <select v-model="form.regime" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition">
                          <option value="room_only">Solo alojamiento</option>
                          <option value="breakfast">Desayuno incluido</option>
                          <option value="half_board">Media pensión</option>
                          <option value="full_board">Pensión completa</option>
                          <option value="all_inclusive">Todo incluido</option>
                        </select>
                      </div>
                    </div>
                    <!-- Personas -->
                    <div class="grid grid-cols-3 gap-3">
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Adultos</label>
                        <input v-model.number="form.adults" type="number" min="1" max="10" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Niños</label>
                        <input v-model.number="form.children" type="number" min="0" max="10" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                      </div>
                      <div>
                        <label class="block text-[11px] font-bold text-text-secondary mb-1">Noches</label>
                        <div class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-surface font-bold text-navy">{{ nights }}</div>
                      </div>
                    </div>
                    <!-- Promo -->
                    <div>
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">Código promocional</label>
                      <input v-model="form.promoCode" type="text" placeholder="Opcional" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                    </div>
                    <!-- Resumen precio -->
                    <div v-if="selRoom && form.checkIn && form.checkOut" class="bg-surface rounded-xl p-4 space-y-2">
                      <div class="text-[11px] font-bold text-text-muted uppercase mb-2">Habitación {{ selRoom.number }} — {{ selRoom.type }}</div>
                      <div class="flex justify-between text-sm"><span class="text-text-secondary">{{ nights }} noches × ${{ selRoom.basePrice }}</span><span class="font-bold text-navy">${{ selRoom.basePrice * nights }}</span></div>
                      <div class="flex justify-between text-sm"><span class="text-text-secondary">Impuestos (10%)</span><span class="font-bold text-navy">${{ taxes }}</span></div>
                      <div v-if="form.regime !== 'room_only'" class="flex justify-between text-sm"><span class="text-text-secondary">Régimen</span><span class="font-bold text-teal">{{ regimeLabel }}</span></div>
                    </div>
                  </div>
                </div>

                <!-- ── Anticipo y Total ── -->
                <div class="bg-teal/5 border border-teal/15 rounded-xl p-4">
                  <h4 class="text-sm font-black text-navy mb-4">Anticipo y total</h4>
                  <!-- Inputs -->
                  <div class="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">Cálculo de porcentaje (%)</label>
                      <input v-model.number="form.depositPercentage" type="number" min="0" max="100" @input="calcDepositFromPercentage" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                    </div>
                    <div>
                      <label class="block text-[11px] font-bold text-text-secondary mb-1">Estado del anticipo</label>
                      <select v-model="form.depositStatus" class="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition">
                        <option value="unpaid">Sin pagar</option>
                        <option value="partial">Parcial</option>
                        <option value="paid">Pagado</option>
                      </select>
                    </div>
                    <div></div>
                  </div>
                  <!-- Desglose financiero -->
                  <div v-if="selRoom && form.checkIn && form.checkOut" class="bg-white rounded-lg border border-border p-3 space-y-1.5 text-sm">
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
                <div v-if="editId" class="bg-surface rounded-xl p-4">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <span class="text-sm">🔐</span>
                      <span class="text-sm font-black text-navy">Cerradura</span>
                    </div>
                    <button @click="generateLockCode" class="text-xs font-bold text-teal hover:underline cursor-pointer">
                      {{ lockCode ? '↻ Regenerar' : '+ Generar código' }}
                    </button>
                  </div>
                  <div v-if="lockCode" class="text-center py-3 bg-white rounded-lg border-2 border-dashed border-teal">
                    <div class="text-[10px] font-bold text-text-muted uppercase">Código de acceso</div>
                    <div class="text-2xl font-black text-teal tracking-wider mt-1">{{ lockCode }}</div>
                  </div>
                  <div v-else class="text-xs text-text-muted text-center py-2">Sin código generado</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Error de validación / disponibilidad (visible para el usuario) -->
          <div v-if="err" class="px-4 py-3 bg-coral/10 border-t border-b border-coral/30 text-sm font-bold text-coral flex items-center gap-2 shrink-0">
            <span>⚠️</span><span>{{ err }}</span>
          </div>

          <!-- Footer -->
          <div class="p-4 border-t border-border bg-surface/80 shrink-0 flex items-center justify-between">
            <div class="text-sm font-extrabold text-navy">Total: <span class="text-xl text-navy">${{ total }}</span></div>
            <div class="flex gap-3">
              <button @click="modal.show=false" class="px-5 py-2.5 border border-border rounded-lg text-sm font-bold text-text-secondary cursor-pointer hover:bg-surface transition">Cancelar</button>
              <button @click="save" :disabled="saving" class="px-6 py-2.5 bg-teal text-white rounded-lg text-sm font-black cursor-pointer hover:opacity-90 disabled:opacity-50 transition">
                {{ saving ? 'Guardando...' : (modal.edit ? 'Actualizar Reserva' : 'Crear Reserva') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Confirm Dialog -->
    <Teleport to="body">
      <div v-if="cfg.show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="cfg.show=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
          <div class="text-3xl mb-3">{{ cfg.icon }}</div>
          <h3 class="text-lg font-black text-navy mb-2">{{ cfg.title }}</h3>
          <p class="text-sm text-text-secondary">{{ cfg.msg }}</p>
          <div class="flex gap-3 mt-6">
            <button @click="cfg.show=false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="cfg.fn();cfg.show=false" class="flex-1 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer" :class="cfg.btn">Confirmar</button>
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

const chList = [
  { v: 'direct', l: 'Directa', i: '🏨' }, { v: 'booking', l: 'Booking', i: '🌐' },
  { v: 'expedia', l: 'Expedia', i: '✈️' }, { v: 'airbnb', l: 'Airbnb', i: '🏠' },
  { v: 'google', l: 'Google', i: '🔍' }, { v: 'whatsapp', l: 'WhatsApp', i: '💬' },
  { v: 'phone', l: 'Teléfono', i: '📞' },
]

// ── Computed ──
const today = new Date().toISOString().split('T')[0]

const statsCards = computed(() => {
  const ti = list.value.filter((r: any) => r.checkIn === today && (r.status === 'confirmed' || r.status === 'checked_in')).length
  const to = list.value.filter((r: any) => r.checkOut === today && r.status === 'checked_in').length
  const tr = list.value.filter((r: any) => r.checkIn === today).reduce((s: number, r: any) => s + (r.total || 0), 0)
  const all = list.value.filter((r: any) => r.status !== 'cancelled').reduce((s: number, r: any) => s + (r.total || 0), 0)
  return [
    { label: 'Check-ins Hoy', value: String(ti), color: 'text-navy' },
    { label: 'Check-outs Hoy', value: String(to), color: 'text-coral' },
    { label: 'Ingresos Hoy', value: '$' + tr, color: 'text-teal' },
    { label: 'Total Facturado', value: '$' + all, color: 'text-purple' },
    { label: 'Pendientes', value: String(list.value.filter((r: any) => r.status === 'pending').length), color: 'text-gold' },
    { label: 'Confirmadas', value: String(list.value.filter((r: any) => r.status === 'confirmed').length), color: 'text-cyan' },
  ]
})

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

const regimeLabel = computed(() => {
  const m: Record<string, string> = {
    room_only: 'Sólo alojamiento', breakfast: 'Desayuno incluido',
    half_board: 'Media pensión', full_board: 'Pensión completa', all_inclusive: 'Todo incluido',
  }
  return m[form.value.regime] || form.value.regime
})

// ── Helpers ──
function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) }
function stLabel(s: string) { const m: any = { pending: 'Pendiente', confirmed: 'Confirmada', checked_in: 'Check-in', checked_out: 'Check-out', cancelled: 'Cancelada' }; return m[s] || s }
function stClass(s: string) { const m: any = { pending: 'bg-gold/10 text-gold', confirmed: 'bg-teal/10 text-teal', checked_in: 'bg-cyan/10 text-cyan', checked_out: 'bg-gray-100 text-gray-500', cancelled: 'bg-coral/10 text-coral' }; return m[s] || '' }
function stBtnActive(s: string) { const m: any = { pending: 'border-gold bg-gold text-white', confirmed: 'border-blue-500 bg-blue-500 text-white', checked_in: 'border-teal bg-teal text-white', cancelled: 'border-coral bg-coral text-white' }; return m[s] || '' }
function srcLabel(s: string) { const m: any = { direct: 'Directa', booking: 'Booking', expedia: 'Expedia', airbnb: 'Airbnb', google: 'Google', whatsapp: 'WhatsApp', phone: 'Teléfono' }; return m[s] || s }
function srcClass(s: string) { const m: any = { direct: 'bg-teal/10 text-teal', booking: 'bg-cyan/10 text-cyan', expedia: 'bg-gold/10 text-gold', airbnb: 'bg-coral/10 text-coral', google: 'bg-blue-100 text-blue-700', whatsapp: 'bg-emerald-100 text-emerald-700' }; return m[s] || 'bg-gray-100 text-gray-500' }

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
  // Validación de campos obligatorios (igual que MisterPlan): nombre, apellido, habitación,
  // fechas coherentes y al menos un contacto. La disponibilidad de la habitación la valida el backend.
  const missing: string[] = []
  if (!form.value.name?.trim()) missing.push('nombre')
  if (!form.value.roomId) missing.push('habitación')
  if (!form.value.checkIn) missing.push('check-in')
  if (!form.value.checkOut) missing.push('check-out')
  else if (form.value.checkIn && form.value.checkOut <= form.value.checkIn) missing.push('el check-out debe ser posterior al check-in')
  if (!form.value.email?.trim() && !form.value.phone?.trim()) missing.push('email o teléfono')
  else if (form.value.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email.trim())) missing.push('email con formato válido')
  if (missing.length) {
    err.value = 'Completá los campos obligatorios: ' + missing.join(', ') + '.'
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
