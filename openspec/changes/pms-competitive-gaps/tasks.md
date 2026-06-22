# Tasks: pms-competitive-gaps

> **Reglas**: cada task es independiente. Criterio de aceptación observable. Marcar `[x]` solo tras verificar.

---

## 🟦 PC-1 — Reports avanzados (6 tipos MisterPlan)

### PC-1.1 — Backend: enriquecer `/api/reports`

- [ ] **PC-1.1.1** Extender el handler `/api/reports` existente para aceptar `?type=X&from=YYYY-MM-DD&to=YYYY-MM-DD` y devolver 6 datasets:
  - `facturacion` — ingresos por tipo (hab, extras, impuestos, comisiones OTA)
  - `ocupacion` — total, real (sin bloqueos), diaria (% por día), libres vs ocupadas
  - `pernoctaciones` — personas por noche, total, desglose por día
  - `rendimiento` — ADR por tipo de hab, RevPAR, estancia media, revenue por tipo
  - `procedencia` — por país del huésped, por región
  - `reservas` — por canal (OTA vs directo), por fecha de disfrute, cancelaciones
- [ ] **PC-1.1.2** Endpoint `/api/reports/export?type=X&format=csv` que devuelve CSV stream

**Aceptación**:
```bash
curl -H "Authorization: Bearer <token>" "http://localhost:3001/api/reports?type=rendimiento&from=2026-01-01&to=2026-06-30"
# → 200 JSON con adrByRoomType, revpar, avgStay, revenueByType
```

### PC-1.2 — Frontend: página reports con 6 tabs

- [ ] **PC-1.2.1** Crear `frontend/src/services/Reports.service.ts` (getReport(type, params), exportCsv(type, params))
- [ ] **PC-1.2.2** Refactorizar `pages/reports/index.vue` con 6 tabs: Facturación, Ocupación, Pernoctaciones, Rendimiento, Procedencia, Reservas
- [ ] **PC-1.2.3** Cada tab: selector de rango de fechas (este mes / mes pasado / trimestre / año), tabla con datos, export CSV button
- [ ] **PC-1.2.4** KPIs visuales arriba (4 cards por tab con los números clave)
- [ ] **PC-1.2.5** Gráfico de barras simple (HTML/CSS puro sin lib) para evolución mensual

**Aceptación**:
```bash
# Manual: login hotel_admin → /panel/reports → cambiar entre 6 tabs → cada una muestra datos + exporta CSV
cd frontend && npx vue-tsc -b  # 0 errores
```

---

## 🟦 PC-2 — Multi-property UI

### PC-2.1 — Hotel switcher en header

- [ ] **PC-2.1.1** Backend: `GET /api/auth/hotels` que devuelve los hoteles accesibles para el usuario (super_admin: todos; hotel_admin: solo su hotelId actual; si el usuario tiene `accessibleHotelIds` en DB, esos)
- [ ] **PC-2.1.2** Backend: `POST /api/auth/switch-hotel/:hotelId` — actualiza el `currentHotelId` en el token (solo si el user tiene acceso)
- [ ] **PC-2.1.3** Frontend: `HotelSwitcher.vue` componente dropdown que reemplaza el badge estático en `AdminLayout` (solo se muestra si hay +1 hotel accesible)
- [ ] **PC-2.1.4** Al switchear: refrescar token + recargar data del hotel actual (reservas, rooms, dashboard)

**Aceptación**:
```bash
# Manual: super_admin ve todos los hoteles → click → cambia → dashboard carga data del nuevo hotel
# hotel_admin con 1 hotel: no ve switcher (oculto)
```

### PC-2.2 — Reports consolidados en super-admin

- [ ] **PC-2.2.1** Página `super-admin/consolidated.vue` con KPIs globales: MRR, hoteles activos, ocupación promedio, ADR promedio, reservas totales del mes
- [ ] **PC-2.2.2** Tabla con 1 fila por hotel: nombre, plan, ocupación %, ADR, reservas mes, revenue mes, estado
- [ ] **PC-2.2.3** Top 5 hoteles por revenue, top 5 por ocupación

**Aceptación**:
```bash
# Manual: login super_admin → /admin/consolidated → ver grilla de hoteles con métricas
```

---

## 🟦 PC-3 — Stripe real

### PC-3.1 — Backend Stripe

