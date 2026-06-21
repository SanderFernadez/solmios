# Analisis MisterPlan CloudV2 → ManagerHotel

> PMS de referencia: **solmirooms** (Hotel Boutique, Santo Domingo Este, RD)
> Analizado: 20/06/2026

---

## Estructura General de MisterPlan

Menu principal con 10 modulos:

| # | Modulo | Equivalente ManagerHotel |
|---|--------|--------------------------|
| 1 | Configuracion | Settings (FALTAN MUCHOS CAMPOS) |
| 2 | Planning | Planning (CALENDARIO VISUAL) |
| 3 | Precios (obsoleto) | Settings > Rates |
| 4 | Channel Manager V2 | Channel Manager |
| 5 | Informes | Reports (FALTAN REPORTES) |
| 6 | Requerimiento de pago | NO EXISTE |
| 7 | Opiniones | Reviews |
| 8 | Gastos | Gastos |
| 9 | Configuracion Especial | NO EXISTE |
| 10 | Dispositivos | Devices |

---

## 1. CONFIGURACION — 11 sub-secciones

### 1.1 Datos Basicos (5 tabs en wizard)

#### Tab 1: Propietario
| Campo | Tipo | ManagerHotel tiene? |
|-------|------|---------------------|
| Nombre del propietario | text | NO (solo name del hotel) |
| CIF/NIF/NIE | text | NO |
| Email | text | si (email) |
| Telefono | text | si (phone) |
| Email validacion dispositivos | text | NO |

#### Tab 2: Alojamiento
| Campo | Tipo | ManagerHotel tiene? |
|-------|------|---------------------|
| Nombre del alojamiento | text | si (name) |
| Tipo de alojamiento | select (54 opciones) | NO |
| Email | text | si |
| N. Registro | text | NO |
| N. Registro alquiler (Espana) | text | NO |
| Web | text | NO |
| Enlace motor de reservas | text | NO |
| Telefono 1 | text | si |
| Telefono 2 | text | NO |
| Telefono de aviso | text | NO |
| Moneda | select (12 opciones) | si (currency) |
| Moneda secundaria | select | NO |
| Video (youtube) | text | NO |
| Clasificacion | select (estrellas/llaves/trisqueles) | NO |
| Reserva Online | select (Activo/Solo disp/Desactivado) | NO |
| Servicios adicionales motor | select (v1/v2) | NO |
| Diferencia horaria (con CET) | number | si (timezone) |

**Tipos de alojamiento (54 opciones):** Casa Rural, Apartamento Rural, Hotel Rural, Albergue Rural, Monasterio, Castillo, Parador, Apartahotel, Cabana, Bungalow, Hotel, Posada, Hostal, Fonda, Pension, Residencia, Motel, Balneario, Camping, Casas cueva, Hospederia, Cortijo, Apartamento, Complejo Rural, Hotel 1-5 estrellas, Casa Rural con SPA, Hotel con SPA, Hotel boutique, Departamentos, Alojamiento Vacacional, etc.

#### Tab 3: Caracteristicas (Amenities) — 100+ checkboxes
**Equipamiento interior:**
- Aire acondicionado (todas estancias / principales)
- Cocina, horno, microondas, microondas con grill, batidora, tostadora, lavavajillas
- Sabanas, toallas
- Cafetera, menaje, tetera
- TV propia
- Lavanderia

**Instalaciones:**
- Piscina, piscina climatizada
- Jardin-terraza
- Zona de juegos ninos
- Barbacoa
- Lena gratuita/de pago
- Bar Cafeteria, Restaurante
- Salon de reuniones
- Garaje gratuito/de pago
- Parking gratuito/de pago
- Gimnasio
- Servicios de SPA
- Servicio de habitaciones
- Cuna bebe
- Admite mascotas
- Preparado discapacitados
- Espacio libre de humos
- Alquiler bicicletas
- Se puede pagar con tarjeta

**Entorno:**
- Situado en la montana, zona montanosa
- Zona de bellos paisajes, zona de bano
- Rutas a caballo, senderismo
- Zona de caza, pesca, escalada
- Observacion de aves

**Actividades:**
- Actividad rural, animales de granja
- Billar, futbolin, juegos de mesa
- Excursion organizada, caminatas
- Pista de padel, tenis, voley, squash, badminton, ping-pong
- Canasta baloncesto, campo futbol
- Meditacion - Yoga
- Huerta organica

