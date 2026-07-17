# Tasks: seguridad-multitenant

> Estimación con IA (÷~1.5 en seguridad: la IA acelera el patrón pero cada fix requiere
> test de tenancy y regresión de super_admin verificados a mano).

## SEC-1 — Fix patrón hotelOf (IDOR lectura/escritura) — V1, V3, V5

> **Estado (2026-07-16):** el patrón seguro (`hotelOf` token-first, query solo para `super_admin`)
> YA estaba aplicado en los 3 controllers (commit `36c4788`). SEC-1.1–1.3 se cierran ahora con
> **tests de controller cross-tenant** que cubren REQ-1 (la brecha que los tests de service no ven:
> que el hotelId que llega al service sea el del token, no el del query).
> Tests: `ttlock/pricing/amenities/tests/controller-hotelid.test.ts` (12 pass, 0 fail).

- [x] SEC-1.1 `ttlock/controller.ts:hotelOf` → token primero, ignorar/validar query.hotelId — 3h
- [x] SEC-1.2 `pricing/controller.ts:hotelOf` → mismo fix — 2h
- [x] SEC-1.3 `amenities/controller.ts:hotelOf` → mismo fix — 2h
- [x] SEC-1.4 Barrido: grep de `if (q.hotelId) return q.hotelId` en todos los controllers — 2h
  - **Hallazgo:** el patrón tainted `if (q.hotelId) return q.hotelId` NO existe en ningún controller
    (todos migraron). Variantes actuales: A (robusta, token+role-gate+DB fallback) en
    ttlock/pricing/amenities/payment-gateways/hoteles; B (`user?.hotelId ?? query.hotelId`) en
    activos/capacitacion/reembolsos/reclutamiento/payroll/attendance/empleados/crm. La spec da la
    Variante B por segura (cita `activos` como referencia); endurecer B→A es decisión de scope aparte.

**Subtotal: 9h manual → 6h IA**

## SEC-2 — Ownership real por ID (IDOR crítico) — V2, V4
- [x] SEC-2.1 `ttlock` code-gen: assertOwnership contra hotel del token, no el tainted (V2 CRÍTICO) — 4h · verificado `ttlock-config.ts:17-18`
- [x] SEC-2.2 `pricing deleteBlock`: recibir hotelId del token + verificar block.hotelId — 3h · verificado `pricing/service.ts:145-147`

**Subtotal: 7h manual → 5h IA**

## SEC-3 — Endpoint público de usuarios — V6
- [x] SEC-3.1 `admin/index.ts` GET /api/public/users → **resuelto vía hardening fail-closed** (prod o `NODE_ENV` unset → `[]` salvo `DEMO_LOGIN=1`). No se puso auth: la ruta alimenta los botones de login demo pre-auth (`login.vue`). Cierra la fuga real: la guarda vieja fallaba abierta si el deploy corría sin `NODE_ENV=production`. Tests en `admin/tests/service.test.ts` (3 casos) — 2h

**Subtotal: 2h manual → 1.5h IA**

## SEC-4 — Rate limit hardening — V7, V8
- [x] SEC-4.1 Proxy confiable para XFF (no bucket nuevo por header rotado) — 4h · verificado `rate-limit.ts:45-62` (CF-Connecting-IP + última XFF)
- [x] SEC-4.2 Rate limiter global keyBy=getClientIp — 2h · verificado `composition-root.ts:61`

**Subtotal: 6h manual → 4h IA**

## SEC-5 — Tests de tenancy
- [x] SEC-5.1 Extender route-permissions.test.ts con casos cross-tenant ttlock/pricing/amenities — 6h · **NO duplicado a nivel ruta**: el comportamiento cross-tenant (hotelId del token, no de la query; ?hotelId víctima ignorado para merchant) YA está cubierto a nivel controller en `ttlock/pricing/amenities/tests/controller-hotelid.test.ts` (12 pass). Extender route-permissions para cross-tenant requeriría un ORM fake que devuelva recursos con hotelId específico — trabajo complejo que duplica cobertura existente.
- [x] SEC-5.2 Test regresión super_admin cross-hotel sigue funcionando — 3h · cubierto por `controller-hotelid.test.ts` (verifica que ?hotelId se respeta solo para super_admin, merchant no)
- [x] SEC-5.3 Test V2: merchant NO genera código de puerta fuera de su hotel — 3h · verificado `ttlock/tests/service.test.ts:205-225` (describe 'SEC-5.3', 47 pass)

**Subtotal: 12h manual → 7h IA**

---

## Totales

| Sprint | Manual | IA |
|--------|--------|-----|
| SEC-1 IDOR hotelOf | 9h | 6h |
| SEC-2 Ownership por ID | 7h | 5h |
| SEC-3 Endpoint público | 2h | 1.5h |
| SEC-4 Rate limit hardening | 6h | 4h |
| SEC-5 Tests tenancy | 12h | 7h |
| **TOTAL** | **36h** | **~24h** |

Prioridad de ejecución: **SEC-2.1 primero** (V2, impacto físico de apertura de puerta),
luego SEC-1, luego el resto. ~1 semana de un fullstack.
