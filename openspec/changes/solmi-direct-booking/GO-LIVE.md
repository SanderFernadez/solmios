# GO-LIVE Runbook — `solmi-direct-booking`

> Checklist accionable para activar el motor de reservas directo en un hotel real.
> Es complementario al código (commits `solmi-direct-booking` + hardening go-live) — cubre
> los pasos que **NO son código** y que requieren acceso al panel / DB / dashboard Stripe.

**Stack**: `bookingengine` module · Stripe Checkout Sessions · `PUBLIC_BASE_URL` env ·
`configuration` table por hotel · `hotels.onlineBookingStatus`.

**Flags de feature**:
- `BOOKING_USE_UNIFIED_FLOW=true` (ya en prod) — enruta el widget por `/api/public/booking`
  singular + endpoints `/api/public/reservations/:id?token=X` (HMAC, anti-IDOR).
- `BOOKING_TOKEN_SECRET` — secreto del HMAC del token público. **Setear en prod** (si no,
  hay fallback dev explícito, pero el real es requisito de go-live).

---

## 1. Activar el hotel

El motor solo sirve páginas públicas de hoteles con `onlineBookingStatus='active'`.

**Opción A — SQL directo** (más rápido, un hotel):
```sql
UPDATE hotels SET onlineBookingStatus = 'active' WHERE slug = '<slug>';
```

**Opción B — Panel**:
`Panel → Página pública → General → toggle "Motor de reservas activo"` y guardar.

**Verificación**:
```bash
curl -s https://<public-host>/api/public/hotel/<slug> | jq '.onlineBookingStatus'
# → "active"
```

---

## 2. Stripe — confirmar Checkout Sessions

El motor usa **Stripe Checkout Sessions** (`gw.createCharge` con `successUrl`/`cancelUrl`).
NO usa PaymentIntents sueltos. La cuenta Stripe del hotel debe soportar Checkout.

**Verificar**:
1. Entrar al dashboard Stripe del hotel → **Settings → Payment methods** → confirmar que
   tarjetas están activas.
2. **Settings → Business settings → Orders and payments** → confirmar que NO hay restricciones
   que bloqueen Checkout Sessions (ej: cuenta bloqueada,raudamente limitada).
3. Confirmar que la credencial del hotel está cargada en `payment_gateways` (panel →
   Página pública → Pagos, o `SELECT * FROM payment_gateways WHERE hotelId=<id>`).
4. Smoke test en prod con tarjeta `4242 4242 4242 4242` (runbook paso 4).

**Si el hotel NO tiene Checkout habilitado**:
- Crear la cuenta/configuración en Stripe.
- Actualizar `payment_gateways` con el `stripeAccount`/secret nuevo.
- El backend devuelve `checkoutUrl: null` + `paymentError` si Stripe cae (reserva sigue
  `pending`, NO se pierde) — monitorear logs de `bookingengine.usecases.stripe`.

---

## 3. Creds externos (por hotel o globales)

Estas son las integraciones opcionales que el widget puede usar. Cargar **antes** de abrir
el motor al público si se quieren activas desde el día 1.

### Por hotel (tabla `configuration`, key por integración)
Cargar desde `Panel → Página pública → Reputación / Tracking`:

| key | Para qué |
|-----|----------|
| `google_business_profile` | Reviews GBP (service account JSON) |
| `tripadvisor` | Reviews TripAdvisor (key + location_id) |
| `stayapi` | Comparativo directo vs OTAs (key + hotel_ids[]) |
| `apple_wallet` | Pase Apple Wallet (cert .p8 + passTypeID + teamID) |
| `google_wallet` | Pase Google Wallet (service account + issuerID + classID) |
| `meta_pixel` | Pixel Meta + CAPI (token + test_event_code) |
| `ga4` | GA4 (measurement_id + api_secret) |

### Globales (`.env` del backend)

| Var | Para qué |
|-----|----------|
| `PUBLIC_BASE_URL` | **CRÍTICO go-live** — base del successUrl/cancelUrl que el backend pasa a Stripe. Sin esto, cae al origin del caller (funciona, pero menos robusto). Ej: `https://hotel.zx89.site`. |
| `OPENEXCHANGERATES_APP_ID` | Conversion rates para mostrar precios en la moneda del huésped (geo-IP widget). Sin esto, no hay conversión (se muestra la moneda base del hotel). |
| `BOOKING_TOKEN_SECRET` | **CRÍTICO go-live** — secreto HMAC del token público `?token=X`. Sin esto, hay fallback dev (inseguro para prod). |
| `BOOKING_USE_UNIFIED_FLOW` | Ya `true` en prod — no tocar. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Solo para el módulo legacy global; el bookingengine usa `payment_gateways` por hotel. |