#### Tab 4: Localizacion
| Campo | Tipo | ManagerHotel tiene? |
|-------|------|---------------------|
| Latitud | text | NO |
| Longitud | text | NO |
| Mapa interactivo (Leaflet) | map | NO |
| Direccion | text | si (address) |
| Pais | select | si (country) |
| Provincia | select | NO |
| Municipio | select | NO |
| Localidad | text | NO |
| Codigo postal | text | NO |
| Descripcion localizacion | textarea (multilingue 12 idiomas) | NO |

#### Tab 5: Comentario sobre el alojamiento
- Textarea multilingue (12 idiomas)
- Texto descriptivo que aparece en el motor de reservas

---

### 1.2 Elementos (Habitaciones/Tipos)

Sistema de **grupos de elementos** con **elementos individuales** dentro.

**Tipos de agrupacion:** Habitaciones, Apartamentos, Apartahoteles, Casas, Bungalows, Cabanas, Plazas, Cuevas, Parcela, Estudios

**Campos por grupo:**
| Campo | Tipo | ManagerHotel tiene? |
|-------|------|---------------------|
| Tipo de agrupacion | select | NO (solo type) |
| Nombre de la habitacion | text | si |
| Descripcion (multilingue) | textarea | NO |
| Superficie (m2) | number | NO |
| Numero de banos | number | NO |
| Capacidad maxima | number | si (capacity) |
| Posicion en motor | select | NO |
| Desactivar venta online | checkbox | NO |
| Ignorar en informes | checkbox | NO |

**Equipamiento del elemento (40+ checkboxes):**
- Garaje, parking, gimnasio, salon reuniones
- Habitacion con salon-suite
- Equipado discapacitados, caja fuerte
- Lena, cuna bebe, admite perro
- Chimenea propia, Q calidad
- Espacio libre de humos
- Acceso a Internet
- Lavadora, horno, microondas, batidora, lavavajillas
- Sabanas, toallas
- Barbacoa propia, bano propio
- Calefaccion, aire acondicionado
- TV propia, telefono propia, radio
- Piscina propia/climatizada
- Jardin-terraza, cocina propia
- Minibar
- Ducha/banera hidromasaje/sauna
- Antena parabolica

**Equipamiento compartido (20+ checkboxes):**
- Lavadora, internet, bano compartido
- Chimenea, TV, piscina compartida
- Cuna bebe, parking, garaje
- Barbacoa, sauna, jacuzzi compartido
- Ascensor, cocina, jardin-terraza compartido

**Elementos reales de solmirooms:**
- Habitacion Standar: 8 elementos (unidades 101-108), $45-50/noche
- Habitacion Familiar: 1 elemento (208), $65-75/noche
- Habitacion Premium: 5 elementos (104-108), $55-65/noche

---

### 1.3 Condiciones (3 tabs)

#### Tab 1: Condiciones de Reserva
| Campo | Tipo | ManagerHotel tiene? |
|-------|------|---------------------|
| Condiciones de reserva (multilingue) | textarea | NO (solo cancellationType) |
| Hora de entrada | time | si (checkIn) |
| Hora de salida | time | si (checkOut) |
| Limpieza por defecto | select (salida/diaria) | NO |
| Tipo de cancelacion | select (4 opciones) | si (cancellationType) |
| Fianza | select (Ninguna/Fija/Porcentaje) | PARCIAL (depositRequired) |
| Fianza fija | number | PARCIAL |
| Fianza porcentaje | number | si (depositPercent) |
| Tipo anticipo | select (Porcentaje/Fijo) | NO |
| Anticipo | number | NO |
| Release (horas) | number | NO |
| Sucursal banco | text | NO (bankAccounts) |
| Numero cuenta | text | si (bankAccounts) |
| IBAN | text | NO |
| SWIFT | text | NO |
| Forma de pago por defecto | select (12 opciones) | NO |
| Solicitar valoraciones | checkbox | NO |
| Publicar valoracion general | checkbox | NO |
| Publicar comentarios | checkbox | NO |
| Nombre impuestos | text | si (taxes) |
| Valor impuestos | number | si (taxes) |
| Condiciones tarjeta garantia | textarea (multilingue) | NO |

**Formas de pago:** Transferencia, TPV, Tarjeta en garantia, Efectivo, PayPal, Bizum, Datafono, Canje, Invitacion, Pago en destino, Requerimiento de pago

#### Tab 2: Condiciones No Reembolsable
- Mismos campos pero para tarifa no reembolsable