- [ ] **PC-3.1.1** `cd backend && bun add stripe`
- [ ] **PC-3.1.2** Crear `backend/src/services/stripe-service.ts` (singleton Stripe con STRIPE_SECRET_KEY, helpers para crear checkout session, construir payment link)
- [ ] **PC-3.1.3** `POST /api/payment-requests/:id/create-checkout` — crea Checkout Session en Stripe y actualiza PaymentRequest con `stripeSessionId` + `stripePaymentUrl`
- [ ] **PC-3.1.4** `POST /api/stripe/webhook` (público, sin auth, firma con `STRIPE_WEBHOOK_SECRET`) — maneja `checkout.session.completed`, `payment_intent.payment_failed`. Marca PaymentRequest como `paid` con `paidAt`
- [ ] **PC-3.1.5** `.env.example` con `STRIPE_SECRET_KEY=`, `STRIPE_PUBLISHABLE_KEY=`, `STRIPE_WEBHOOK_SECRET=`, `STRIPE_CURRENCY=usd`
- [ ] **PC-3.1.6** Si STRIPE_SECRET_KEY no está configurada, los endpoints responden 503 con `{ error: "Stripe no configurado" }` (graceful degradation)

**Aceptación**:
```bash
# Sin creds: POST /api/payment-requests/:id/create-checkout → 503 "Stripe no configurado"
# Con creds sk_test_*: crea sesión real y devuelve URL de checkout.stripe.com
```

### PC-3.2 — Frontend Stripe

- [ ] **PC-3.2.1** `Payments.service.createWithStripe(reservationId, amount)` — crea PaymentRequest + Checkout Session, devuelve `stripePaymentUrl`
- [ ] **PC-3.2.2** En `payments/index.vue`: botón "🔗 Crear link Stripe" por fila (si está configurado) abre el link o lo copia
- [ ] **PC-3.2.3** En `reservations/index.vue` modal: botón "Crear link de pago Stripe" si el backend lo soporta

**Aceptación**:
```bash
# Sin creds: botón se oculta o muestra tooltip "Stripe no configurado"
# Con creds: click → crea sesión → redirige o copia URL
```

---

## 🟦 PC-4 — PWA + offline

### PC-4.1 — Manifest + service worker

- [ ] **PC-4.1.1** Crear `frontend/public/manifest.webmanifest` con name, short_name, icons (192/512), theme_color (#0F1E3D navy), background_color, display: standalone
- [ ] **PC-4.1.2** Crear `frontend/public/sw.js` — service worker con cache de app shell (/, /login, /assets/*), fallback offline a index.html
- [ ] **PC-4.1.3** Registrar SW en `frontend/src/main.ts` (`navigator.serviceWorker.register('/sw.js')`)
- [ ] **PC-4.1.4** `<link rel="manifest" href="/manifest.webmanifest">` + `<meta name="theme-color">` en `index.html`
- [ ] **PC-4.1.5** Generar iconos 192/512 desde favicon.svg (puede ser PNG estático en `/public/icons/`)

### PC-4.2 — Offline UX

- [ ] **PC-4.2.1** Detectar offline con `navigator.onLine` + evento `online`/`offline`
- [ ] **PC-4.2.2** Banner "Sin conexión — mostrando datos en caché" cuando offline
- [ ] **PC-4.2.3** Botones de acción crítica (crear reserva, check-in) deshabilitados cuando offline + tooltip explicativo

**Aceptación**:
```bash
# Manual Chrome DevTools → Application → Manifest → "Install" habilitado
# Manual: DevTools → Network → Offline → recargar → muestra banner + shell sigue funcionando
cd frontend && npx vite build  # manifest + sw copiados a dist/
```

---

## 📊 Resumen

| Sprint | Tasks | Effort | Blockers |
|---|---|---|---|
| **PC-1 Reports** | 7 | 3 días | — |
| **PC-2 Multi-property** | 7 | 2 días | — |
| **PC-3 Stripe** | 9 | 1.5 días | Necesita `bun add stripe` |
| **PC-4 PWA** | 8 | 1 día | — |
| **TOTAL** | 31 | ~7.5 días | — |

---

## 🎯 Orden de ejecución

1. **PC-1 Reports** (mayor impacto competitivo, sin deps)
2. **PC-3 Stripe** (necesita `bun add`, puede caer en paralelo)
3. **PC-4 PWA** (más rápido)
4. **PC-2 Multi-property** (arquitectura ya lista, falta UI)

## 🔍 GATE final

- [ ] `arckode analyze` ✅ VÁLIDO
- [ ] backend typecheck 0 errores
- [ ] backend tests 130+ pass
- [ ] frontend `vue-tsc -b` 0 errores
- [ ] frontend `vite build` success
- [ ] Manual: los 6 reports cargan con datos
- [ ] Manual: super-admin puede cambiar de hotel
- [ ] Manual: PWA instalable en Chrome