**Verificación**:
```bash
# En el server
grep -E '^(PUBLIC_BASE_URL|BOOKING_TOKEN_SECRET|OPENEXCHANGERATES_APP_ID)=' /www/wwwroot/hotel.zx89.site/solmios/backend/.env
```

---

## 4. QA manual pre-go-live (con tarjeta test)

**Tarjeta test Stripe**: `4242 4242 4242 4242` · cualquier fecha futura · cualquier CVC.

### Flujo e2e (en prod con hotel activo)
1. Abrir `https://<public-host>/h/<slug>` → confirmar landing carga.
2. Seleccionar fechas + habitación + cantidad de huéspedes.
3. Step extras (upsells) — agregar 1-2 (opcional).
4. Step huésped — llenar nombre/email/teléfono válidos.
5. Step pago → redirige a Stripe Checkout.
6. Pagar con `4242 ...` → redirect de vuelta a `/h/<slug>/confirm?booking=<id>&token=<token>`.
7. La página de confirmación debe:
   - Mostrar check-in / check-out / monto correcto.
   - Estado `success` (no `pending` ni `error`).
   - **NO** mostrar `:id` / `:token` literales en la URL ni en el body.
8. En el panel del hotel, abrir la reserva → estado `confirmed`, `depositStatus=paid`,
   `paymentMethod=card`, `pendingAmount=0`.

### Lighthouse (widget mobile)
- Performance ≥ 90
- SEO ≥ 95
- Accessibility ≥ 90

```bash
# Comando rápido
npx lighthouse https://<public-host>/h/<slug> --emulated-form-factor=mobile \
  --only-categories=performance,seo,accessibility --view
```

### Navegación visual
- Landing mobile + desktop.
- Confirm step mobile (post-Stripe redirect).
- Tab `/book/<slug>` (cancelUrl) — debe mostrar cancelación sin romper.

---

## 5. Rollback

Si el primer huésped real trova un bug crítico:

**Rollback suave (sin deploy)**:
```bash
# 1. Desactivar el hotel del motor público
psql -c "UPDATE hotels SET onlineBookingStatus = 'paused' WHERE slug = '<slug>'"
# 2. Confirmar que la landing vuelve a 404
curl -s https://<public-host>/api/public/hotel/<slug>
```
Reservas ya creadas siguen accesibles vía `/api/public/reservations/:id?token=X`.

**Rollback duro (con deploy)**:
```bash
# En el server, revertir commits hardening-go-live + solmi-direct-booking
cd /www/wwwroot/hotel.zx89.site/solmios
git log --oneline | head  # identificar commit anterior a hardening-go-live
git revert <commit>      # o git reset --hard <commit-previo> (más invasivo)
cd backend && bun install && systemctl restart solmios-backend
cd ../frontend && bun --bun vite build
# Setear flag para forzar el flujo plural legacy (deprecated, solo emergencia)
echo "BOOKING_USE_UNIFIED_FLOW=false" >> backend/.env
systemctl restart solmios-backend
```

**Notas**:
- `BOOKING_USE_UNIFIED_FLOW=false` reactiva el flujo plural legacy (`POST /api/public/bookings`)
  que responde 410 en default (true). Solo para emergencia, no dejar en false.
- El endpoint `GET /api/public/bookings/:id` (IDOR viejo) fue **eliminado** en hardening
  go-live — siempre devuelve 410, sin importar el flag. Su reemplazo seguro es
  `GET /api/public/reservations/:id?token=X`.
- Las reservas ya creadas con `accessToken` siguen funcionando con el endpoint seguro.

---

## 6. Sign-off final

Antes de declarar go-live:

- [ ] Hotel con `onlineBookingStatus='active'` (verificado con `curl`).
- [ ] Stripe Checkout del hotel funciona con tarjeta test (paso 4.1-4.7 exitoso).
- [ ] Reserva confirma en panel (estado, depositStatus, paymentMethod).
- [ ] URL de confirmación sin placeholders literales.
- [ ] `PUBLIC_BASE_URL` y `BOOKING_TOKEN_SECRET` seteados en `.env` del backend.
- [ ] Lighthouse ≥ 90/95/90.
- [ ] Creds externos opcionales (tripadvisor, stayapi, meta, ga4) cargados si aplica.

Cualquier ítem en rojo → NO abrir al público hasta resolver.