#### Tab 3: Bloqueos automaticos
- Configuracion de bloqueos automaticos por temporada/eventos

---

### 1.4 Precios

**Sistema de tarifas por temporada (4 niveles):**

| Tipo | Baja | Media | Alta | Especial |
|------|------|------|------|----------|
| Standar (1 pers) | $45 | $45 | $50 | $50 |
| Standar (2 pers) | $45 | $45 | $50 | $50 |
| Familiar (1 pers) | $65 | $65 | $70 | $75 |
| Familiar (2 pers) | $65 | $65 | $70 | $70 |
| Premium (1 pers) | $55 | $55 | $60 | $65 |
| Premium (2 pers) | $55 | $55 | $60 | $65 |

**Caracteristicas:**
- Precio por ocupacion (1 persona, 2 personas, etc.)
- 4 temporadas: Baja, Media, Alta, Especial
- Copiar precios al proximo ano
- Tarifa (default/custom), Estancia (min/max nights), Timming (release)

---

### 1.5 Dias Minimos - Temporadas
- Configuracion de noches minimas por temporada
- Definicion de fechas de temporadas (Baja/Media/Alta/Especial)

### 1.6 Ofertas
- Creacion de ofertas especiales
- Descuentos por rango de fechas

### 1.7 Servicios
- Servicios extra agregables a reservas
- Precios de servicios

### 1.8 Envios Automaticos
- Emails automaticos pre/post estancia
- Configuracion de plantillas

### 1.9 Opciones de Configuracion
- Configuraciones avanzadas del sistema

### 1.10 Protocolo Covid 19
- Medidas sanitarias (obsoleto)

---

## 2. PLANNING

**Calendario visual tipo Google Calendar con:**
- Vista mensual con columnas por habitacion
- Reservas mostradas como bloques coloreados
- Arrastrar y soltar para crear/mover reservas
- Bloqueos de habitaciones (mantenimiento, etc.)
- Localizador de reserva visible (ej: 3636-7174195)
- Nombre del huesped en cada bloque
- Color coding por estado/origen

**Datos visibles por reserva:**
- Nombre del huesped
- Numero de localizador
- Fechas check-in/check-out
- Habitacion asignada

---

## 3. INFORMES (REPORTS)

### 3.1 Filtros
- Seleccion de mes (historico 2 anos)
- Rango de fechas personalizado

### 3.2 Reportes disponibles

#### Tab 1: Facturacion
- Ingresos por tipo de habitacion
- Desglose de servicios extras
- Impuestos

#### Tab 2: Ocupacion
| Metrica | Descripcion |
|---------|-------------|
| Ocupacion total | % calculado sobre habitaciones totales |
| Ocupacion real | % excluyendo bloqueos |
| Ocupacion diaria | % por dia del mes |
| Habitaciones libres vs ocupadas | Conteo diario |

#### Tab 3: Reservas por fecha de disfrute
- Pernoctaciones (personas que durmieron cada noche)
- Pernoctaciones por dia
- Rendimiento de reservas y estancias medias
  - ADR por tipo
  - Estancia media por tipo
  - Revenue por tipo

#### Procedencia de clientes
- Por pais
- Por provincia/region

---

## 4. GASTOS
- Registro de gastos del hotel
- Categorizacion
- Fechas y proveedores

---

## 5. DISPOSITIVOS
- Gestión de dispositivos (tablets, kiosks)
- Validacion por email
- Codigos de activacion

---

## 6. CHANNEL MANAGER V2
- Sincronizacion con OTAs
- Booking.com, Airbnb, Expedia, etc.
- Mapeo de habitaciones
- Gestion de tarifas y disponibilidad

---

## 7. REQUERIMIENTO DE PAGO
- Envio de links de pago
- Seguimiento de estado
- Integracion con pasarela

---

## 8. OPINIONES
- Recoleccion de reviews post-estancia
- Publicacion en motor de reservas
- Gestión de comentarios

---

## GAPS CRITICOS — Lo que ManagerHotel NECESITA

### PRIORIDAD ALTA (Blockers para produccion)

