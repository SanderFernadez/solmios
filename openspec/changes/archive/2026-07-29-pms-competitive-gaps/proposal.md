# Change Proposal: pms-competitive-gaps

## Estado: ✅ CERRADO (2026-07-29)

Gate automático verde desde 2026-06-21 (`arckode analyze` ✅, 131 tests, typecheck/build limpios).
Los 3 checks manuales de la sección "GATE final" de `tasks.md` (reports con datos, switcher de
hotel del super-admin, PWA instalable) quedaron pendientes hasta hoy — verificados en vivo contra
producción con Playwright: reports de Ocupación/Facturación muestran datos reales (no $0) al filtrar
"Este año"; el switcher cambia de hotel end-to-end (`GET /api/auth/hotels` → 5 hoteles →
`POST /api/auth/switch-hotel/:id`); el manifest + service worker cumplen los criterios de
instalabilidad de Chrome. Ver evidencia completa en `tasks.md`.

## Summary

Cerrar los 4 gaps competitivos más críticos detectados vs PMS líderes del mercado (Cloudbeds, LittleHotelier, MisterPlan) que están **100% dentro del alcance** (no requieren creds externas ni decisiones de usuario). Esto lleva a ManagerHotel de "prototype" a "competitive con LittleHotelier/MisterPlan" en su segmento (boutique 5-30 hab LATAM).

## Motivation

La comparación con PMS del mercado reveló que la UX, arquitectura y stack son superiores, pero faltan 4 piezas que cualquier hotelero serio pide antes de comprar:
1. **Reports avanzados** — hoy solo hay 2 básicos. Cualquier PMS serio tiene 6+.
2. **Multi-property UI** — la arquitectura es multi-tenant pero no hay switcher ni reports consolidados. Bloquea venta a cadenas medianas.
3. **Stripe real** — los "links de pago" hoy son stubs. Sin esto el flujo de cobro no funciona end-to-end.
4. **PWA** — sin offline, hoteles con mala conexión pierden check-ins. Móvil web no es instalable.

## Scope

### In Scope (4 sprints, todos ejecutables ahora)

- **PC-1 Reports avanzados** — 6 tipos MisterPlan: Facturación, Ocupación, Pernoctaciones, Rendimiento (ADR/RevPAR), Procedencia, Reservas. Tab + tabla + export CSV cada uno.
- **PC-2 Multi-property UI** — Hotel switcher en header para super_admin y usuarios con varios hoteles. Reports consolidados en super-admin.
- **PC-3 Stripe real** — Webhook + Checkout Session + payment_links conectados. .env.example listo. Funciona cuando se agreguen STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET.
- **PC-4 PWA + offline** — manifest.webmanifest, service worker con cache shell, Add to Home Screen.

### Out of Scope (requieren externo)

- WhatsApp Business API real (requiere verificación Meta, ~1 semana externa)
- TTLock real (requiere clientId/clientSecret del hotel)
- QScanPro (requiere cuenta)
- Mobile app nativa (semanas de trabajo)
- Revenue management / rate shopper (scope mucho mayor)
- Facturación electrónica DGII (depende país)

## Approach

Cada sprint independiente (regla: módulos independientes). Se ejecutan en orden de impacto/effort. Stripe requiere instalar dependencia npm (`stripe`) — único cambio en backend/package.json.

## Dependencies

- Ninguna bloqueante.
- Stripe: para pruebas end-to-end se necesitan creds de prueba (sk_test_*), pero el código queda listo y se activa al agregarlas a `.env`.
