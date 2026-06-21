# SPEC: Complete Settings (Configuración)

## Requirements

### REQ-1: Settings MUST have 7 tabs

```
1. Hotel (5-step wizard: Propietario, Alojamiento, Características, Localización, Descripción)
2. Tarifas (matriz ocupación × temporada)
3. Condiciones (políticas, depósitos, impuestos, cuentas bancarias)
4. Impuestos (nombre, tasa, vista previa factura)
5. Integraciones (TTLock, Stripe, WhatsApp, Channel Manager)
6. Usuarios (gestión usuarios del hotel)
7. Envíos Automáticos (link al editor de auto-messages)
```

### REQ-2: Tab Hotel — Wizard de 5 pasos

#### Paso 1: Propietario
| Field | Type | Validation |
|-------|------|------------|
| Nombre del propietario | text | required, min 3 chars |
| CIF/NIF/NIE | text | required |
| Email | email | required, valid email |
| Teléfono | tel | required |
| Email validación dispositivos | email | optional |

#### Paso 2: Alojamiento
| Field | Type | Options |
|-------|------|---------|
| Nombre del alojamiento | text | current hotel.name |
| Tipo de alojamiento | select | 54 options (see catalog below) |
| Email público | email | — |
| N. Registro | text | legal registration |
| Web | url | hotel website |
| Enlace motor de reservas | url | shareable booking link |
| Teléfono 1 | tel | — |
| Teléfono 2 | tel | optional |
| Teléfono de aviso | tel | for alerts |
| Moneda primaria | select | USD, DOP, EUR, COP, MXN, PEN, CLP, ARS, BRL, CAD, GBP, VEF |
| Moneda secundaria | select | same list (for conversion display) |
| Video YouTube | url | optional |
| Clasificación | select | 1-5 Estrellas, 1-4 Llaves, 1-3 Trisqueles, Camping 1ª-3ª, etc. |
| Reserva Online | select | Activo / Solo disponibilidad / Desactivado |
| Servicios adicionales motor | select | Versión 1 / Versión 2 |
| Diferencia horaria | number | offset from CET |

**Accommodation Type Catalog (54 options):**
Casa Rural, Apartamento Rural, Hotel Rural, Albergue Rural, Monasterio, Castillo, Parador, Apartahotel, Cabaña, Bungalow, Hotel, Posada, Hostal, Fonda, Pensión, Residencia, Motel, Balneario, Camping, Otro, Casas cueva, Hospedería, Cortijo, Apartamento, Complejo Rural, Hotel 1-5 estrellas, Casa Rural con SPA, Hotel con SPA, Hostal 1-2 estrellas, Hotel 5GL, Centro Turismo Rural, Posada Real, Agroturismo, Casa-Chozo, Casa-Apartamento Rural, Alojamiento Vacacional, Casa Rural 1-5 estrellas, Estancias, Lodges, Hosterías, Hotel boutique, Departamentos

#### Paso 3: Características (Amenities) — 100+ checkboxes

**Grouped by 4 categories with sub-groups:**

**INTERIOR — Equipamiento:**
- Aire acondicionado (todas estancias / principales)
- Cocina, horno, microondas, microondas grill, batidora, tostadora
- Lavavajillas, lavadora, secadora
- Sábanas, toallas
- Cafetera, menaje, tetera
- TV propia, teléfono propia, radio
- Hilo musical, equipo música, vídeo/DVD
- Canales TV privados, antena parabólica
- Minibar, caja fuerte
- Calefacción, chimenea propia
- Ducha hidromasaje, ducha sauna
- Bañera hidromasaje, bañera sauna
- Acceso a Internet, WiFi
- Plancha, secador de pelo
- Cuna bebé, trona bebé
- No admite niños

**EXTERIOR — Instalaciones:**
- Piscina, piscina climatizada
- Jardín-terraza
- Zona de juegos niños
- Barbacoa (propia/compartida)
- Leña gratuita / de pago
- Bar Cafetería, Restaurante
- Salón de reuniones
- Garaje gratuito / de pago
- Parking gratuito / de pago
- Gimnasio
- Servicios de SPA
- Servicio de habitaciones
- Servicio de lavandería
- Admite mascotas / perros
- Preparado discapacitados
- Espacio libre de humos
- Alquiler bicicletas
- Se puede pagar con tarjeta
- Q Calidad
- Ecoagroturismo
- Ascensor

**ENTORNO — Ubicación:**
- Situado en la montaña, zona montañosa
- Zona de bellos paisajes
- Zona de baño (río/lago/playa)
- Rutas a caballo, senderismo
- Zona de caza (mayor/menor)
- Zona de pesca
- Zona de escalada
- Observación de aves

**ACTIVIDADES — Ocio:**
- Actividad rural, animales de granja
- Billar, futbolín, juegos de mesa
- Excursión organizada, caminatas
- Coches a pedales
- Campo de fútbol
- Pista de pádel, tenis (cemento/tierra), voley, squash, bádminton, ping-pong
- Canasta baloncesto, minigolf
- Centro interpretación flora/fauna
- Huerta orgánica
- Paseo a caballo, paseo en carruaje
- Polo
- Meditación - Yoga

#### Scenario: Toggle amenity
- **Given** hotel amenities editor is open
- **When** user checks "Piscina"
- **Then** hotel_amenities table MUST have row (hotelId, 'pool', 'exterior', 1)
- **When** user unchecks "Piscina"
- **Then** row MUST set isActive = 0 (soft toggle, not delete)