1. **Tipo de alojamiento** — Falta el select con 54 opciones
2. **Amenities/Caracteristicas** — No hay sistema de checkboxes (100+ amenities)
3. **Moneda secundaria** — Falta
4. **Mapa interactivo** — No hay mapa con lat/lng
5. **Descripcion multilingue** — No hay soporte multi-idioma
6. **Precios por ocupacion** — Las tarifas son por tipo, no por # personas
7. **4 niveles de temporada** — Solo hay una temporada, no Baja/Media/Alta/Especial
8. **Release (horas)** — No existe
9. **Limpieza por defecto** — No existe (salida/diaria)
10. **Fianza configurable** — Solo boolean, falta select (Ninguna/Fija/Porcentaje)
11. **Forma de pago por defecto** — No existe
12. **Solicitar/Publicar valoraciones** — No existe
13. **IBAN/SWIFT** — Faltan en cuentas bancarias

### PRIORIDAD MEDIA

14. **Planning visual tipo calendario** — El planning actual es tabla, no drag-drop
15. **Equipamiento por habitacion** — Cada habitacion necesita sus amenities
16. **Equipamiento compartido** — Amenities del edificio compartidos
17. **Procedencia de clientes** — Reporte por pais/region
18. **Pernoctaciones** — Reporte de personas que durmieron
19. **Ocupacion diaria** — Tabla dia por dia
20. **Copiar precios al proximo ano** — Utility
21. **Posicion en motor** — Orden de habitaciones en booking widget
22. **Desactivar venta online** — Toggle por habitacion
23. **Ignorar en informes** — Toggle por habitacion

### PRIORIDAD BAJA

24. **Telefono 2 / Telefono aviso** — Campos extra
25. **Video youtube** — Embed
26. **N. Registro** — Legal
27. **Diferencia horaria explicita** — Ya tenemos timezone
28. **Email validacion dispositivos** — Para kiosks
29. **Protocolo Covid** — Obsoleto

---

## MODELO DE DATOS SUGERIDO

### Hotels table — CAMPOS NUEVOS
```sql
-- Tab 1: Propietario
ownerName TEXT
ownerTaxId TEXT          -- CIF/NIF/NIE
deviceEmail TEXT

-- Tab 2: Alojamiento
accommodationType TEXT   -- enum 54 opciones
registrationNumber TEXT
rentalRegNumber TEXT
website TEXT
bookingEngineUrl TEXT
phone2 TEXT
warningPhone TEXT
secondaryCurrency TEXT
youtubeUrl TEXT
starRating TEXT          -- clasificacion
onlineBookingStatus TEXT -- activo/solo_disp/desactivado
motorVersion TEXT        -- v1/v2

-- Tab 4: Localizacion
latitude REAL
longitude REAL
province TEXT
municipality TEXT
locality TEXT
postalCode TEXT

-- Tab 5: Comentario
descriptionJson TEXT     -- multilingue JSON {es: "...", en: "..."}

-- Condiciones adicionales
cleaningType TEXT        -- salida/diaria
depositType TEXT         -- ninguna/fija/porcentaje
depositFixed REAL
advanceType TEXT         -- porcentaje/fijo
advanceAmount REAL
releaseHours INTEGER
defaultPaymentMethod TEXT
requestReviews INTEGER   -- boolean
publishReviewScore INTEGER
publishReviewComments INTEGER
taxName TEXT             -- "ITBIS"
taxRate REAL             -- 18.00
```

### Nueva tabla: HotelAmenities
```sql
CREATE TABLE hotel_amenities (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  amenityKey TEXT NOT NULL,     -- 'pool', 'ac', 'kitchen', etc.
  amenityCategory TEXT,         -- 'interior', 'exterior', 'environment', 'activities'
  isActive INTEGER DEFAULT 1,
  UNIQUE(hotelId, amenityKey)
);
```

### Nueva tabla: RoomAmenities
```sql
CREATE TABLE room_amenities (
  id TEXT PRIMARY KEY,
  roomId TEXT NOT NULL,
  amenityKey TEXT NOT NULL,
  isShared INTEGER DEFAULT 0,   -- propio vs compartido
  isActive INTEGER DEFAULT 1,
  UNIQUE(roomId, amenityKey)
);
```

### Rooms table — CAMPOS NUEVOS
```sql
surfaceArea REAL          -- m2
bathrooms INTEGER
motorPosition INTEGER
onlineBookingEnabled INTEGER DEFAULT 1
excludeFromReports INTEGER DEFAULT 0
descriptionJson TEXT      -- multilingue
```

### Nueva tabla: RoomRates (precios por ocupacion + temporada)
```sql
CREATE TABLE room_rates (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  roomType TEXT NOT NULL,
  occupancy INTEGER NOT NULL,    -- 1, 2, 3, 4 personas
  season TEXT NOT NULL,          -- baja/media/alta/especial
  price REAL NOT NULL,
  UNIQUE(hotelId, roomType, occupancy, season)
);
```

