# Tasks: seguridad-multitenant

> Estimación con IA (÷~1.5 en seguridad: la IA acelera el patrón pero cada fix requiere
> test de tenancy y regresión de super_admin verificados a mano).

## SEC-1 — Fix patrón hotelOf (IDOR lectura/escritura) — V1, V3, V5
- [ ] SEC-1.1 `ttlock/controller.ts:hotelOf` → token primero, ignorar/validar query.hotelId — 3h
- [ ] SEC-1.2 `pricing/controller.ts:hotelOf` → mismo fix — 2h
- [ ] SEC-1.3 `amenities/controller.ts:hotelOf` → mismo fix — 2h
- [ ] SEC-1.4 Barrido: grep de `if (q.hotelId) return q.hotelId` en todos los controllers — 2h

**Subtotal: 9h manual → 6h IA**

## SEC-2 — Ownership real por ID (IDOR crítico) — V2, V4
- [ ] SEC-2.1 `ttlock` code-gen: assertOwnership contra hotel del token, no el tainted (V2 CRÍTICO) — 4h
- [ ] SEC-2.2 `pricing deleteBlock`: recibir hotelId del token + verificar block.hotelId — 3h

**Subtotal: 7h manual → 5h IA**

## SEC-3 — Endpoint público de usuarios — V6
- [ ] SEC-3.1 `admin/index.ts:51` GET /api/public/users → auth+requireUserType o remover — 2h

**Subtotal: 2h manual → 1.5h IA**

## SEC-4 — Rate limit hardening — V7, V8
- [ ] SEC-4.1 Proxy confiable para XFF (no bucket nuevo por header rotado) — 4h
- [ ] SEC-4.2 Rate limiter global keyBy=getClientIp — 2h

**Subtotal: 6h manual → 4h IA**

## SEC-5 — Tests de tenancy
- [ ] SEC-5.1 Extender route-permissions.test.ts con casos cross-tenant ttlock/pricing/amenities — 6h
- [ ] SEC-5.2 Test regresión super_admin cross-hotel sigue funcionando — 3h
- [ ] SEC-5.3 Test V2: merchant NO genera código de puerta fuera de su hotel — 3h

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
