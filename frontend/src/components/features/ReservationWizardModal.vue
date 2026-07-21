<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="modal-panel relative bg-white rounded-[20px] border-2 border-navy shadow-2xl w-full max-w-5xl max-h-[95vh] sm:max-h-[92vh] overflow-hidden flex flex-col">

          <!-- Header -->
          <div class="p-5 border-b border-border shrink-0 bg-gradient-to-r from-navy to-navy/90">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3 min-w-0">
                <h3 class="text-lg font-black text-white leading-tight truncate">{{ isEdit ? 'Editar' : 'Nueva' }} Reserva</h3>
                <div class="hidden md:flex gap-1.5">
                  <button v-for="s in ['confirmed','pending','checked_in','cancelled']" :key="s" @click="form.status=s"
                    class="px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-pointer transition-all"
                    :class="form.status===s ? stBtnActive(s) : 'border-white/20 text-white/60 hover:text-white'">
                    {{ stLabel(s) }}
                  </button>
                </div>
              </div>
              <button @click="emit('close')" class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white cursor-pointer hover:bg-white/20 shrink-0">
                <span class="w-4 h-4 block" v-html="ICON_X"></span>
              </button>
            </div>
            <!-- Wizard progress -->
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-white">Paso {{ wizardStep }} de {{ WIZARD_STEPS.length }}</span>
              <span class="text-xs font-bold text-white/60">{{ WIZARD_STEPS[wizardStep-1].label }}</span>
            </div>
            <div class="h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div class="h-full bg-white rounded-full transition-all" :style="{ width: (wizardStep / WIZARD_STEPS.length * 100) + '%' }"></div>
            </div>
          </div>

          <!-- Body scrollable -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-6">

            <!-- ═══ PASO 1: HUÉSPED ═══ -->
            <div v-if="wizardStep === 1" class="space-y-4">
              <!-- Buscador de huésped existente -->
              <div>
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

              <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Nombre completo <span class="text-coral">*</span></label>
                  <input v-model="form.name" type="text" maxlength="80" placeholder="Nombre y apellido" class="w-full px-3.5 py-2.5 rounded-xl border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 transition" :class="nameError ? 'border-coral ring-2 ring-coral/20' : 'border-border focus:ring-navy/20 focus:border-navy'" />
                  <p v-if="nameError" class="text-[10px] text-coral font-semibold mt-1">{{ nameError }}</p>
                </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Email <span class="text-coral">*</span></label>
                    <input v-model="form.email" type="email" maxlength="100" placeholder="correo@ejemplo.com" class="w-full px-3.5 py-2.5 rounded-xl border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 transition" :class="(contactError || emailError) ? 'border-coral ring-2 ring-coral/20' : 'border-border focus:ring-cyan/20 focus:border-cyan'" />
                    <p v-if="emailError" class="text-[10px] text-coral font-semibold mt-1">{{ emailError }}</p>
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Teléfono <span class="text-coral">*</span></label>
                    <PhoneInput v-model="form.phone" :country="form.country" />
                  </div>
                <p v-if="contactError" class="sm:col-span-2 text-[10px] text-coral font-semibold -mt-2">{{ contactError }}</p>
                <p v-else class="sm:col-span-2 text-[10px] text-text-muted -mt-2">* Se requiere al menos un email o teléfono de contacto</p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">País</label>
                    <SearchSelect v-model="form.country" :options="countries" placeholder="Buscar..." />
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Nacionalidad</label>
                    <SearchSelect v-model="form.nationality" :options="nationalities" placeholder="Buscar..." />
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Idioma</label>
                    <select v-model="form.language" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition">
                      <option v-for="l in languages" :key="l.v" :value="l.v">{{ l.l }}</option>
                    </select>
                  </div>
              </div>
            </div>

            <!-- ═══ PASO 2: DETALLES ═══ -->
            <div v-if="wizardStep === 2" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Dirección</label>
                    <input v-model="form.address" type="text" maxlength="150" placeholder="Calle, número..." class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan transition" />
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Ciudad</label>
                    <input v-model="form.city" type="text" maxlength="60" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition" />
                  </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Provincia</label>
                    <input v-model="form.province" type="text" maxlength="60" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple transition" />
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Sexo</label>
                    <select v-model="form.sex" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition">
                      <option value="">—</option>
                      <option value="male">Masculino</option>
                      <option value="female">Femenino</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Nacimiento</label>
                    <input v-model="form.birthDate" type="date" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition" />
                  </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Tipo documento</label>
                    <select v-model="form.documentType" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition">
                      <option v-for="d in docTypes" :key="d.v" :value="d.v">{{ d.l }}</option>
                    </select>
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">N° documento</label>
                    <input v-model="form.document" type="text" maxlength="30" placeholder="000-0000000-0" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition" />
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Exp. documento</label>
                    <input v-model="form.documentIssueDate" type="date" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple transition" />
                  </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Comunicar al cliente</label>
                    <select v-model="form.communicateClient" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition">
                      <option value="none">No enviar bono</option>
                      <option value="email_confirmation">Enviar email de confirmación</option>
                      <option value="email_presaless">Enviar email preventa</option>
                    </select>
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Observaciones</label>
                    <input v-model="form.guestNotes" type="text" maxlength="300" placeholder="Notas para el bono..." class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
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
                  <div>
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Comisión (%)</label>
                      <input v-model.number="form.commission" type="number" min="0" max="50" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white transition" />
                    </div>
                  <div>
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Locator OTA</label>
                      <input v-model="form.extLocator" type="text" maxlength="50" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white transition" />
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
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Nombre completo</label>
                    <input v-model="form.emergencyName" type="text" maxlength="80" placeholder="Contacto de emergencia" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition" />
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Teléfono</label>
                    <PhoneInput v-model="form.emergencyPhone" :country="form.country" />
                  </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Parentesco</label>
                    <select v-model="form.emergencyRelation" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple transition">
                      <option value="">Seleccionar...</option>
                      <option v-for="r in relations" :key="r" :value="r">{{ r }}</option>
                    </select>
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Email <span class="text-text-muted font-normal normal-case">(opcional)</span></label>
                    <input v-model="form.emergencyEmail" type="email" maxlength="100" placeholder="contacto@ejemplo.com" class="w-full px-3.5 py-2.5 rounded-xl border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 transition" :class="emergencyEmailFormatError ? 'border-coral ring-2 ring-coral/20' : 'border-border focus:ring-cyan/20 focus:border-cyan'" />
                    <p v-if="emergencyEmailFormatError" class="text-[10px] text-coral font-semibold mt-1">{{ emergencyEmailFormatError }}</p>
                  </div>
              </div>
            </div>

            <!-- ═══ PASO 4: ALOJAMIENTO ═══ -->
            <div v-if="wizardStep === 4" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Check-in <span class="text-coral">*</span></label>
                    <input v-model="form.checkIn" type="date" class="w-full px-3.5 py-2.5 rounded-xl border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 transition" :class="checkInError ? 'border-coral ring-2 ring-coral/20' : 'border-border focus:ring-teal/20 focus:border-teal'" />
                    <p v-if="checkInError" class="text-[10px] text-coral font-semibold mt-1">{{ checkInError }}</p>
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Check-out <span class="text-coral">*</span></label>
                    <input v-model="form.checkOut" type="date" class="w-full px-3.5 py-2.5 rounded-xl border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 transition" :class="checkOutError ? 'border-coral ring-2 ring-coral/20' : 'border-border focus:ring-coral/20 focus:border-coral'" />
                    <p v-if="checkOutError" class="text-[10px] text-coral font-semibold mt-1">{{ checkOutError }}</p>
                  </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Habitación <span class="text-coral">*</span></label>
                    <SearchSelect v-model="form.roomId" :options="roomOptions" placeholder="Seleccionar..." />
                    <p v-if="roomError" class="text-[10px] text-coral font-semibold mt-1">{{ roomError }}</p>
                  </div>
                <div>
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

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Adultos</label>
                    <input v-model.number="form.adults" type="number" min="1" max="10" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan transition" />
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Niños</label>
                    <input v-model.number="form.children" type="number" min="0" max="10" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition" />
                  </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Noches</label>
                    <div class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface font-bold text-navy">{{ nights }}</div>
                  </div>
              </div>

              <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Código promocional</label>
                  <input v-model="form.promoCode" type="text" maxlength="30" placeholder="Opcional" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition" />
                </div>

              <!-- Resumen precio -->
              <div v-if="selRoom && form.checkIn && form.checkOut" class="bg-surface rounded-2xl p-4 space-y-2">
                <div class="text-[11px] font-bold text-text-muted uppercase mb-2">Habitación {{ selRoom.number }} — {{ selRoom.type }}</div>
                <div class="flex justify-between text-sm"><span class="text-text-secondary">{{ nights }} noches × ${{ selRoom.basePrice }}</span><span class="font-bold text-navy">${{ selRoom.basePrice * nights }}</span></div>
                <div class="flex justify-between text-sm"><span class="text-text-secondary">Impuestos ({{ taxRatePct }}%)</span><span class="font-bold text-navy">${{ taxes }}</span></div>
                <div v-if="form.regime !== 'room_only'" class="flex justify-between text-sm"><span class="text-text-secondary">Régimen</span><span class="font-bold text-teal">{{ regimeLabel }}</span></div>
              </div>
            </div>

            <!-- ═══ PASO 5: PAGO ═══ -->
            <div v-if="wizardStep === 5" class="space-y-4">
              <div>
                  <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Método de pago</label>
                  <select v-model="form.payMethod" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition">
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                    <option value="cash">Efectivo</option>
                    <option value="link">Link de pago</option>
                  </select>
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
                  <div>
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Titular de la tarjeta</label>
                      <input v-model="form.cardHolder" type="text" maxlength="80" placeholder="Nombre como aparece en la tarjeta" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple transition" />
                    </div>
                  <div>
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
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">N° tarjeta</label>
                      <input v-model="form.cardNumber" type="text" maxlength="19" placeholder="XXXX XXXX XXXX XXXX" @input="formatCardNumber" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm font-mono bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition" />
                    </div>
                  <div>
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">CVV</label>
                      <input v-model="form.cardCvv" type="text" maxlength="4" placeholder="XXX" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm font-mono bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition" />
                    </div>
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Caducidad</label>
                    <input v-model="form.cardExpiry" @input="formatExpiry" type="text" inputmode="numeric" maxlength="7" placeholder="MM/AAAA" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm font-mono bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple transition" />
                  </div>
              </div>

              <!-- Anticipo -->
              <div class="pt-3 border-t border-border">
                <div class="flex items-center gap-2 mb-3">
                  <span class="w-4 h-4 text-teal" v-html="ICON_PERCENT"></span>
                  <h4 class="text-[11px] font-black text-teal uppercase tracking-wide">Anticipo y total</h4>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">% de anticipo</label>
                      <input v-model.number="form.depositPercentage" type="number" min="0" max="100" @input="calcDepositFromPercentage" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition" />
                    </div>
                  <div>
                      <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-1">Estado</label>
                      <select v-model="form.depositStatus" class="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm bg-surface/60 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition">
                        <option value="unpaid">Sin pagar</option>
                        <option value="partial">Parcial</option>
                        <option value="paid">Pagado</option>
                      </select>
                    </div>
                </div>
                <div v-if="selRoom && form.checkIn && form.checkOut" class="bg-surface rounded-2xl border border-border p-4 space-y-1.5 text-sm">
                  <div class="flex justify-between"><span class="text-text-secondary">{{ nights }} noches × ${{ selRoom.basePrice }}</span><span class="font-bold text-navy">${{ subtotal }}</span></div>
                  <div class="flex justify-between"><span class="text-text-secondary">Impuestos ({{ taxRatePct }}%)</span><span class="font-bold text-navy">${{ taxes }}</span></div>
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
              <div v-if="isEdit" class="pt-3 border-t border-border">
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
            <div class="text-sm font-extrabold text-navy">Total: <span class="text-lg">${{ total }}</span></div>
            <div class="flex items-center gap-3 sm:gap-4 flex-wrap">
              <button @click="emit('close')" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer hover:bg-surface transition">Cancelar</button>
              <button v-if="wizardStep > 1" @click="wizardStep--" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer hover:bg-surface transition">Atrás</button>
              <button v-if="wizardStep < WIZARD_STEPS.length" @click="goNextStep" class="px-6 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-navy-light transition">Siguiente</button>
              <button v-else @click="save" :disabled="saving || !isOnline"
                :title="!isOnline ? 'Sin conexión: no se puede guardar la reserva' : ''"
                class="px-6 py-2.5 bg-teal text-white rounded-xl text-sm font-black cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition">
                {{ saving ? 'Guardando...' : (isEdit ? 'Actualizar Reserva' : 'Crear Reserva') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// components/features/ReservationWizardModal.vue — Wizard de 5 pasos para crear/editar una
// reserva (Huésped → Detalles → Emergencia → Alojamiento → Pago). Compartido entre
// pages/reservations/index.vue y ReservationCalendar.vue: antes cada uno tenía su propio
// formulario (el del Calendario era una sola pantalla, más pobre — sin reutilización de
// huésped existente ni sync de acompañantes). `editId`/`prefill` deciden si abre vacío,
// precargado con datos de una reserva existente, o con habitación/fechas ya elegidas
// (celda clickeada del Calendario).
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { useOnline } from '@/composables/useOnline'
import { ReservationService } from '@/services/Reservation.service'
import { BillingService } from '@/services/Billing.service'
import { CompanionsService } from '@/services/Companions.service'
import { PaymentsService } from '@/services/Payments.service'
import { TTLockService } from '@/services/TTLock.service'
import SearchSelect from '@/components/ui/SearchSelect.vue'
import PhoneInput from '@/components/ui/PhoneInput.vue'
import { COUNTRIES, NATIONALITIES, LANGUAGES, DOC_TYPES } from '@/data/locales'
import type { Guest } from '@/types'

const props = defineProps<{
  editId?: string | null
  prefill?: { roomId?: string; checkIn?: string; checkOut?: string } | null
  rooms: any[]
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const { isOnline } = useOnline()
const auth = useAuthStore()
const toast = useToast()
const hid = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const isEdit = computed(() => !!props.editId)

const MS_PER_DAY = 86_400_000

// ── Wizard ──
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
const ICON_GLOBE = `${SVG_OPEN}<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`
const ICON_ALERT = `${SVG_OPEN}<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`
const ICON_USERS = `${SVG_OPEN}<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
const ICON_PERCENT = `${SVG_OPEN}<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`
const ICON_LOCK = `${SVG_OPEN}<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
const ICON_KEY = `${SVG_OPEN}<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4a5 5 0 1 0-7 7l1 1"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>`

const saving = ref(false)
const err = ref('')
const lockCode = ref('')
const existingGuarantee = ref(false)

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

const selRoom = computed(() => props.rooms.find((r: any) => r.id === form.value.roomId))
// Opciones del selector de habitación (buscador dinámico): value=id, label='número — tipo ($precio/n)'.
const roomOptions = computed(() => props.rooms.map((r: any) => ({ value: String(r.id), label: `${r.number} — ${r.type} ($${r.basePrice}/n)` })))
const nights = computed(() => {
  if (!form.value.checkIn || !form.value.checkOut) return 0
  return Math.max(1, Math.round((new Date(form.value.checkOut).getTime() - new Date(form.value.checkIn).getTime()) / MS_PER_DAY))
})
// Tasa real del hotel (GET /api/facturas/tax-rate — misma fuente que usa la factura final).
const taxRatePct = ref(0)
const subtotal = computed(() => selRoom.value ? selRoom.value.basePrice * nights.value : 0)
const taxes = computed(() => Math.round(subtotal.value * (taxRatePct.value / 100)))
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

function stLabel(s: string) { const m: any = { pending: 'Pendiente', confirmed: 'Confirmada', checked_in: 'Check-in', checked_out: 'Check-out', cancelled: 'Cancelada' }; return m[s] || s }
function stBtnActive(s: string) { const m: any = { pending: 'border-gold bg-gold text-white', confirmed: 'border-blue-500 bg-blue-500 text-white', checked_in: 'border-teal bg-teal text-white', cancelled: 'border-coral bg-coral text-white' }; return m[s] || '' }

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
      if (props.editId) {
        // Editar: ya tiene guestId
        const existing = await ReservationService.getById(props.editId)
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

    let reservationId = props.editId
    if (props.editId) {
      await ReservationService.update(props.editId, reservationPayload)
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

    toast.success(props.editId ? 'Reserva actualizada' : 'Reserva creada')
    emit('saved')
  } catch (e: any) {
    err.value = e.message || 'Error al guardar'
  }
  saving.value = false
}

// ── Acciones ──
async function generateLockCode() {
  if (!props.editId) { toast.error('Guarda la reserva primero'); return }
  try {
    const code = await TTLockService.generateCode(props.editId)
    lockCode.value = code.code || ''
    toast.success(`Código generado: ${lockCode.value}`)
  } catch (e: any) { toast.error(e.message || 'Sin cerradura asignada') }
}

async function createPaymentRequest() {
  if (!props.editId) { toast.error('Guarda la reserva primero'); return }
  if (pend.value <= 0) { toast.info('Sin monto pendiente'); return }
  try {
    await PaymentsService.create({ reservationId: props.editId, amount: pend.value, sentTo: form.value.email, sentVia: 'email' })
    toast.success('Requerimiento de pago creado')
  } catch (e: any) { toast.error(e.message || 'Error') }
}

function sendPayLink(ch: string) {
  const g = form.value.name
  const a = pend.value; const e = form.value.email; const p = form.value.phone
  if (ch === 'email' && e) { window.open(`mailto:${e}?subject=${encodeURIComponent('Pago pendiente - ' + g)}&body=${encodeURIComponent('Hola ' + g + ', tu reserva tiene $' + a + ' pendientes.')}`); toast.success('Email abierto') }
  else if (ch === 'whatsapp' && p) { window.open(`https://wa.me/${p.replace(/\D/g, '')}?text=${encodeURIComponent('Hola ' + g + ', pago pendiente: $' + a)}`); toast.success('WhatsApp abierto') }
  else { toast.error('Falta email/teléfono') }
}

// ── Carga inicial: reserva existente (editId) o prellenado desde el Calendario (prefill) ──
async function loadForEdit(id: string) {
  try {
    const ext = await ReservationService.getById(id)
    const f = form.value
    f.checkIn = ext.checkIn
    f.checkOut = ext.checkOut
    f.roomId = ext.roomId || ''
    f.adults = ext.adults || 2
    f.children = ext.children || 0
    f.status = ext.status
    f.source = ext.source || 'direct'
    f.notes = ext.notes || ''
    f.payMethod = ext.paymentMethod || 'transfer'
    existingGuarantee.value = !!ext.hasGuaranteeCard
    f.deposit = ext.deposit || 0
    f.depositPercentage = ext.depositPercentage ?? 100
    f.depositStatus = ext.depositStatus || 'unpaid'
    f.commission = ext.commission || 0
    f.extLocator = ext.externalLocator || ''
    f.otaNotes = ext.otaNotes || ''
    f.autoSendEnabled = ext.autoSendEnabled ?? true
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
    if (ext.emergencyContact) {
      f.emergencyName = ext.emergencyContact.name || ''
      f.emergencyPhone = ext.emergencyContact.phone || ''
      f.emergencyRelation = ext.emergencyContact.relation || ''
      f.emergencyEmail = ext.emergencyContact.email || ''
    }
    form.value.companions = (ext.companions || []).map((c: any) => ({
      id: c.id, name: c.name || '', documentNumber: c.documentNumber || '',
      documentType: c.documentType, nationality: c.nationality,
    }))
    if (ext.lockCodes?.length) lockCode.value = ext.lockCodes[0].code || ''
  } catch (e) {
    console.warn('[ReservationWizardModal/loadForEdit]', e)
    toast.info('Algunos datos de la reserva no se pudieron cargar')
  }
}

watch(() => props.editId, async (id) => {
  err.value = ''
  lockCode.value = ''
  resetForm()
  step1Attempted.value = false
  step4Attempted.value = false
  wizardStep.value = 1
  if (id) {
    await loadForEdit(id)
  } else if (props.prefill) {
    if (props.prefill.roomId) form.value.roomId = props.prefill.roomId
    if (props.prefill.checkIn) form.value.checkIn = props.prefill.checkIn
    if (props.prefill.checkOut) form.value.checkOut = props.prefill.checkOut
  }
}, { immediate: true })

// Silencioso a propósito: sin tasa configurada, taxRatePct queda en 0 y el wizard
// simplemente no desglosa impuesto — mejor eso que romper la apertura del modal.
BillingService.taxRate().then((r) => { taxRatePct.value = r }).catch(() => {})
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-active .modal-panel, .modal-fade-leave-active .modal-panel { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-panel, .modal-fade-leave-to .modal-panel { opacity: 0; transform: translateY(8px) scale(0.98); }
</style>