### Nueva tabla: Seasons
```sql
CREATE TABLE seasons (
  id TEXT PRIMARY KEY,
  hotelId TEXT NOT NULL,
  name TEXT NOT NULL,           -- 'baja', 'media', 'alta', 'especial'
  label TEXT,                   -- 'Temporada Baja'
  startDate TEXT,
  endDate TEXT,
  color TEXT,
  UNIQUE(hotelId, name)
);
```

---

## AMENITIES CATALOGO COMPLETO

### Interior (Equipamiento)
```
ac_all, ac_main, kitchen, oven, microwave, microwave_grill, blender,
toaster, dishwasher, sheets, towels, coffee_maker, kitchenware, kettle,
tv_own, washer, dryer, iron, hair_dryer, safe, minibar, phone_own,
radio, music_system, video_dvd, private_channels, internet_access,
heating, fireplace_own, bathtub, jacuzzi_own, sauna_own, shower_massage,
satellite_dish, baby_crib, baby_highchair
```

### Exterior (Instalaciones)
```
pool, pool_heated, garden_terrace, playground, bbq, firewood_free,
firewood_paid, bar_cafe, restaurant, meeting_room, garage_free,
garage_paid, parking_free, parking_paid, tennis_court, padel_court,
squash_court, badminton, ping_pong, basketball, minigolf, gym,
spa_services, room_service, laundry_service, pets_allowed,
wheelchair_accessible, smoke_free, bicycle_rental, card_payment,
quality_q, eco_agrotourism, no_children
```

### Entorno (Environment)
```
mountain_location, mountain_area, beautiful_landscapes, bathing_area,
horse_routes, hiking, hunting_area, fishing_area, climbing_area,
bird_watching
```

### Actividades (Activities)
```
rural_activity, farm_animals, bird_watching_activity, bicycles,
billiards, organized_excursion, walks, pedal_cars, football_field,
padel_court_activity, volleyball_court, tennis_hard, tennis_clay,
flora_fauna_center, organic_garden, board_games, children_playground,
table_football, horseback_riding, carriage_ride, fishing_activity,
polo, big_game_hunting, small_game_hunting, frog_game, meditation_yoga
```

---

---

## 9. PLANNING — Detalle Completo

### Vista del Calendario
- **Formato**: Calendario mensual con columnas por habitacion
- **Reservas**: Bloques coloreados arrastrables
- **Bloqueos**: Habitaciones bloqueadas por mantenimiento u otros motivos
- **Informacion visible por reserva**: Nombre del huesped + Localizador (ej: "2p Robinson, Loc: 3636-7174195")
- **Iconos por reserva**: Cerradura electronica, editar, etc.

### Click derecho en reserva → Menu contextual:
- **Abrir Reserva** → Modal completo

### Click en celda vacia → Crear nueva reserva

### BLOQUEOS de habitaciones
- Click derecho → Crear BLOQUEO
- Datos del bloqueo: Fecha creacion, rango de fechas, motivo
- Los bloqueos aparecen en gris en el planning
- Ejemplos vistos: "BLOQUEO Creado el 2026-06-11 21:38:43", "BLOQUEO Creado el 2026-06-14 14:45:28"

---

## 10. MODAL DE RESERVA — Detalle Completo

### Header
- Numero de reserva: "Reserva 3636-7174195"
- Botones: Imprimir, Editar, Close

### Barra de acciones
- **Confirmacion** (link con icono)
- **Anular reserva** (boton)
- Iconos:Editar cliente, Ver acompanantes, etc.

### Panel Izquierdo

#### Datos de la reserva
| Campo | Valor de ejemplo |
|-------|-----------------|
| Reserva desde | Expedia (QuickConnect) |
| Comision | Indicar Comision |
| Id reserva | 3636-7174195 |
| Localizador externo | 2432635760 |
| Fecha Reserva | 07/04/2026 12:40:43 |
| Entrada - Salida | 24/06/2026 - 30/06/2026 (6 n.) |
| Comentario de la reserva | Texto del canal OTA |

#### Condiciones de reserva (colapsable)
- Proteccion de datos (checkbox)
- Deseo recibir informacion adicional (checkbox)
- Normas de Uso y Seguridad (checkbox)

#### Comunicaciones (colapsable)
- **Bono del alojamiento** (link)
- **Bono para el Cliente** (link)
- **Autocheckin** (link)

