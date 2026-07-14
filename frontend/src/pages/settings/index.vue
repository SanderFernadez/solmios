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
          <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
            <div class="h-5 w-40 bg-surface rounded mb-4 animate-pulse"></div>
            <div class="grid grid-cols-2 gap-4">
              <div v-for="i in 6" :key="i">
                <div class="h-3 w-20 bg-surface rounded mb-2 animate-pulse"></div>
                <div class="h-10 w-full bg-surface rounded-xl animate-pulse"></div>
              </div>
            </div>
          </div>
          <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
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
          <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
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
      <button @click="saveAll" :disabled="saving" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer disabled:opacity-50">
        {{ saving ? 'Guardando...' : 'Guardar' }}
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6 overflow-x-auto">
      <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
        class="px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
        :class="activeTab === tab.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        {{ tab.label }}
      </button>
    </div>

    <!-- ========== HOTEL ========== -->
    <div v-if="activeTab === 'hotel'" class="grid lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
          <h3 class="font-extrabold text-navy mb-4">Datos del Hotel</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Nombre *</label>
              <input v-model="form.name" type="text" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Tipo de Alojamiento</label>
              <select v-model="form.accommodationType" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
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
              <select v-model="form.country" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
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
              <select v-model="form.starRating" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="">N/A</option>
                <option value="1">1 Estrella</option>
                <option value="2">2 Estrellas</option>
                <option value="3">3 Estrellas</option>
                <option value="4">4 Estrellas</option>
                <option value="5">5 Estrellas</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Dirección</label>
              <input v-model="form.address" type="text" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Provincia</label>
              <input v-model="form.province" type="text" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Municipio</label>
              <input v-model="form.municipality" type="text" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
          </div>
        </div>

        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
          <h3 class="font-extrabold text-navy mb-4">Contacto</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Teléfono Principal</label>
              <input v-model="form.phone" type="tel" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Teléfono 2</label>
              <input v-model="form.phone2" type="tel" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Email</label>
              <input v-model="form.email" type="email" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Sitio Web</label>
              <input v-model="form.website" type="url" placeholder="https://" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
          </div>
        </div>

        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
          <h3 class="font-extrabold text-navy mb-4">Propietario</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Nombre del Propietario</label>
              <input v-model="form.ownerName" type="text" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">CIF/NIF/RNC</label>
              <input v-model="form.ownerTaxId" type="text" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
          </div>
        </div>

        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
          <h3 class="font-extrabold text-navy mb-4">Check-In / Check-Out</h3>
          <div class="grid grid-cols-4 gap-4">
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Check-In</label>
              <input v-model="form.checkIn" type="time" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Check-Out</label>
              <input v-model="form.checkOut" type="time" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Zona Horaria</label>
              <select v-model="form.timezone" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
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
              <select v-model="form.currency" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="USD">USD</option><option value="DOP">DOP</option><option value="COP">COP</option>
                <option value="MXN">MXN</option><option value="PEN">PEN</option><option value="CLP">CLP</option><option value="ARS">ARS</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Conversión de moneda (F3 match-misterplan) -->
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="font-extrabold text-navy mb-1">Conversión de moneda</h3>
        <p class="text-xs text-text-muted mb-4">Moneda secundaria para mostrar totales convertidos (ej. en el detalle de reserva).</p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Moneda secundaria</label>
            <select v-model="currencyConfig.secondaryCurrency" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
              <option value="DOP">DOP (Pesos dominicanos)</option><option value="USD">USD</option><option value="EUR">EUR</option>
              <option value="COP">COP</option><option value="MXN">MXN</option><option value="ARS">ARS</option><option value="CLP">CLP</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Tipo de cambio</label>
            <input v-model.number="currencyConfig.exchangeRate" type="number" min="0" step="0.01" class="w-full px-4 py-2.5 rounded-full border border-border text-sm focus:outline-none focus:border-navy" />
          </div>
        </div>
        <button @click="saveCurrency" :disabled="currencySaving" class="mt-4 px-5 py-2.5 bg-teal text-white rounded-full text-sm font-bold cursor-pointer hover:opacity-90 disabled:opacity-50">
          {{ currencySaving ? 'Guardando…' : 'Guardar conversión' }}
        </button>
      </div>

      <!-- PIN de tarjeta de garantía (MisterPlan) -->
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="font-extrabold text-navy mb-1">PIN de tarjeta de garantía</h3>
        <p class="text-xs text-text-muted mb-4">PIN requerido para ver los datos de las tarjetas de garantía en el detalle de reserva.
          <span v-if="hasGuaranteePin" class="text-teal font-semibold">Configurado</span>
          <span v-else class="text-coral font-semibold">Sin configurar</span>
        </p>
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Nuevo PIN (4-8 dígitos)</label>
            <input v-model="guaranteePinDraft" type="password" inputmode="numeric" maxlength="8" placeholder="••••" class="px-4 py-2.5 rounded-full border border-border text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-40" />
          </div>
          <button @click="saveGuaranteePin" :disabled="guaranteePinSaving || !guaranteePinDraft" class="px-5 py-2.5 bg-navy text-white rounded-full text-sm font-bold cursor-pointer hover:opacity-90 disabled:opacity-50">
            {{ guaranteePinSaving ? 'Guardando…' : 'Guardar PIN' }}
          </button>
        </div>
      </div>

      <!-- Automatización del flujo de reserva (auto/manual) -->
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="font-extrabold text-navy mb-1">Automatización</h3>
        <p class="text-xs text-text-muted mb-4">Acciones automáticas al confirmar / hacer check-in. Podés apagarlas y hacerlo manual cuando quieras.</p>
        <div class="space-y-3">
          <label class="flex items-center justify-between bg-surface rounded-xl p-3 cursor-pointer">
            <span class="text-sm font-bold text-navy">Generar código de puerta al hacer check-in <span class="text-[11px] font-normal text-text-muted">(requiere TTLock conectado)</span></span>
            <input type="checkbox" v-model="automation.autoLockCode" class="w-5 h-5 rounded text-cyan" />
          </label>
          <label class="flex items-center justify-between bg-surface rounded-xl p-3 cursor-pointer">
            <span class="text-sm font-bold text-navy">Enviar requerimiento de pago al confirmar <span class="text-[11px] font-normal text-text-muted">(deuda técnica: hook backend)</span></span>
            <input type="checkbox" v-model="automation.autoPaymentRequest" class="w-5 h-5 rounded text-cyan" />
          </label>
        </div>
        <button @click="saveAutomation" :disabled="automationSaving" class="mt-4 px-5 py-2.5 bg-navy text-white rounded-full text-sm font-bold cursor-pointer hover:opacity-90 disabled:opacity-50">
          {{ automationSaving ? 'Guardando…' : 'Guardar automatización' }}
        </button>
      </div>

      <div class="space-y-6">
        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
          <h3 class="font-extrabold text-navy mb-4">Plan</h3>
          <div class="bg-purple/10 rounded-xl p-4 text-center">
            <div class="text-[10px] font-bold text-teal uppercase mb-1">Activo</div>
            <div class="text-lg font-black text-purple">{{ form.plan || 'Professional' }}</div>
            <div class="text-2xl font-black text-navy mt-1">{{ planPrice }}<span class="text-sm text-text-muted">/mes</span></div>
          </div>
        </div>
        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6 text-center">
          <span class="w-8 h-8 mx-auto mb-2 block text-navy/40" v-html="ICON_BUILDING"></span>
          <div class="text-sm font-bold text-navy">{{ form.name || 'Hotel' }}</div>
          <div class="text-[10px] text-text-muted mt-1">{{ form.country || '' }}</div>
        </div>
      </div>
    </div>

    <!-- ========== LOCATION (Leaflet map) ========== -->
    <div v-if="activeTab === 'location'" class="grid lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="font-extrabold text-navy mb-4">Mapa Interactivo</h3>
        <div ref="mapEl" class="w-full h-96 rounded-xl border border-border overflow-hidden"></div>
        <p class="text-[11px] text-text-muted mt-2">Click en el mapa para ajustar la ubicación exacta.</p>
      </div>
      <div class="space-y-4">
        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
          <h3 class="font-extrabold text-navy mb-4">Coordenadas</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Latitud</label>
              <input v-model.number="form.latitude" type="number" step="0.000001" @change="syncMarkerFromForm"
                class="w-full px-3 py-2 rounded-full border border-border text-sm font-bold text-navy" />
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Longitud</label>
              <input v-model.number="form.longitude" type="number" step="0.000001" @change="syncMarkerFromForm"
                class="w-full px-3 py-2 rounded-full border border-border text-sm font-bold text-navy" />
            </div>
          </div>
          <button @click="useMyLocation" class="mt-3 w-full text-xs font-bold text-teal hover:underline cursor-pointer">
            Usar mi ubicación actual
          </button>
        </div>
        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
          <h3 class="font-extrabold text-navy mb-4">Dirección Postal</h3>
          <div class="space-y-3">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Localidad</label>
              <input v-model="form.locality" class="w-full px-3 py-2 rounded-full border border-border text-sm" />
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Código Postal</label>
              <input v-model="form.postalCode" class="w-full px-3 py-2 rounded-full border border-border text-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== AMENITIES ========== -->
    <div v-if="activeTab === 'amenities'" class="space-y-6">
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="(items, category) in amenityCatalog" :key="category" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
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
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="font-extrabold text-navy mb-4">Agregar Amenity Personalizada</h3>
        <div class="flex gap-3">
          <select v-model="newAmenityCategory" class="px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer">
            <option value="interior">Interior</option>
            <option value="exterior">Exterior</option>
            <option value="services">Servicios</option>
          </select>
          <input v-model="newAmenityName" type="text" placeholder="Nombre de la amenity..." class="flex-1 px-4 py-2.5 rounded-full border border-border text-sm" @keyup.enter="addCustomAmenity" />
          <button @click="addCustomAmenity" class="px-5 py-2.5 bg-cyan text-navy rounded-full text-sm font-bold cursor-pointer hover:shadow-lg">Agregar</button>
        </div>
        <div v-if="customAmenities.length > 0" class="mt-3 flex flex-wrap gap-2">
          <span v-for="a in customAmenities" :key="a.key" class="px-3 py-1.5 bg-navy/5 text-navy rounded-full text-xs font-bold flex items-center gap-1">
            {{ a.label }}
            <button @click="removeCustomAmenity(a.key)" class="w-3 h-3 text-coral hover:opacity-75 cursor-pointer ml-1" v-html="ICON_X"></button>
          </span>
        </div>
      </div>
    </div>

    <!-- ========== TARIFAS ========== -->
    <div v-if="activeTab === 'rates'" class="space-y-6">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
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
                <input v-model="s.startDate" type="date" class="w-full mt-1 px-3 py-2 rounded-full border border-border text-xs focus:outline-none focus:border-navy" />
              </div>
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase">Fin</label>
                <input v-model="s.endDate" type="date" class="w-full mt-1 px-3 py-2 rounded-full border border-border text-xs focus:outline-none focus:border-navy" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Matriz de Tarifas: filas roomType × occupancy, columnas seasons -->
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="font-extrabold text-navy">Matriz de Tarifas</h3>
          <div class="flex gap-2">
            <button @click="copyRatesNextYear" :disabled="copying"
              class="px-4 py-2 bg-navy/5 hover:bg-navy/10 text-navy rounded-full text-xs font-bold transition-colors cursor-pointer disabled:opacity-50">
              {{ copying ? 'Copiando...' : 'Copiar al próximo año' }}
            </button>
            <button @click="saveRates" :disabled="savingRates"
              class="px-4 py-2 bg-cyan text-navy rounded-full text-xs font-bold transition-colors cursor-pointer disabled:opacity-50">
              {{ savingRates ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>

        <div class="overflow-auto max-h-[70vh] rounded-xl border border-border">
          <table class="w-full border-collapse text-sm" style="min-width: 560px">
            <thead>
              <tr>
                <th class="sticky top-0 left-0 z-30 bg-navy text-white px-4 py-3 text-left font-extrabold whitespace-nowrap">
                  Tipo / Ocupación
                </th>
                <th v-for="s in seasonsList" :key="s.name"
                  class="sticky top-0 z-20 px-3 py-3 text-center font-extrabold text-white whitespace-nowrap"
                  style="min-width: 130px" :style="{ backgroundColor: s.color }">
                  {{ s.label || s.name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="roomType in roomTypes" :key="roomType">
                <!-- Fila separadora de grupo: nombre + precio base editable -->
                <tr class="border-t-2" style="border-color: rgba(13, 43, 78, 0.3)">
                  <td :colspan="seasonsList.length + 1" class="bg-surface px-4 py-2.5">
                    <div class="flex items-center gap-3 flex-wrap">
                      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-navy to-cyan flex items-center justify-center text-white text-xs font-bold">
                        {{ roomType.charAt(0).toUpperCase() }}
                      </div>
                      <span class="font-extrabold text-navy capitalize">{{ roomType }}</span>
                      <label class="flex items-center gap-2 ml-auto text-[10px] font-bold text-text-muted uppercase">
                        Precio Base $
                        <input :value="getBasePrice(roomType)" @input="setBasePrice(roomType, $event)" type="number" min="0"
                          class="w-24 px-3 py-1.5 rounded-full border border-border text-sm font-bold text-navy focus:outline-none focus:border-cyan" />
                      </label>
                    </div>
                  </td>
                </tr>
                <!-- Filas por ocupación -->
                <tr v-for="occ in getOccupancies(roomType)" :key="occ" class="border-t border-border">
                  <td class="sticky left-0 z-10 bg-white px-4 py-2 text-xs font-bold text-text-muted whitespace-nowrap">
                    {{ occ }} huésped{{ occ > 1 ? 'es' : '' }}
                  </td>
                  <td v-for="s in seasonsList" :key="s.name" class="px-2 py-2 text-center align-top"
                    :class="isCellClosed(roomType, occ, s.name) ? 'opacity-60' : ''"
                    :style="!isCellClosed(roomType, occ, s.name) ? { backgroundColor: s.color + '0D' } : { backgroundColor: 'rgba(239,68,68,0.12)' }">
                    <div class="flex flex-col items-center gap-1">
                      <div class="flex items-center gap-1">
                        <span class="text-xs font-black" :style="{ color: s.color }">+</span>
                        <input :value="getPercentage(roomType, occ, s.name)" @input="setPercentage(roomType, occ, s.name, $event)"
                          type="number" min="0" max="500" step="0.5"
                          class="w-14 px-2 py-1 rounded-full border border-border text-sm font-bold text-navy text-right focus:outline-none focus:border-cyan" />
                        <span class="text-xs font-bold text-text-muted">%</span>
                      </div>
                      <div class="text-xs font-extrabold text-navy">= ${{ getCalculatedPrice(roomType, occ, s.name) }}</div>
                      <button @click="toggleClosed(roomType, occ, s.name)"
                        class="text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                        :class="isCellClosed(roomType, occ, s.name) ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-surface text-text-muted hover:bg-surface-dark'">
                        {{ isCellClosed(roomType, occ, s.name) ? 'Cerrado' : 'Abierto' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="roomTypes.length === 0">
                <td :colspan="seasonsList.length + 1" class="px-4 py-8 text-center text-text-muted text-sm">
                  No hay tarifas configuradas. Creá habitaciones con tipo definido para generar la matriz.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="text-[11px] text-text-muted mt-3">
          Cada celda aplica un % sobre el precio base del tipo de habitación. Precio final = base × (1 + % / 100).
        </p>
      </div>
    </div>

    <!-- ========== CONDICIONES ========== -->
    <div v-if="(activeTab as string) === 'conditions'" class="grid lg:grid-cols-2 gap-6">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
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
            <input v-model.number="form.depositPercent" type="number" min="1" max="100" class="w-20 px-3 py-2 rounded-full border border-border text-sm font-bold text-navy text-right" />
            <span class="text-sm text-text-muted">%</span>
          </div>
        </div>
      </div>

      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="font-extrabold text-navy mb-4">Impuestos</h3>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Nombre</label>
              <input v-model="form.taxName" placeholder="ITBIS" class="w-full px-3 py-2 rounded-full border border-border text-sm" />
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Tasa (%)</label>
              <input v-model.number="form.taxRate" type="number" min="0" max="100" class="w-full px-3 py-2 rounded-full border border-border text-sm font-bold text-navy text-right" />
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="font-extrabold text-navy mb-4">Depósito y Fianza</h3>
        <div class="space-y-4">
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Tipo de Fianza</label>
            <select v-model="form.depositType" class="w-full px-3 py-2 rounded-full border border-border text-sm cursor-pointer">
              <option value="ninguna">Ninguna</option>
              <option value="fija">Fija</option>
              <option value="porcentaje">Porcentaje</option>
            </select>
          </div>
          <div v-if="form.depositType === 'fija' || form.depositType === 'porcentaje'">
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Valor</label>
            <div class="flex items-center gap-2">
              <span class="text-sm text-text-muted">{{ form.depositType === 'fija' ? '$' : '' }}</span>
              <input v-model.number="form.depositFixed" type="number" min="0" class="w-24 px-3 py-2 rounded-full border border-border text-sm font-bold text-navy text-right" />
              <span v-if="form.depositType === 'porcentaje'" class="text-sm text-text-muted">%</span>
            </div>
          </div>
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Forma de Pago por Defecto</label>
            <select v-model="form.defaultPaymentMethod" class="w-full px-3 py-2 rounded-full border border-border text-sm cursor-pointer">
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
              <option value="cash">Efectivo</option>
              <option value="paypal">PayPal</option>
              <option value="link">Link de Pago</option>
            </select>
          </div>
        </div>
      </div>

      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
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
    <div v-if="(activeTab as string) === 'description'" class="space-y-6">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-extrabold text-navy">Descripción Multilingüe</h3>
          <div class="flex gap-2">
            <select v-model="activeLang" class="px-3 py-1.5 rounded-full border border-border text-sm font-bold text-navy cursor-pointer">
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
          rows="10" class="w-full px-4 py-3 rounded-full border border-border text-sm focus:outline-none focus:border-navy resize-y"></textarea>
        <div class="flex items-center justify-between mt-2">
          <span class="text-[10px] text-text-muted">{{ (descriptions[activeLang] || '').length }} / 2000 caracteres</span>
          <span class="text-[10px] text-text-muted">{{ completedLangsCount }} / {{ supportedLangs.length }} idiomas completados</span>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="font-extrabold text-navy mb-4">Logo del Hotel</h3>
        <div class="flex items-center gap-4">
          <div v-if="form.logo" class="w-20 h-20 rounded-xl border border-border overflow-hidden bg-surface flex items-center justify-center">
            <img :src="form.logo" alt="Logo" class="w-full h-full object-contain" />
          </div>
          <div v-else class="w-20 h-20 rounded-xl border-2 border-dashed border-border bg-surface flex items-center justify-center">
            <span class="w-6 h-6 text-navy/30" v-html="ICON_BUILDING"></span>
          </div>
          <div class="flex-1">
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">URL del Logo</label>
            <input v-model="form.logo" type="url" placeholder="https://ejemplo.com/logo.png" class="w-full px-3 py-2 rounded-full border border-border text-sm" />
            <p class="text-[10px] text-text-muted mt-1">Se muestra en facturas, pre-checkin y emails</p>
          </div>
        </div>
      </div>

      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="font-extrabold text-navy mb-4">WiFi (compartido en pre-checkin)</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Red</label>
            <input v-model="form.wifiNetwork" class="w-full px-3 py-2 rounded-full border border-border text-sm" />
          </div>
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Contraseña</label>
            <input v-model="form.wifiPassword" type="password" class="w-full px-3 py-2 rounded-full border border-border text-sm" />
          </div>
        </div>
      </div>
    </div>

    <!-- ========== INTEGRACIONES ========== -->
    <div v-if="(activeTab as string) === 'integrations'" class="grid md:grid-cols-2 gap-6">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="font-extrabold text-navy mb-4">Channel Manager</h3>
        <div class="p-4 bg-surface rounded-xl">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <span class="w-5 h-5 text-navy/50" v-html="ICON_GLOBE"></span>
              <div><div class="text-sm font-bold text-navy">Channex</div><div class="text-[10px] text-text-muted">Sincronización con OTAs</div></div>
            </div>
            <span class="text-[10px] font-bold px-2 py-1 rounded-full bg-teal/10 text-teal">Conectado</span>
          </div>
          <router-link to="/panel/channel-manager" class="block w-full text-center px-4 py-2 bg-navy/10 text-navy rounded-full text-sm font-bold hover:bg-navy/20 transition-colors cursor-pointer">Gestionar Canales</router-link>
        </div>
      </div>

      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="font-extrabold text-navy mb-4">Pasarela de Pagos</h3>
        <!-- Las pasarelas se configuran en /panel/pagos: acá había una segunda fuente de verdad
             (configuration.stripe_config, sin cifrar) que solo la usaba uno de los tres flujos de cobro. -->
        <div class="p-4 bg-surface rounded-xl">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <span class="w-5 h-5 text-navy/50" v-html="ICON_CARD"></span>
              <div><div class="text-sm font-bold text-navy">Pasarelas de Pago</div><div class="text-[10px] text-text-muted">Stripe, Azul, CardNet, PayPal</div></div>
            </div>
          </div>
          <p class="text-[11px] text-text-secondary mb-3 leading-relaxed">
            Conectá la cuenta donde querés recibir el dinero de tus reservas. Las llaves se guardan cifradas.
          </p>
          <router-link to="/panel/pagos" class="block text-center w-full px-4 py-2 bg-navy text-white rounded-full text-sm font-bold hover:shadow-lg cursor-pointer">
            Configurar pasarelas
          </router-link>
        </div>
      </div>

      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="font-extrabold text-navy mb-4">WhatsApp Business</h3>
        <div class="p-4 bg-surface rounded-xl">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <span class="w-5 h-5 text-navy/50" v-html="ICON_MESSAGE"></span>
              <div><div class="text-sm font-bold text-navy">WhatsApp</div><div class="text-[10px] text-text-muted">Mensajes automatizados</div></div>
            </div>
            <span class="text-[10px] font-bold px-2 py-1 rounded-full bg-gold/10 text-gold">No configurado</span>
          </div>
          <p class="text-xs text-text-muted">Requiere cuenta de Meta Business.</p>
        </div>
      </div>

      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="font-extrabold text-navy mb-4">Facturación Electrónica</h3>
        <div class="p-4 bg-surface rounded-xl">
          <div class="flex items-center gap-3 mb-3">
            <span class="w-5 h-5 text-navy/50" v-html="ICON_RECEIPT"></span>
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
import { ConfigService } from '@/services/Platform.service'
import { GuaranteeService } from '@/services/Guarantee.service'
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

const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'
const ICON_BUILDING = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>'
const ICON_GLOBE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>'
const ICON_CARD = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>'
const ICON_MESSAGE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>'
const ICON_RECEIPT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

// Stripe se configura en /panel/pagos (tabla payment_gateways, cifrada y por hotel).
// El bloque anterior leía configuration['stripe_config'] y traía la secretKey EN CLARO al
// navegador: el endpoint genérico de configuración devuelve el JSON entero, secretos incluidos.

// Conversión de moneda secundaria (F3 match-misterplan — totales convertidos en el detalle de reserva)
const currencyConfig = reactive({ secondaryCurrency: 'DOP', exchangeRate: 60 })
const currencySaving = ref(false)
async function loadCurrency() {
  try {
    const c = await ConfigService.get('currency_config') as { secondaryCurrency?: string; exchangeRate?: number } | null
    if (c) { currencyConfig.secondaryCurrency = c.secondaryCurrency || 'DOP'; currencyConfig.exchangeRate = c.exchangeRate ?? 60 }
  } catch { /* default */ }
}
onMounted(loadCurrency)
async function saveCurrency() {
  currencySaving.value = true
  try {
    await ConfigService.set('currency_config', { secondaryCurrency: currencyConfig.secondaryCurrency, exchangeRate: Number(currencyConfig.exchangeRate) || 0 })
    toast.success('Conversión de moneda guardada')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo guardar')
  } finally {
    currencySaving.value = false
  }
}

// PIN de tarjeta de garantía del hotel (MisterPlan) — protege el acceso a las tarjetas en el detalle de reserva.
const guaranteePinDraft = ref('')
const guaranteePinSaving = ref(false)
const hasGuaranteePin = ref(false)
async function loadGuaranteePin() {
  try { hasGuaranteePin.value = (await GuaranteeService.hasPin()).hasPin } catch { /* ignore */ }
}
onMounted(loadGuaranteePin)
async function saveGuaranteePin() {
  const pin = (guaranteePinDraft.value || '').trim()
  if (!/^\d{4,8}$/.test(pin)) { toast.error('El PIN debe tener entre 4 y 8 dígitos'); return }
  guaranteePinSaving.value = true
  try {
    await GuaranteeService.setPin(pin)
    hasGuaranteePin.value = true
    guaranteePinDraft.value = ''
    toast.success('PIN de garantía guardado')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo guardar el PIN')
  } finally {
    guaranteePinSaving.value = false
  }
}

// Automatización del flujo de reserva (auto/manual): PIN de puerta al check-in y requerimiento de pago al confirmar.
const automation = reactive({ autoLockCode: false, autoPaymentRequest: false })
const automationSaving = ref(false)
async function loadAutomation() {
  try {
    const c = await ConfigService.get('automation_config') as { autoLockCode?: boolean; autoPaymentRequest?: boolean } | null
    if (c) { automation.autoLockCode = !!c.autoLockCode; automation.autoPaymentRequest = !!c.autoPaymentRequest }
  } catch { /* default off */ }
}
onMounted(loadAutomation)
async function saveAutomation() {
  automationSaving.value = true
  try {
    await ConfigService.set('automation_config', { autoLockCode: automation.autoLockCode, autoPaymentRequest: automation.autoPaymentRequest })
    toast.success('Automatización guardada')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo guardar')
  } finally {
    automationSaving.value = false
  }
}

const activeTab = ref('hotel' as string)
const saving = ref(false)
const loading = ref(true)

const tabs = [
  { value: 'hotel' as string, label: 'Hotel' },
  { value: 'location' as string, label: 'Ubicación' },
  { value: 'amenities' as string, label: 'Amenities' },
  { value: 'rates' as string, label: 'Tarifas' },
  { value: 'conditions' as string, label: 'Condiciones' },
  { value: 'description' as string, label: 'Descripción' },
  { value: 'integrations' as string, label: 'Integraciones' },
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
  wifiNetwork: '', wifiPassword: '', logo: '',
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
      wifiNetwork: h.wifiNetwork ?? '', wifiPassword: h.wifiPassword ?? '', logo: h.logo ?? '',
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
    'wifiNetwork','wifiPassword','descriptionJson','logo']
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
    await HotelService.saveRates(buildRatesPayload())
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
    toast.success(`${r.copied} tarifas copiadas al próximo año`)
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

function getPercentage(roomType: string, occupancy: number, season: string): number {
  const row = ratesMatrix.value.find(r => r.roomType === roomType && r.occupancy === occupancy)
  return row?.percentages?.[season] ?? 0
}

function setPercentage(roomType: string, occupancy: number, season: string, event: Event) {
  const val = Number((event.target as HTMLInputElement).value) || 0
  const row = ratesMatrix.value.find(r => r.roomType === roomType && r.occupancy === occupancy)
  if (row) {
    row.percentages[season] = val
    const base = row.basePrices[season] ?? 0
    row.prices[season] = Math.round(base * (1 + val / 100) * 100) / 100
  }
}

function getCalculatedPrice(roomType: string, occupancy: number, season: string): number {
  const row = ratesMatrix.value.find(r => r.roomType === roomType && r.occupancy === occupancy)
  return row?.prices?.[season] ?? 0
}

function isCellClosed(roomType: string, occupancy: number, season: string): boolean {
  const row = ratesMatrix.value.find(r => r.roomType === roomType && r.occupancy === occupancy)
  return row?.closedCells?.[season] ?? false
}

function toggleClosed(roomType: string, occupancy: number, season: string) {
  const row = ratesMatrix.value.find(r => r.roomType === roomType && r.occupancy === occupancy)
  if (row) {
    row.closedCells[season] = !row.closedCells[season]
  }
}

function getOccupancies(roomType: string): number[] {
  const occs = new Set<number>()
  for (const r of ratesMatrix.value) {
    if (r.roomType === roomType) occs.add(r.occupancy)
  }
  return [...occs].sort()
}

function buildRatesPayload() {
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
  return rates
}

async function saveRates() {
  if (savingRates.value) return
  savingRates.value = true
  try {
    const seasons = seasonsList.value.map((s, i) => ({
      name: s.name, label: s.label, startDate: s.startDate, endDate: s.endDate,
      color: s.color, sortOrder: i,
    }))
    await HotelService.saveSeasons(seasons)
    await HotelService.saveRates(buildRatesPayload())
    toast.success('Tarifas guardadas')
  } catch {
    toast.error('Error al guardar tarifas')
  } finally {
    savingRates.value = false
  }
}
</script>
