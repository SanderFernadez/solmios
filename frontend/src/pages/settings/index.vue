<template>
  <div>
    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <div class="h-6 w-48 bg-surface rounded-lg animate-pulse"></div>
          <div class="h-4 w-72 bg-surface rounded mt-2 animate-pulse"></div>
        </div>
        <div class="h-10 w-32 bg-surface rounded-xl animate-pulse"></div>
      </div>
      <div class="grid lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="card p-6">
            <div class="h-5 w-40 bg-surface rounded mb-4 animate-pulse"></div>
            <div class="grid grid-cols-2 gap-4">
              <div v-for="i in 6" :key="i">
                <div class="h-3 w-20 bg-surface rounded mb-2 animate-pulse"></div>
                <div class="h-10 w-full bg-surface rounded-xl animate-pulse"></div>
              </div>
            </div>
          </div>
          <div class="card p-6">
            <div class="h-5 w-28 bg-surface rounded mb-4 animate-pulse"></div>
            <div class="grid grid-cols-2 gap-4">
              <div v-for="i in 4" :key="i">
                <div class="h-3 w-20 bg-surface rounded mb-2 animate-pulse"></div>
                <div class="h-10 w-full bg-surface rounded-xl animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="space-y-6">
          <div class="card p-6">
            <div class="h-5 w-16 bg-surface rounded mb-4 animate-pulse"></div>
            <div class="h-24 w-full bg-surface rounded-xl animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Page content -->
    <div v-else>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Configuración</h2>
        <p class="text-sm text-text-muted mt-0.5">Datos del hotel, amenities, tarifas e integraciones</p>
      </div>
      <button @click="saveAll" :disabled="saving" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer disabled:opacity-50">
        {{ saving ? 'Guardando...' : '💾 Guardar' }}
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6 overflow-x-auto">
      <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
        class="px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
        :class="activeTab === tab.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        {{ tab.icon }} {{ tab.label }}
      </button>
    </div>

    <!-- ========== HOTEL ========== -->
    <div v-if="activeTab === 'hotel'" class="grid lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div class="card p-6">
          <h3 class="font-extrabold text-navy mb-4">Datos del Hotel</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Nombre *</label>
              <input v-model="form.name" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Tipo de Alojamiento</label>
              <select v-model="form.accommodationType" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="">Seleccionar</option>
                <option value="hotel">Hotel</option>
                <option value="boutique">Hotel Boutique</option>
                <option value="aparthotel">Apartahotel</option>
                <option value="hostal">Hostal</option>
                <option value="casa_rural">Casa Rural</option>
                <option value="villa">Villa</option>
                <option value="camping">Camping</option>
                <option value="hostel">Hostel</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">País *</label>
              <select v-model="form.country" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="DO">República Dominicana</option>
                <option value="CO">Colombia</option>
                <option value="MX">México</option>
                <option value="PE">Perú</option>
                <option value="CL">Chile</option>
                <option value="AR">Argentina</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Clasificación</label>
              <select v-model="form.starRating" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="">N/A</option>
                <option value="1">⭐ 1 Estrella</option>
                <option value="2">⭐⭐ 2 Estrellas</option>
                <option value="3">⭐⭐⭐ 3 Estrellas</option>
                <option value="4">⭐⭐⭐⭐ 4 Estrellas</option>
                <option value="5">⭐⭐⭐⭐⭐ 5 Estrellas</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Dirección</label>
              <input v-model="form.address" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Provincia</label>
              <input v-model="form.province" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Municipio</label>
              <input v-model="form.municipality" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
          </div>
        </div>

        <div class="card p-6">
          <h3 class="font-extrabold text-navy mb-4">Contacto</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Teléfono Principal</label>
              <input v-model="form.phone" type="tel" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Teléfono 2</label>
              <input v-model="form.phone2" type="tel" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Email</label>
              <input v-model="form.email" type="email" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Sitio Web</label>
              <input v-model="form.website" type="url" placeholder="https://" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
          </div>
        </div>

        <div class="card p-6">
          <h3 class="font-extrabold text-navy mb-4">Propietario</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Nombre del Propietario</label>
              <input v-model="form.ownerName" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">CIF/NIF/RNC</label>
              <input v-model="form.ownerTaxId" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
          </div>
        </div>

        <div class="card p-6">
          <h3 class="font-extrabold text-navy mb-4">Check-In / Check-Out</h3>
          <div class="grid grid-cols-4 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Check-In</label>
              <input v-model="form.checkIn" type="time" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Check-Out</label>
              <input v-model="form.checkOut" type="time" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Zona Horaria</label>
              <select v-model="form.timezone" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="America/Santo_Domingo">Santo Domingo (GMT-4)</option>
                <option value="America/Bogota">Bogotá (GMT-5)</option>
                <option value="America/Mexico_City">CDMX (GMT-6)</option>
                <option value="America/Lima">Lima (GMT-5)</option>
                <option value="America/Santiago">Santiago (GMT-4)</option>
                <option value="America/Argentina/Buenos_Aires">Buenos Aires (GMT-3)</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Moneda</label>
              <select v-model="form.currency" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="USD">USD</option><option value="DOP">DOP</option><option value="COP">COP</option>
                <option value="MXN">MXN</option><option value="PEN">PEN</option><option value="CLP">CLP</option><option value="ARS">ARS</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="card p-6">
          <h3 class="font-extrabold text-navy mb-4">Plan</h3>
          <div class="bg-purple/10 rounded-xl p-4 text-center">
            <div class="text-[10px] font-bold text-teal uppercase mb-1">Activo</div>
            <div class="text-lg font-black text-purple">{{ form.plan || 'Professional' }}</div>
            <div class="text-2xl font-black text-navy mt-1">{{ planPrice }}<span class="text-sm text-text-muted">/mes</span></div>
          </div>
        </div>
        <div class="card p-6 text-center">
          <div class="text-3xl mb-2">🏨</div>
          <div class="text-sm font-bold text-navy">{{ form.name || 'Hotel' }}</div>
          <div class="text-[10px] text-text-muted mt-1">{{ form.country || '' }}</div>
        </div>
      </div>
    </div>

    <!-- ========== LOCATION (Leaflet map) ========== -->
    <div v-if="activeTab === 'location'" class="grid lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 card p-6">
        <h3 class="font-extrabold text-navy mb-4">Mapa Interactivo</h3>
        <div ref="mapEl" class="w-full h-96 rounded-xl border border-border overflow-hidden"></div>
        <p class="text-[11px] text-text-muted mt-2">Click en el mapa para ajustar la ubicación exacta.</p>
      </div>
      <div class="space-y-4">
        <div class="card p-6">
          <h3 class="font-extrabold text-navy mb-4">Coordenadas</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Latitud</label>
              <input v-model.number="form.latitude" type="number" step="0.000001" @change="syncMarkerFromForm"
                class="w-full px-3 py-2 rounded-lg border border-border text-sm font-bold text-navy" />
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Longitud</label>
              <input v-model.number="form.longitude" type="number" step="0.000001" @change="syncMarkerFromForm"
                class="w-full px-3 py-2 rounded-lg border border-border text-sm font-bold text-navy" />
            </div>
          </div>
          <button @click="useMyLocation" class="mt-3 w-full text-xs font-bold text-teal hover:underline cursor-pointer">
            📍 Usar mi ubicación actual
          </button>
        </div>
        <div class="card p-6">
          <h3 class="font-extrabold text-navy mb-4">Dirección Postal</h3>
          <div class="space-y-3">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Localidad</label>
              <input v-model="form.locality" class="w-full px-3 py-2 rounded-lg border border-border text-sm" />
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Código Postal</label>
              <input v-model="form.postalCode" class="w-full px-3 py-2 rounded-lg border border-border text-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== AMENITIES ========== -->
    <div v-if="activeTab === 'amenities'" class="space-y-6">
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="(items, category) in amenityCatalog" :key="category" class="card p-6">
          <h3 class="font-extrabold text-navy mb-4 capitalize">{{ categoryLabels[category] || category }}</h3>
          <div class="space-y-2 max-h-96 overflow-y-auto">
            <label v-for="key in items" :key="key" class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface cursor-pointer transition-colors">
              <input type="checkbox" :value="key" v-model="selectedAmenities"
                class="w-4 h-4 rounded border-gray-300 text-cyan focus:ring-cyan cursor-pointer" />
              <span class="text-sm text-navy font-medium">{{ amenityLabels[key] || key }}</span>
            </label>
          </div>
        </div>
      </div>
      <!-- Custom amenity -->
      <div class="card p-6">
        <h3 class="font-extrabold text-navy mb-4">Agregar Amenity Personalizada</h3>
        <div class="flex gap-3">
          <select v-model="newAmenityCategory" class="px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer">
            <option value="interior">Interior</option>
            <option value="exterior">Exterior</option>
            <option value="services">Servicios</option>
          </select>
          <input v-model="newAmenityName" type="text" placeholder="Nombre de la amenity..." class="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm" @keyup.enter="addCustomAmenity" />
          <button @click="addCustomAmenity" class="px-5 py-2.5 bg-cyan text-navy rounded-xl text-sm font-bold cursor-pointer hover:shadow-lg">Agregar</button>
        </div>
        <div v-if="customAmenities.length > 0" class="mt-3 flex flex-wrap gap-2">
          <span v-for="a in customAmenities" :key="a.key" class="px-3 py-1.5 bg-navy/5 text-navy rounded-full text-xs font-bold flex items-center gap-1">
            {{ a.label }}
            <button @click="removeCustomAmenity(a.key)" class="text-coral hover:text-red-700 cursor-pointer ml-1">✕</button>
          </span>
        </div>
      </div>
    </div>

    <!-- ========== TARIFAS ========== -->
    <div v-if="activeTab === 'rates'" class="space-y-6">
      <div class="card p-6">
        <h3 class="font-extrabold text-navy mb-4">Temporadas</h3>
        <div class="grid md:grid-cols-4 gap-4">
          <div v-for="(s, i) in seasonsList" :key="i" class="bg-surface rounded-xl p-4">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-4 h-4 rounded-full" :style="{ backgroundColor: s.color || '#3b82f6' }"></div>
              <span class="text-sm font-bold text-navy">{{ s.label || s.name }}</span>
            </div>
            <div class="space-y-2">
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase">Inicio</label>
                <input v-model="s.startDate" type="date" class="w-full mt-1 px-3 py-2 rounded-lg border border-border text-xs focus:outline-none focus:border-navy" />
              </div>
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase">Fin</label>
                <input v-model="s.endDate" type="date" class="w-full mt-1 px-3 py-2 rounded-lg border border-border text-xs focus:outline-none focus:border-navy" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tarifas estilo MisterPlan: precio base + % por temporada -->
      <div class="card p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="font-extrabold text-navy">Matriz de Tarifas</h3>
          <div class="flex gap-2">
            <button @click="copyRatesNextYear" :disabled="copying"
              class="px-4 py-2 bg-navy/5 hover:bg-navy/10 text-navy rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50">
              {{ copying ? 'Copiando...' : '📅 Copiar al próximo año' }}
            </button>
            <button @click="saveRates" :disabled="savingRates"
              class="px-4 py-2 bg-cyan text-navy rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50">
              {{ savingRates ? 'Guardando...' : '💾 Guardar' }}
            </button>
          </div>
        </div>

        <div v-for="roomType in roomTypes" :key="roomType" class="mb-8 last:mb-0">
          <!-- Header de tipo de habitación -->
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-cyan flex items-center justify-center text-white text-sm font-bold">
              {{ roomType.charAt(0).toUpperCase() }}
            </div>
            <div>
              <div class="text-sm font-extrabold text-navy capitalize">{{ roomType }}</div>
              <div class="text-[10px] text-text-muted">Base: ${{ getBasePrice(roomType) }}/noche</div>
            </div>
          </div>

          <!-- Precio base editable -->
          <div class="mb-3 flex items-center gap-2">
            <label class="text-[10px] font-bold text-text-muted uppercase">Precio Base $</label>
            <input :value="getBasePrice(roomType)" @input="setBasePrice(roomType, $event)" type="number" min="0"
              class="w-24 px-3 py-1.5 rounded-lg border border-border text-sm font-bold text-navy focus:outline-none focus:border-cyan" />
          </div>

          <!-- Grid de temporadas -->
          <div class="grid gap-2" :style="{ gridTemplateColumns: `repeat(${seasonsList.length}, 1fr)` }">
            <div v-for="s in seasonsList" :key="s.name" class="rounded-xl p-3 border-2 transition-all"
              :class="isCellClosed(roomType, s.name) ? 'border-red-300 bg-red-50 opacity-70' : 'border-border bg-white'"
              :style="!isCellClosed(roomType, s.name) ? { borderColor: s.color + '40', backgroundColor: s.color + '08' } : {}">
              <!-- Temporada label -->
              <div class="flex items-center gap-1.5 mb-2">
                <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: s.color }"></div>
                <span class="text-[10px] font-bold uppercase" :style="{ color: s.color }">{{ s.label || s.name }}</span>
              </div>
              <!-- % de incremento -->
              <div class="flex items-center gap-1 mb-1">
                <span class="text-lg font-black text-navy">+</span>
                <input :value="getPercentage(roomType, s.name)" @input="setPercentage(roomType, s.name, $event)"
                  type="number" min="0" max="500" step="0.5"
                  class="w-14 px-2 py-1 rounded-lg border border-border text-sm font-bold text-navy text-right focus:outline-none focus:border-cyan" />
                <span class="text-sm font-bold text-text-muted">%</span>
              </div>
              <!-- Precio calculado -->
              <div class="text-xs font-extrabold text-navy mb-2">
                = ${{ getCalculatedPrice(roomType, s.name) }}
              </div>
              <!-- Botón cerrar ventas -->
              <button @click="toggleClosed(roomType, s.name)"
                class="w-full py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                :class="isCellClosed(roomType, s.name)
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'bg-surface text-text-muted hover:bg-surface-dark'">
                {{ isCellClosed(roomType, s.name) ? '🔒 Cerrado' : '✓ Abierto' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== CONDICIONES ========== -->
    <div v-if="activeTab === 'conditions'" class="grid lg:grid-cols-2 gap-6">
      <div class="card p-6">
        <h3 class="font-extrabold text-navy mb-4">Políticas de Reserva</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between p-3 bg-surface rounded-xl">
            <div>
              <div class="text-sm font-bold text-navy">Cancelación gratuita</div>
              <div class="text-[10px] text-text-muted">Hasta 24h antes del check-in</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="form.freeCancellation" type="checkbox" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal"></div>
            </label>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Política de Cancelación</label>
            <div class="grid grid-cols-2 gap-2">
              <label v-for="policy in cancelPolicies" :key="policy.value"
                class="flex items-start gap-2 p-3 rounded-xl cursor-pointer transition-colors"
                :class="form.cancellationType === policy.value ? 'bg-navy/5 border border-navy/20' : 'bg-surface border border-transparent'">
                <input v-model="form.cancellationType" type="radio" :value="policy.value" class="mt-0.5 w-4 h-4 text-cyan" />
                <div>
                  <div class="text-xs font-bold text-navy">{{ policy.name }}</div>
                </div>
              </label>
            </div>
          </div>

          <div class="flex items-center justify-between p-3 bg-surface rounded-xl">
            <div><div class="text-sm font-bold text-navy">Depósito requerido</div></div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="form.depositRequired" type="checkbox" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal"></div>
            </label>
          </div>
          <div v-if="form.depositRequired" class="flex items-center gap-3 bg-surface rounded-xl p-3">
            <span class="text-sm text-text-secondary">% Depósito</span>
            <input v-model.number="form.depositPercent" type="number" min="1" max="100" class="w-20 px-3 py-2 rounded-lg border border-border text-sm font-bold text-navy text-right" />
            <span class="text-sm text-text-muted">%</span>
          </div>
        </div>
      </div>

      <div class="card p-6">
        <h3 class="font-extrabold text-navy mb-4">Impuestos</h3>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Nombre</label>
              <input v-model="form.taxName" placeholder="ITBIS" class="w-full px-3 py-2 rounded-lg border border-border text-sm" />
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Tasa (%)</label>
              <input v-model.number="form.taxRate" type="number" min="0" max="100" class="w-full px-3 py-2 rounded-lg border border-border text-sm font-bold text-navy text-right" />
            </div>
          </div>
        </div>
      </div>

      <div class="card p-6">
        <h3 class="font-extrabold text-navy mb-4">Depósito y Fianza</h3>
        <div class="space-y-4">
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Tipo de Fianza</label>
            <select v-model="form.depositType" class="w-full px-3 py-2 rounded-lg border border-border text-sm cursor-pointer">
              <option value="ninguna">Ninguna</option>
              <option value="fija">Fija</option>
              <option value="porcentaje">Porcentaje</option>
            </select>
          </div>
          <div v-if="form.depositType === 'fija' || form.depositType === 'porcentaje'">
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Valor</label>
            <div class="flex items-center gap-2">
              <span class="text-sm text-text-muted">{{ form.depositType === 'fija' ? '$' : '' }}</span>
              <input v-model.number="form.depositFixed" type="number" min="0" class="w-24 px-3 py-2 rounded-lg border border-border text-sm font-bold text-navy text-right" />
              <span v-if="form.depositType === 'porcentaje'" class="text-sm text-text-muted">%</span>
            </div>
          </div>
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Forma de Pago por Defecto</label>
            <select v-model="form.defaultPaymentMethod" class="w-full px-3 py-2 rounded-lg border border-border text-sm cursor-pointer">
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
              <option value="cash">Efectivo</option>
              <option value="paypal">PayPal</option>
              <option value="link">Link de Pago</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card p-6">
        <h3 class="font-extrabold text-navy mb-4">Valoraciones</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 bg-surface rounded-xl">
            <div class="text-sm font-bold text-navy">Solicitar reseñas</div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="form.requestReviews" type="checkbox" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal"></div>
            </label>
          </div>
          <div class="flex items-center justify-between p-3 bg-surface rounded-xl">
            <div class="text-sm font-bold text-navy">Publicar puntuación</div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input v-model="form.publishReviewScore" type="checkbox" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal"></div>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== DESCRIPTION (multilingüe) ========== -->
    <div v-if="activeTab === 'description'" class="space-y-6">
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-extrabold text-navy">Descripción Multilingüe</h3>
          <div class="flex gap-2">
            <select v-model="activeLang" class="px-3 py-1.5 rounded-lg border border-border text-sm font-bold text-navy cursor-pointer">
              <option v-for="lang in supportedLangs" :key="lang.code" :value="lang.code">{{ lang.flag }} {{ lang.name }}</option>
            </select>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 mb-4">
          <button v-for="lang in supportedLangs" :key="lang.code" @click="activeLang = lang.code"
            class="px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer"
            :class="activeLang === lang.code ? 'bg-navy text-white' : 'bg-surface text-text-secondary hover:bg-navy/5'">
            {{ lang.flag }} {{ lang.code.toUpperCase() }}
            <span v-if="descriptions[lang.code]" class="ml-1 text-teal">●</span>
          </button>
        </div>
        <textarea v-model="descriptions[activeLang]" :placeholder="`Descripción del hotel en ${currentLangName}...`"
          rows="10" class="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-y"></textarea>
        <div class="flex items-center justify-between mt-2">
          <span class="text-[10px] text-text-muted">{{ (descriptions[activeLang] || '').length }} / 2000 caracteres</span>
          <span class="text-[10px] text-text-muted">{{ completedLangsCount }} / {{ supportedLangs.length }} idiomas completados</span>
        </div>
      </div>
      <div class="card p-6">
        <h3 class="font-extrabold text-navy mb-4">WiFi (compartido en pre-checkin)</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Red</label>
            <input v-model="form.wifiNetwork" class="w-full px-3 py-2 rounded-lg border border-border text-sm" />
          </div>
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Contraseña</label>
            <input v-model="form.wifiPassword" type="password" class="w-full px-3 py-2 rounded-lg border border-border text-sm" />
          </div>
        </div>
      </div>
    </div>

    <!-- ========== INTEGRACIONES ========== -->
    <div v-if="activeTab === 'integrations'" class="grid md:grid-cols-2 gap-6">
      <div class="card p-6">
        <h3 class="font-extrabold text-navy mb-4">Channel Manager</h3>
        <div class="p-4 bg-surface rounded-xl">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <span class="text-xl">🌐</span>
              <div><div class="text-sm font-bold text-navy">Channex</div><div class="text-[10px] text-text-muted">Sincronización con OTAs</div></div>
            </div>
            <span class="text-[10px] font-bold px-2 py-1 rounded-full bg-teal/10 text-teal">Conectado</span>
          </div>
          <router-link to="/panel/channel-manager" class="block w-full text-center px-4 py-2 bg-navy/10 text-navy rounded-xl text-sm font-bold hover:bg-navy/20 transition-colors cursor-pointer">Gestionar Canales</router-link>
        </div>
      </div>

      <div class="card p-6">
        <h3 class="font-extrabold text-navy mb-4">Pasarela de Pagos</h3>
        <div class="p-4 bg-surface rounded-xl">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <span class="text-xl">💳</span>
              <div><div class="text-sm font-bold text-navy">Stripe</div><div class="text-[10px] text-text-muted">Pagos con tarjeta</div></div>
            </div>
            <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="stripeConnected ? 'bg-teal/10 text-teal' : 'bg-yellow-100 text-yellow-700'">{{ stripeConnected ? 'Conectado' : 'No configurado' }}</span>
          </div>
          <div class="space-y-3">
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Secret Key</label>
              <input v-model="stripeConfig.secretKey" type="password" class="w-full px-3 py-2 rounded-lg border border-border text-xs" placeholder="sk_live_... o sk_test_..." autocomplete="off" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Publishable Key</label>
                <input v-model="stripeConfig.publishableKey" type="password" class="w-full px-3 py-2 rounded-lg border border-border text-xs" placeholder="pk_live_... o pk_test_..." autocomplete="off" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Moneda</label>
                <select v-model="stripeConfig.currency" class="w-full px-3 py-2 rounded-lg border border-border text-xs cursor-pointer">
                  <option value="usd">USD</option><option value="eur">EUR</option><option value="mxn">MXN</option><option value="ars">ARS</option><option value="cop">COP</option><option value="clp">CLP</option><option value="uyu">UYU</option><option value="dop">DOP</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Webhook Secret</label>
              <input v-model="stripeConfig.webhookSecret" type="password" class="w-full px-3 py-2 rounded-lg border border-border text-xs" placeholder="whsec_..." autocomplete="off" />
            </div>
            <p class="text-[10px] text-text-muted">Las keys se guardan por hotel. Sin configurar, los botones de pago Stripe quedan ocultos. Obtené tus keys en dashboard.stripe.com → Developers → API keys.</p>
            <button @click="saveStripe" :disabled="stripeSaving" class="w-full px-4 py-2 bg-navy text-white rounded-xl text-sm font-bold hover:shadow-lg cursor-pointer disabled:opacity-50">{{ stripeSaving ? 'Guardando...' : 'Guardar configuración Stripe' }}</button>
          </div>
        </div>
      </div>

      <div class="card p-6">
        <h3 class="font-extrabold text-navy mb-4">WhatsApp Business</h3>
        <div class="p-4 bg-surface rounded-xl">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <span class="text-xl">💬</span>
              <div><div class="text-sm font-bold text-navy">WhatsApp</div><div class="text-[10px] text-text-muted">Mensajes automatizados</div></div>
            </div>
            <span class="text-[10px] font-bold px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">No configurado</span>
          </div>
          <p class="text-xs text-text-muted">Requiere cuenta de Meta Business.</p>
        </div>
      </div>

      <div class="card p-6">
        <h3 class="font-extrabold text-navy mb-4">Facturación Electrónica</h3>
        <div class="p-4 bg-surface rounded-xl">
          <div class="flex items-center gap-3 mb-3">
            <span class="text-xl">🧾</span>
            <div><div class="text-sm font-bold text-navy">DGII - Rep. Dominicana</div><div class="text-[10px] text-text-muted">NCF automático</div></div>
          </div>
          <p class="text-xs text-text-muted">Disponible según el país de operación del hotel.</p>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, reactive } from 'vue'
import { HotelService } from '@/services/Hotel.service'
import { SettingsService, type HotelFull } from '@/services/Settings.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import type { AmenityCatalog } from '@/services/Hotel.service'

// Leaflet (mapa interactivo — lazy import para no romper SSR)
import leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'

// Fix default icon paths para Leaflet con bundlers
delete (leaflet.Icon.Default.prototype as any)._getIconUrl
leaflet.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

// Stripe — config por hotel (configuration['stripe_config'])
const stripeConfig = reactive({ secretKey: '', publishableKey: '', webhookSecret: '', currency: 'usd' })
const stripeConnected = ref(false)
const stripeSaving = ref(false)
async function loadStripe() {
  try {
    const { ConfigService } = await import('@/services/Platform.service')
    const saved = await ConfigService.get('stripe_config', hotelId.value)
    if (saved) {
      stripeConfig.secretKey = saved.secretKey || ''
      stripeConfig.publishableKey = saved.publishableKey || ''
      stripeConfig.webhookSecret = saved.webhookSecret || ''
      stripeConfig.currency = saved.currency || 'usd'
    }
    stripeConnected.value = !!stripeConfig.secretKey
  } catch { /* sin config aún */ }
}
async function saveStripe() {
  stripeSaving.value = true
  try {
    const { ConfigService } = await import('@/services/Platform.service')
    await ConfigService.set('stripe_config', { ...stripeConfig }, hotelId.value)
    stripeConnected.value = !!stripeConfig.secretKey
    toast.success('Configuración de Stripe guardada')
  } catch { toast.error('No se pudo guardar la configuración de Stripe') }
  stripeSaving.value = false
}
onMounted(loadStripe)

const activeTab = ref('hotel')
const saving = ref(false)
const loading = ref(true)

const tabs = [
  { value: 'hotel', label: 'Hotel', icon: '🏨' },
  { value: 'location', label: 'Ubicación', icon: '📍' },
  { value: 'amenities', label: 'Amenities', icon: '✨' },
  { value: 'rates', label: 'Tarifas', icon: '💰' },
  { value: 'conditions', label: 'Condiciones', icon: '📋' },
  { value: 'description', label: 'Descripción', icon: '📝' },
  { value: 'integrations', label: 'Integraciones', icon: '🔗' },
]

type HotelForm = Partial<HotelFull> & { cancellationType?: string; freeCancellation?: boolean }

const form = ref<HotelForm>({
  name: '', country: '', address: '', phone: '', email: '',
  timezone: 'America/Santo_Domingo', currency: 'USD',
  checkIn: '15:00', checkOut: '12:00', plan: 'Professional',
  freeCancellation: true, depositRequired: true, depositPercent: 30,
  weekendSurcharge: 0, accommodationType: '', starRating: '',
  ownerName: '', ownerTaxId: '', phone2: '', website: '',
  province: '', municipality: '', locality: '', postalCode: '',
  latitude: undefined as number | undefined, longitude: undefined as number | undefined,
  cancellationType: 'flexible', cleaningType: 'salida',
  depositType: 'ninguna', depositFixed: 0,
  advanceType: 'porcentaje', advanceAmount: 0, releaseHours: 0,
  defaultPaymentMethod: 'transfer',
  requestReviews: false, publishReviewScore: false,
  taxName: 'ITBIS', taxRate: 18,
  wifiNetwork: '', wifiPassword: '',
  descriptionJson: '',
  id: '',
})

const planPrice = computed(() => {
  const p = form.value.plan
  return p === 'enterprise' ? '$199' : p === 'professional' ? '$99' : '$49'
})

const cancelPolicies = [
  { value: 'flexible', name: 'Flexible' },
  { value: 'moderate', name: 'Moderada' },
  { value: 'strict', name: 'Estricta' },
  { value: 'non_refundable', name: 'No Reembolsable' },
]

// Amenities
const amenityCatalog = ref<AmenityCatalog>({ interior: [], exterior: [], services: [] })
const selectedAmenities = ref<string[]>([])
const newAmenityName = ref('')
const newAmenityCategory = ref('interior')
const customAmenities = ref<{ key: string; label: string; category: string }[]>([])

function addCustomAmenity() {
  const name = newAmenityName.value.trim()
  if (!name) return
  const key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  if (customAmenities.value.find(a => a.key === key)) return
  customAmenities.value.push({ key, label: name, category: newAmenityCategory.value })
  if (!amenityCatalog.value[newAmenityCategory.value as keyof AmenityCatalog]) {
    amenityCatalog.value[newAmenityCategory.value as keyof AmenityCatalog] = []
  }
  amenityCatalog.value[newAmenityCategory.value as keyof AmenityCatalog].push(key)
  amenityLabels[key] = name
  selectedAmenities.value.push(key)
  newAmenityName.value = ''
  saveCustomAmenities()
}
function removeCustomAmenity(key: string) {
  customAmenities.value = customAmenities.value.filter(a => a.key !== key)
  selectedAmenities.value = selectedAmenities.value.filter(k => k !== key)
  saveCustomAmenities()
}
async function saveCustomAmenities() {
  try {
    const { ConfigService } = await import('@/services/Platform.service')
    await ConfigService.set('custom_amenities', customAmenities.value, hotelId.value)
  } catch {}
}
async function loadCustomAmenities() {
  try {
    const { ConfigService } = await import('@/services/Platform.service')
    const data = await ConfigService.get('custom_amenities', hotelId.value)
    if (Array.isArray(data)) {
      customAmenities.value = data
      for (const a of data) {
        if (!amenityCatalog.value[a.category as keyof AmenityCatalog]) {
          amenityCatalog.value[a.category as keyof AmenityCatalog] = []
        }
        amenityCatalog.value[a.category as keyof AmenityCatalog].push(a.key)
        amenityLabels[a.key] = a.label
      }
    }
  } catch {}
}

const categoryLabels: Record<string, string> = { interior: 'Interior', exterior: 'Exterior', services: 'Servicios' }
const amenityLabels: Record<string, string> = {
  ac: 'Aire Acondicionado', heating: 'Calefacción', kitchen: 'Cocina', microwave: 'Microondas',
  fridge: 'Nevera', coffee_maker: 'Cafetera', washer: 'Lavadora', dishwasher: 'Lavavajillas',
  tv: 'TV', wifi: 'WiFi', safe: 'Caja Fuerte', minibar: 'Minibar', hair_dryer: 'Secador',
  iron: 'Plancha', balcony: 'Balcón', bathtub: 'Bañera', work_desk: 'Escritorio',
  pool: 'Piscina', pool_heated: 'Piscina Climatizada', parking_free: 'Parking Gratis',
  parking_paid: 'Parking Pago', gym: 'Gimnasio', spa: 'SPA', restaurant: 'Restaurante',
  bar: 'Bar', garden: 'Jardín', terrace: 'Terraza', bbq: 'Barbacoa', elevator: 'Ascensor',
  lounge: 'Salón', kids_playground: 'Zona Infantil',
  room_service: 'Room Service', laundry: 'Lavandería', concierge: 'Conserjería',
  luggage_storage: 'Guardaequipaje', pets_allowed: 'Mascotas', wheelchair_access: 'Acceso Silla Ruedas',
}

// Seasons & Rates
const seasonsList = ref<any[]>([])
const ratesMatrix = ref<any[]>([])

onMounted(async () => {
  let errors: string[] = []

  try {
    // Hotel settings
    const s = await SettingsService.get()
    const h = s.hotel as HotelFull & Record<string, unknown>
    form.value = {
      name: h.name ?? '', country: h.country ?? '', address: h.address ?? '',
      phone: h.phone ?? '', email: h.email ?? '',
      timezone: h.timezone ?? 'America/Santo_Domingo', currency: h.currency ?? 'USD',
      checkIn: h.checkIn || '15:00', checkOut: h.checkOut || '12:00',
      plan: h.plan || 'Professional',
      freeCancellation: h.freeCancellation !== false,
      depositRequired: h.depositRequired !== false,
      depositPercent: h.depositPercent ?? 30,
      weekendSurcharge: h.weekendSurcharge ?? 0,
      accommodationType: h.accommodationType ?? '',
      starRating: h.starRating ?? '',
      ownerName: h.ownerName ?? '', ownerTaxId: h.ownerTaxId ?? '',
      phone2: h.phone2 ?? '', website: h.website ?? '',
      province: h.province ?? '', municipality: h.municipality ?? '',
      locality: h.locality ?? '', postalCode: h.postalCode ?? '',
      latitude: h.latitude ? Number(h.latitude) : undefined,
      longitude: h.longitude ? Number(h.longitude) : undefined,
      cancellationType: h.freeCancellationType ?? 'flexible',
      cleaningType: h.cleaningType ?? 'salida',
      depositType: h.depositType ?? 'ninguna', depositFixed: h.depositFixed ?? 0,
      advanceType: h.advanceType ?? 'porcentaje', advanceAmount: h.advanceAmount ?? 0,
      releaseHours: h.releaseHours ?? 0,
      defaultPaymentMethod: h.defaultPaymentMethod ?? 'transfer',
      requestReviews: h.requestReviews === 1 || h.requestReviews === true,
      publishReviewScore: h.publishReviewScore === 1 || h.publishReviewScore === true,
      taxName: h.taxName ?? 'ITBIS', taxRate: h.taxRate ?? 18,
      wifiNetwork: h.wifiNetwork ?? '', wifiPassword: h.wifiPassword ?? '',
      descriptionJson: h.descriptionJson ?? '',
      id: h.id || (h as any)._id,
    }

    // Cargar descripciones multilingües (JSON string → objeto)
    try {
      const parsed = typeof h.descriptionJson === 'string' && h.descriptionJson.startsWith('{')
        ? JSON.parse(h.descriptionJson) : (h.descriptionJson || {})
      descriptions.value = typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch {
      descriptions.value = {}
    }

    // Amenities catalog + selected
    const [cat, sel] = await Promise.all([
      HotelService.amenitiesCatalog(),
      HotelService.amenitiesHotel().catch(() => ({ data: [] })),
    ])
    amenityCatalog.value = cat
    selectedAmenities.value = sel.data.map((a: any) => a.amenityKey)
    await loadCustomAmenities()

    // Seasons
    const seas = await HotelService.seasons().catch(() => ({ data: [] }))
    if (seas.data.length === 0) {
      seasonsList.value = [
        { name: 'baja', label: 'Baja', startDate: '', endDate: '', color: '#3b82f6', sortOrder: 0 },
        { name: 'media', label: 'Media', startDate: '', endDate: '', color: '#f59e0b', sortOrder: 1 },
        { name: 'alta', label: 'Alta', startDate: '', endDate: '', color: '#ef4444', sortOrder: 2 },
        { name: 'especial', label: 'Especial', startDate: '', endDate: '', color: '#8b5cf6', sortOrder: 3 },
      ]
    } else {
      seasonsList.value = seas.data
    }

    // Rates
    const rt = await HotelService.rates().catch(() => ({ data: [] }))
    rebuildMatrix(rt.data || [])
  } catch (e) {
    toast.error('Error al cargar datos')
  } finally {
    loading.value = false
  }
})

async function saveAll() {
  if (saving.value) return

  // Client-side validation
  const validationErrors: string[] = []
  if (!form.value.name?.trim()) validationErrors.push('Nombre del hotel es obligatorio')
  if (!form.value.country?.trim()) validationErrors.push('País es obligatorio')
  if (validationErrors.length) {
    toast.error(validationErrors.join('. '))
    return
  }

  saving.value = true
  const errors: string[] = []

  const saveField = (k: string, v: any) => v !== undefined && v !== null ? v : undefined
  const patch: Record<string, any> = {}
  const keys = ['name','country','address','phone','email','timezone','currency','checkIn','checkOut',
    'freeCancellation','depositRequired','depositPercent','weekendSurcharge',
    'accommodationType','starRating','ownerName','ownerTaxId','phone2','website',
    'province','municipality','locality','postalCode','latitude','longitude',
    'cancellationType','cleaningType',
    'depositType','depositFixed','advanceType','advanceAmount','releaseHours','defaultPaymentMethod',
    'requestReviews','publishReviewScore','taxName','taxRate',
    'wifiNetwork','wifiPassword','descriptionJson']
  for (const k of keys) {
    const v = saveField(k, (form.value as Record<string, unknown>)[k])
    if (v !== undefined) (patch as Record<string, unknown>)[k] = typeof v === 'boolean' ? (v ? 1 : 0) : v
  }
  // Serializar descripciones multilingües como JSON
  patch.descriptionJson = JSON.stringify(descriptions.value)

  try {
    await SettingsService.patchHotel(patch)
  } catch { errors.push('hotel') }

  try {
    await HotelService.saveAmenitiesHotel(selectedAmenities.value)
  } catch { errors.push('amenities') }

  try {
    const seasons = seasonsList.value.map((s, i) => ({
      name: s.name, label: s.label, startDate: s.startDate, endDate: s.endDate,
      color: s.color, sortOrder: i,
    }))
    await HotelService.saveSeasons(seasons)
  } catch { errors.push('temporadas') }

  try {
    const rates: any[] = []
    for (const row of ratesMatrix.value) {
      for (const [season, price] of Object.entries(row.prices)) {
        rates.push({ roomType: row.roomType, occupancy: row.occupancy, season, price })
      }
    }
    await HotelService.saveRates(rates)
  } catch { errors.push('tarifas') }

  saving.value = false
  if (errors.length) {
    toast.error(`Error guardando: ${errors.join(', ')}`)
  } else {
    toast.success('Configuración guardada')
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Leaflet — mapa interactivo de ubicación
// ════════════════════════════════════════════════════════════════════════════
const mapEl = ref<HTMLElement | null>(null)
let map: LeafletMap | null = null
let marker: LeafletMarker | null = null

function initMap() {
  if (!mapEl.value || map) return
  const lat = Number(form.value.latitude) || 18.4861 // Default: Santo Domingo
  const lng = Number(form.value.longitude) || -69.9312
  map = leaflet.map(mapEl.value).setView([lat, lng], 14)
  leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(map)
  marker = leaflet.marker([lat, lng], { draggable: true }).addTo(map)
  marker.on('dragend', () => {
    const pos = marker!.getLatLng()
    form.value.latitude = pos.lat
    form.value.longitude = pos.lng
  })
  map.on('click', (e: any) => {
    form.value.latitude = e.latlng.lat
    form.value.longitude = e.latlng.lng
    marker!.setLatLng(e.latlng)
  })
}

function syncMarkerFromForm() {
  const lat = Number(form.value.latitude)
  const lng = Number(form.value.longitude)
  if (Number.isFinite(lat) && Number.isFinite(lng) && marker && map) {
    marker.setLatLng([lat, lng])
    map.setView([lat, lng], 14)
  }
}

function useMyLocation() {
  if (!navigator.geolocation) {
    toast.error('Geolocalización no disponible')
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      form.value.latitude = pos.coords.latitude
      form.value.longitude = pos.coords.longitude
      syncMarkerFromForm()
      toast.success('Ubicación actualizada')
    },
    () => toast.error('No se pudo obtener tu ubicación'),
  )
}

// Inicializar mapa cuando se entra al tab location
watch(activeTab, async (val) => {
  if (val === 'location') {
    await nextTick()
    initMap()
    if (map) setTimeout(() => map!.invalidateSize(), 100)
  }
})

// ════════════════════════════════════════════════════════════════════════════
// Descripción multilingüe (12 idiomas)
// ════════════════════════════════════════════════════════════════════════════
const supportedLangs = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ca', name: 'Català', flag: '🇪🇸' },
]
const activeLang = ref('es')
const descriptions = ref<Record<string, string>>({})
const currentLangName = computed(() => supportedLangs.find(l => l.code === activeLang.value)?.name || '')
const completedLangsCount = computed(() => supportedLangs.filter(l => (descriptions.value[l.code] || '').trim().length > 0).length)

// ════════════════════════════════════════════════════════════════════════════
// Copy rates to next year
// ════════════════════════════════════════════════════════════════════════════
const copying = ref(false)
async function copyRatesNextYear() {
  if (copying.value) return
  copying.value = true
  try {
    const r = await HotelService.copyRatesNextYear()
    toast.success(`✅ ${r.copied} tarifas copiadas al próximo año`)
    // Recargar matriz
    const rt = await HotelService.rates()
    rebuildMatrix(rt.data)
  } catch {
    toast.error('Error al copiar tarifas')
  } finally {
    copying.value = false
  }
}

function rebuildMatrix(ratesData: any[]) {
  const roomMap = new Map<string, Set<number>>()
  for (const r of ratesData) {
    if (!roomMap.has(r.roomType)) roomMap.set(r.roomType, new Set())
    roomMap.get(r.roomType)!.add(r.occupancy)
  }
  const matrix: any[] = []
  for (const [roomType, occs] of roomMap) {
    for (const occ of [...occs].sort()) {
      const prices: Record<string, number> = {}
      const basePrices: Record<string, number> = {}
      const percentages: Record<string, number> = {}
      const closedCells: Record<string, boolean> = {}
      for (const s of seasonsList.value) {
        const existing = ratesData.find((r: any) => r.roomType === roomType && r.occupancy === occ && r.season === s.name)
        prices[s.name] = existing ? existing.price : 0
        basePrices[s.name] = existing?.basePrice ?? 0
        percentages[s.name] = existing?.percentage ?? 0
        closedCells[s.name] = existing?.closed === 1 || existing?.closed === true
      }
      matrix.push({ roomType, occupancy: occ, prices, basePrices, percentages, closedCells })
    }
  }
  ratesMatrix.value = matrix
}

// ════════════════════════════════════════════════════════════════════════════
// Tarifas estilo MisterPlan — precio base + % por temporada
// ════════════════════════════════════════════════════════════════════════════
const savingRates = ref(false)
const roomTypes = computed(() => [...new Set(ratesMatrix.value.map(r => r.roomType))])

function getBasePrice(roomType: string): number {
  const row = ratesMatrix.value.find(r => r.roomType === roomType && r.occupancy === 1)
  return row?.basePrices?.[seasonsList.value[0]?.name] ?? 0
}

function setBasePrice(roomType: string, event: Event) {
  const val = Number((event.target as HTMLInputElement).value) || 0
  for (const row of ratesMatrix.value) {
    if (row.roomType === roomType) {
      for (const s of seasonsList.value) {
        row.basePrices[s.name] = val
        const pct = row.percentages[s.name] ?? 0
        row.prices[s.name] = Math.round(val * (1 + pct / 100) * 100) / 100
      }
    }
  }
}

function getPercentage(roomType: string, season: string): number {
  const row = ratesMatrix.value.find(r => r.roomType === roomType && r.occupancy === 1)
  return row?.percentages?.[season] ?? 0
}

function setPercentage(roomType: string, season: string, event: Event) {
  const val = Number((event.target as HTMLInputElement).value) || 0
  const row = ratesMatrix.value.find(r => r.roomType === roomType && r.occupancy === 1)
  if (row) {
    row.percentages[season] = val
    const base = row.basePrices[season] ?? 0
    row.prices[season] = Math.round(base * (1 + val / 100) * 100) / 100
  }
}

function getCalculatedPrice(roomType: string, season: string): number {
  const row = ratesMatrix.value.find(r => r.roomType === roomType && r.occupancy === 1)
  return row?.prices?.[season] ?? 0
}

function isCellClosed(roomType: string, season: string): boolean {
  const row = ratesMatrix.value.find(r => r.roomType === roomType && r.occupancy === 1)
  return row?.closedCells?.[season] ?? false
}

function toggleClosed(roomType: string, season: string) {
  const row = ratesMatrix.value.find(r => r.roomType === roomType && r.occupancy === 1)
  if (row) {
    row.closedCells[season] = !row.closedCells[season]
  }
}

async function saveRates() {
  if (savingRates.value) return
  savingRates.value = true
  try {
    // Save seasons
    const seasons = seasonsList.value.map((s, i) => ({
      name: s.name, label: s.label, startDate: s.startDate, endDate: s.endDate,
      color: s.color, sortOrder: i,
    }))
    await HotelService.saveSeasons(seasons)

    // Save rates with new fields
    const rates: any[] = []
    for (const row of ratesMatrix.value) {
      for (const s of seasonsList.value) {
        rates.push({
          roomType: row.roomType,
          occupancy: row.occupancy,
          season: s.name,
          basePrice: row.basePrices?.[s.name] ?? 0,
          percentage: row.percentages?.[s.name] ?? 0,
          price: row.prices?.[s.name] ?? 0,
          closed: row.closedCells?.[s.name] ?? false,
        })
      }
    }
    await HotelService.saveRates(rates)
    toast.success('Tarifas guardadas')
  } catch {
    toast.error('Error al guardar tarifas')
  } finally {
    savingRates.value = false
  }
}
</script>