#### Comunicacion con el cliente (colapsable)
- "Los envios de esta reserva se enviaran automaticamente"
- **Codigos de Acceso - Solmirooms** [Excluido]
- TEST

#### Plantillas de Whatsapp Web (colapsable)
- **codigos acceso** (plantilla con iconos de editar/ver)

### Panel Derecho

#### Datos del cliente
| Campo | Valor de ejemplo |
|-------|-----------------|
| Nombre | Robinson Ramos Abreu |
| Email | j3d1owhjc1@m.expediapartnercentral.com |
| Telefono | +11111111111 |
| WhatsApp | Link directo a wa.me/ |

#### Importe y pago
| Campo | Valor de ejemplo |
|-------|-----------------|
| Caja | Ver movimientos |
| Forma de pago | transferencia |
| Importe de la reserva | USD $ 409,98 |
| Anticipo | USD $ 0,00 |
| Otros cobros | (editable) |
| Pendiente de cobro | USD $ 409,98 |
| Conversion RD$ | 24.031,37 RD$ |
| Requerimiento de pago | Boton Enviar |

#### Elementos de la reserva
| Campo | Valor de ejemplo |
|-------|-----------------|
| Habitacion | 208 Hab Familiar (24/06/2026) |
| Configuracion | SA (servicio alojamiento) |
| Detalle | 2 pax, 4P Estandar, 6 noches x USD $68.33 |

#### Otros servicios y descuentos (colapsable)

#### Acompanantes
- Lista de acompanantes con nombre, documento, etc.
- ROBINSON RAMOS ABREU *

#### QScanPro
- **Codigo de conexion QScanPro**: 106EfB-695
- Texto: "Use este codigo para conectar QScanPro con MisterPlan"

---

## 11. CERRADURAS ELECTRONICAS (TTLock) — Modulo Completo

### Ubicacion en el sistema
1. **Boton en menu superior**: `TCD_Cerraduras` con icono SVG de cerradura
2. **Iconos en Planning**: `cerraduraPlanningIcon` - uno por cada reserva (icono de cerradura)
3. **En modal de reserva**: Icono "Cerradura electronica / Codigo remoto"
4. **En Envios Automaticos**: Variable "Codigos de cerradura y acceso"

### Funcionalidades
- **Codigos de acceso remotos**: Generar codigos temporales para cada reserva
- **Envio automatico**: Los codigos se envian al huesped el dia del check-in
- **Estados**: `sinCodigo` (reserva sin codigo asignado), con codigo asignado
- **Integracion**: Sistema de cerraduras electronicas (TTLock o similar)

### Flujo de trabajo
1. Reserva entra al planning
2. Se asigna habitacion
3. Se genera codigo de cerradura electronico (o se asigna manualmente)
4. El dia del check-in, el envio automatico "Codigos de Acceso" envia:
   - Email con: Logo, localizador, datos de reserva, **codigos de cerradura**
   - WhatsApp con: texto de codigos de acceso
5. El huesped usa el codigo en el teclado de la puerta

### Variables disponibles en el envio automatico de codigos
| Variable | Descripcion |
|----------|-------------|
| Logo | Logo del alojamiento o empresa |
| Localizador de la reserva | Identificador en el sistema |
| Imagen | Imagen del elemento/habitacion |
| Datos de la reserva | Toda la informacion de la reserva |
| **Codigos de cerradura y acceso** | Informacion del acceso y codigos de cerraduras |
| Titulo | Titulo del mensaje |
| Texto informativo | Texto descriptivo |

### Configuracion del envio automatico de codigos
| Campo | Valor actual solmirooms |
|-------|------------------------|
| Titulo | Codigos de Acceso - Solmirooms |
| Color | #eb8714 (naranja) |
| Asunto del correo | "Bienvenidos, Codigos de Acceso - Solmirooms" |
| Texto WhatsApp | "Codigos de acceso - Solmirooms" |
| Momento de envio | El dia de la entrada |
| Botones | Guardar, Guardar y ver ejemplo, Ver o enviar ejemplo, Eliminar |

### Iconos del sistema
- `codigo_cerradura.svg` - Icono de codigo de cerradura
- `llave.svg` - Icono de llave
- `mrplan-icon-cerradura` - Clase CSS del icono

---

## 12. SERVICIOS — Detalle Completo