#### Scenario: Amenities load on page visit
- **Given** hotel has 15 amenities active
- **When** settings page loads
- **Then** those 15 checkboxes MUST be pre-checked
- **And** all others MUST be unchecked

#### Paso 4: Localización
| Field | Type |
|-------|------|
| Latitud | number (read-only, set by map) |
| Longitud | number (read-only, set by map) |
| Mapa interactivo | Leaflet map with draggable pin |
| Dirección | text |
| País | select (preloaded) |
| Provincia/Estado | select (cascading from país) |
| Municipio | select (cascading from provincia) |
| Localidad | text |
| Código postal | text |

#### Scenario: Set location via map
- **Given** map shows current hotel location
- **When** user drags pin to new location
- **Then** latitude + longitude inputs MUST update
- **And** "Situar" button reverse-geocodes to fill address fields

#### Paso 5: Descripción (Multilingüe)
- Textarea for each of 12 languages
- Languages: Español, English, Português, Français, Italiano, Deutsch, Català, Galego, Euskera, Nederlands, Griego, Mexicano
- Stored as JSON: `{ "es": "Somos un apartahotel...", "en": "We are an apart-hotel..." }`

#### Scenario: Save multilingual description
- **Given** user fills Spanish and English descriptions
- **When** save clicked
- **Then** descriptionJson MUST store `{ "es": "...", "en": "..." }`

### REQ-3: Tab Tarifas — Matriz

**Grid layout:**
```
           | Baja  | Media | Alta  | Especial |
-----------|-------|-------|-------|----------|
Simple 1p  | [$45] | [$45] | [$50] | [$50]    |
Simple 2p  | [$45] | [$45] | [$50] | [$50]    |
Doble 1p   | [$55] | [$55] | [$60] | [$65]    |
Doble 2p   | [$55] | [$55] | [$60] | [$65]    |
Suite 1p   | [$65] | [$65] | [$70] | [$75]    |
Suite 2p   | [$65] | [$68] | [$70] | [$75]    |
Suite 4p   | [$65] | [$65] | [$70] | [$70]    |
Familiar 1p| [$65] | [$65] | [$70] | [$75]    |
Familiar 2p| [$65] | [$65] | [$70] | [$70]    |
```

- Rows: roomType × occupancy (1p, 2p, 3p, 4p)
- Columns: 4 seasons (Baja, Media, Alta, Especial)
- All cells editable number inputs
- "Copiar precios al próximo año" button

#### Scenario: Save rate matrix
- **Given** admin edits 24 price cells
- **When** clicks "Guardar precios"
- **Then** all 24 entries MUST be upserted in room_rates table
- **And** toast: "24 tarifas guardadas"

### REQ-4: Tab Condiciones (extend current)

| Field | Type | Options |
|-------|------|---------|
| Hora de entrada | time | default 15:00 |
| Hora de salida | time | default 12:00 |
| Limpieza por defecto | select | Limpieza a la salida / Limpieza diaria |
| Tipo de cancelación | select | Flexible / Moderada / Estricta / No reembolsable / Otras |
| Fianza | select | Ninguna / Fija / Porcentaje |
| Fianza fija | number | if Fija selected |
| Fianza porcentaje | number | if Porcentaje selected |
| Tipo anticipo | select | Porcentaje (%) / Importe fijo ($) |
| Anticipo | number | amount or percentage |
| Release (horas) | number | minimum hours before check-in |
| Forma de pago por defecto | select | 12 options |
| Solicitar valoraciones | checkbox | |
| Publicar nota valoraciones | checkbox | |
| Publicar comentarios | checkbox | |

**Formas de pago:** Transferencia, TPV, Tarjeta en garantía, Efectivo, PayPal, Bizum, Datáfono, Canje, Invitación, Pago en destino, Requerimiento de pago

### REQ-5: Tab Cuentas Bancarias

Multiple bank accounts (add/remove):
| Field | Type |
|-------|------|
| Banco | text (e.g., "Banreservas") |
| Titular | text |
| Número de cuenta | text |
| IBAN | text |
| SWIFT | text |
| Tipo | select (Corriente / Ahorro) |

#### Scenario: Add bank account
- **Given** hotel has 1 bank account
- **When** clicks "+ Agregar Cuenta"
- **Then** new empty form row MUST appear
- **And** on save, stored in Configuration KV as cuentas_bancarias

### REQ-6: Tab Integraciones

Cards for each integration:
- **TTLock** → status badge + Connect button + Client ID/Secret fields
- **Stripe** → status badge + API keys fields
- **WhatsApp Business** → status badge + Phone Number ID + Token
- **Channex** → status badge (already integrated) + Property ID
- **QScanPro** → connection code display
- **Google Maps** → API key field

### REQ-7: Amenities per Room

In the Rooms page, each room MUST have:
- Amenities tab (40+ checkboxes: equipamiento propio)
- Shared amenities tab (20+ checkboxes: equipamiento compartido)
- Fields: superficie (m²), número baños, capacidad máxima
- Toggle: Desactivar venta online
- Toggle: Ignorar en informes

#### Scenario: Set room amenities
- **Given** editing room "101"
- **When** checks "TV propia" and "Aire acondicionado"
- **Then** room_amenities MUST have 2 rows for room "101"