### Tab 1: Servicios del motor
- Servicios que aparecen en el motor de reservas al finalizar
- Boton: "Anadir servicios"
- Ejemplo: "Medio dia adicional"
- Cada servicio tiene: nombre, descripcion, precio

### Tab 2: Servicios del cloud
- Servicios internos (no visibles en motor)
- Se asignan a reservas ya realizadas desde la intranet
- Boton: "Anadir servicios"
- Boton: Guardar

### Tab 3: Lista de productos
- Catalogo de productos
- Boton: "Anadir lista"
- Agrupacion de productos por categorias

---

## 13. ENVIOS AUTOMATICOS — Detalle Completo

### Seccion 1: Envios Automaticos (basicos)
- "Nuevo mensaje automatico"
- Ejemplo: TEST
- Configuracion simple de mensajes

### Seccion 2: Envios automaticos profesionales
- "Configura nuevo envio automatico"
- **Codigos de Acceso - Solmirooms** - el dia de la entrada
- "Nueva notificacion"
- Cada envio tiene:
  - Titulo
  - Color personalizable
  - Asunto del correo (multilingue)
  - Texto para WhatsApp (multilingue)
  - Variables dinamicas (Logo, Localizador, Imagen, Datos reserva, Codigos cerradura)
  - Botones: Guardar, Guardar y ver ejemplo, Ver o enviar ejemplo, Eliminar

### Seccion 3: Plantillas de WhatsApp Web
- "Nuevo envio al WhatsApp"
- Ejemplo: "codigos acceso"
- Plantillas predefinidas para envio por WhatsApp Web

### Seccion 4: Logs
- Historial de envios realizados
- Boton: "Logs"

---

## 14. OPCIONES DE CONFIGURACION — Detalle Completo

### Tab 1: Pre Checkin
- **Escaneo de documentos en el pre-checkin** (checkbox activado)
- **AutoCheckin**: Link con QR code para check-in autonomo
  - URL: AutoCheckin.php con hash de seguridad

### Tab 2: Vista Semanal del planning
- Configuracion de visualizacion semanal

### Tab 3: Visualizacion
- Opciones de visualizacion del sistema

### Tab 4: Analytics
- Configuracion de Google Analytics o similar

### Tab 5: Textos Alojamiento
- Textos personalizables del alojamiento (multilingue)

---

## 15. QSCANPRO — Escaneo de Documentos

### Que es
Sistema externo para escaneo de documentos de identidad en el check-in.

### Integracion con MisterPlan
- Cada alojamiento tiene un **codigo de conexion** unico
- Codigo de solmirooms: `106EfB-695`
- URL: qscanpro.com
- Texto: "Use este codigo para conectar QScanPro con MisterPlan"

### Funcionalidad
- Escaneo de pasaportes/cedulas en check-in
- Extraccion automatica de datos del documento
- Validacion de identidad
- Integracion con el pre-checkin online

---

## 16. CONFIGURACION ESPECIAL — Detalle Completo

### Sub-secciones
1. **RLOD** - Registro de Lugares de Ocupacion (legal espanol)
2. **Analitica Web** - Configuracion de Google Analytics
3. **Textos Alojamientos** - Textos multilingues personalizables
4. **Imagenes Alojamientos** - Gestion de galeria de imagenes

---

## 17. DISPOSITIVOS — Detalle Completo

### Funcionalidad
Gestion de dispositivos (navegadores/computadoras) con acceso al Cloud.

### Datos por dispositivo
| Campo | Descripcion |
|-------|-------------|
| Usuario | Nombre del usuario |
| Navegador | Google Chrome, etc. |
| Version | 147.0.0.0 |
| Sistema Operativo | X11;Linux, Windows NT 10.0 |
| Direccion IP | 74.244.193.99 |
| Ubicacion | Dominican Republic, Santo Domingo |
| Movil | Si/No |
| Fecha alta | 06:07 19/06/2026 |
| Fecha validacion | 06:23 19/06/2026 |
| Ultimo acceso | 07:00 20/06/2026 |
| Eliminar | Boton para revocar acceso |

### Flujo de validacion
1. Nuevo dispositivo accede al login
2. Se recibe email de validacion
3. Se valida o rechaza el dispositivo
4. Solo dispositivos validados pueden acceder

---

## 18. REQUERIMIENTO DE PAGO

### Funcionalidad
- Envio de links de pago a huespedes
- Boton "Enviar" directamente desde el modal de reserva
- Integracion con pasarela de pago
- Seguimiento del estado del pago

---

## GAPS CRITICOS ACTUALIZADO — Todo lo que ManagerHotel NECESITA

### CERRADURAS TTLock (PRIORIDAD CRITICA)
1. **Modulo de cerraduras electronicas** completo:
   - Generacion de codigos temporales por reserva
   - Asignacion de codigo a habitacion
   - Estado: sinCodigo / conCodigo
   - Icono de cerradura en planning por reserva
   - Envio automatico de codigo al huesped el dia del check-in
   - Integracion con API TTLock
   - Panel de gestion de cerraduras

### PLANNING (PRIORIDAD CRITICA)
2. **Calendario visual drag-and-drop**:
   - Vista mensual con columnas por habitacion
   - Arrastrar para crear reserva
   - Arrastrar para mover reserva
   - Click derecho para menu contextual
   - Bloqueos de habitaciones
   - Iconos por reserva (cerradura, estado)
   - Informacion: nombre huesped + localizador + nro personas

### MODAL DE RESERVA (PRIORIDAD CRITICA)
3. **Modal completo de reserva** con TODOS estos datos:
   - Origen (OTA/Channel Manager/directo)
   - Comision del canal
   - Localizador interno + externo
   - Fecha de creacion
   - Entrada/Salida con noches calculadas
   - Comentarios del canal OTA
   - Condiciones: Proteccion datos, Normas uso
   - Comunicaciones: Bono alojamiento, Bono cliente, Autocheckin
   - Comunicacion cliente: Envios automaticos on/off
   - Plantillas WhatsApp Web
   - Datos cliente: Nombre, email, telefono, WhatsApp link
   - Caja/Movimientos
   - Forma de pago
   - Importe, Anticipo, Pendiente, Conversion moneda secundaria
   - Requerimiento de pago (boton enviar)
   - Elementos: habitacion, configuracion, detalle precio
   - Acompanantes: lista con documentos
   - QScanPro: codigo de conexion

### CONFIGURACION (PRIORIDAD ALTA)
4. Todas las configuraciones de Datos Basicos (ver seccion 1.1)
5. Sistema de Amenities (100+ checkboxes) por hotel y por habitacion
6. Tarifas por ocupacion + 4 temporadas
7. Campos legales/fiscales (CIF, IBAN, SWIFT)
8. Mapa interactivo con lat/lng
9. Multilingue (12 idiomas)

### AUTOMATIZACION (PRIORIDAD ALTA)
10. **Envios automaticos profesionales**:
    - Editor visual de mensajes
    - Variables dinamicas (logo, localizador, codigos cerradura, datos reserva)
    - Programacion (el dia de la entrada, X dias antes, etc.)
    - Multicanal: Email + WhatsApp Web
    - Color personalizable
    - Vista previa
11. **Plantillas WhatsApp Web** predefinidas
12. **Autocheckin** con QR
13. **Pre-checkin** con escaneo de documentos
14. **QScanPro** o similar para escaneo de IDs

### REPORTES (PRIORIDAD ALTA)
15. Reporte de **Facturacion** detallado
16. Reporte de **Ocupacion** (total, real, diaria)
17. Reporte de **Pernoctaciones** (por dia)
18. Reporte de **Rendimiento** (ADR, RevPAR, estancia media por tipo)
19. Reporte de **Procedencia** (pais, region)

### SERVICIOS (PRIORIDAD MEDIA)
20. Servicios del motor (add-ons al reservar)
21. Servicios del cloud (add-ons post-reserva)
22. Lista de productos con categorias

---

## CONCLUSION FINAL

ManagerHotel necesita replicar **EXACTAMENTE** toda esta funcionalidad. Los modulos mas criticos que faltan:

1. **Cerraduras TTLock** - Modulo completo de gestion de codigos
2. **Planning visual** - Calendario drag-and-drop con bloqueos
3. **Modal de reserva completo** - Con TODOS los campos y secciones
4. **Envios automaticos** - Editor visual multicanal con variables
5. **Amenities** - 100+ checkboxes por hotel y habitacion
6. **Tarifas** - Matriz ocupacion x temporada (4 niveles)
7. **Autocheckin/Pre-checkin** - Con QR y escaneo de documentos
8. **WhatsApp Web** - Plantillas y envio directo
9. **QScanPro** - Escaneo de documentos de identidad

La ventaja de ManagerHotel: **UI moderna Vue 3 + Tailwind** vs jQuery antiguo. Misma profundidad funcional, mejor experiencia de usuario.
