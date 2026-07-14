# Change Proposal: seguridad-multitenant

## Summary

Cerrar **5 IDOR cross-tenant reales** (uno con impacto físico: apertura de cerraduras
de otro hotel) y 3 debilidades de hardening detectadas en una auditoría de código con
evidencia `file:line`. La tarea `SC-06 "Revisar OWASP Top 10"` figura **cerrada** en
GitLab, pero la revisión encontró vulnerabilidades **explotables en producción hoy**.
Una tarea de seguridad marcada como hecha sin cerrar sus hallazgos es peor que dejarla
abierta: deja de mirarse.

## Motivation

El sistema es multi-tenant por columna `hotelId`. La autorización tiene dos preguntas:
"¿este **usuario** puede?" (permisos/guards — bien resueltos) y "¿este dato es de **su**
hotel?" (tenancy). La segunda **no se valida** en 3 controllers, porque su helper
`hotelOf()` **confía en `query.hotelId` por encima del token**:

```
if (q.hotelId) return q.hotelId   // ttlock, pricing, amenities
```

El `guard('modulo','action')` verifica el permiso pero **no** que el `hotelId` sea del
usuario. Resultado: cualquier usuario autenticado con permiso en SU hotel pasa
`?hotelId=<víctima>` y opera sobre otro tenant.

## Vulnerabilidades (evidencia file:line)

| # | Sev | file:line | Vulnerabilidad | Impacto |
|---|-----|-----------|----------------|---------|
| V1 | ALTA | `ttlock/controller.ts:14` (+`:25-66`) | IDOR: `query.hotelId` > JWT en getConfig/updateConfig/connect/listLocks/syncLocks | Leer/escribir config TTLock ajena, incl. secretos `accessToken`/`clientId` |
| **V2** | **CRÍTICA** | `ttlock/usecases/ttlock-config.ts:17` + `service.ts:80` | `assertOwnership` compara contra el mismo `hotelId` tainted → check anulado | **Generar PIN de puerta válido para reservas de OTRO hotel → apertura física** |
| V3 | ALTA | `pricing/controller.ts:12` (+`:28-81`) | IDOR: `query.hotelId` > JWT en rates/seasons/blocks/restrictions | Leer/modificar tarifas de otro hotel (sabotaje económico) |
| V4 | ALTA | `pricing/controller.ts:66` → `service.ts:77` | `deleteBlock(id)` sin hotelId ni ownership — IDOR puro por ID | Borrar cualquier rate-block de cualquier hotel enumerando id |
| V5 | MEDIA | `amenities/controller.ts:12` | Mismo patrón `query.hotelId` > JWT | Leer/escribir amenities de otro hotel |
| V6 | MEDIA | `admin/index.ts:51` | `GET /api/public/users` sin `authenticate` | PII (name/email/role) de cuentas demo sin auth |
| V7 | MEDIA | `rate-limit.ts:53` | Rate limit login por `X-Forwarded-For` no validado | Rotar XFF → bucket nuevo por request → bypass anti-brute-force |
| V8 | MEDIA | `composition-root.ts:56` + `kernel/middlewares.ts:39` | Rate limiter global `keyBy=remoteAddress` = 127.0.0.1 tras nginx | Bucket único de 200 req/min para todos: inútil + auto-DoS |

## Scope

### In Scope
- **SEC-1** Fix del patrón `hotelOf()` en ttlock, pricing, amenities (V1, V3, V5): para roles no `super_admin`, derivar `hotelId` SIEMPRE del token/DB; ignorar o validar `query.hotelId`.
- **SEC-2** Fix ownership real en ttlock code-gen y pricing deleteBlock (V2, V4): pasar el hotel del usuario autenticado a `assertOwnership`/`deleteBlock`, nunca el query.
- **SEC-3** Proteger `GET /api/public/users` o removerlo (V6).
- **SEC-4** Hardening rate limit: validar proxy confiable antes de leer XFF (V7); setear `keyBy=getClientIp` en el limiter global (V8).
- **SEC-5** Tests de tenancy: extender `route-permissions.test.ts` con casos cross-tenant para ttlock, pricing, amenities (hoy no cubiertos).

### Out of Scope
- Rate limiting distribuido (Redis) — es `RL-01`, change aparte (el Map en memoria no escala con PM2 cluster, pero es correctness de infra, no un IDOR).
- Rotación de secretos TTLock ya expuestos — decisión operativa del hotel.

## Riesgos
- **Regresión de super_admin**: el super_admin SÍ necesita pasar `query.hotelId` para operar cross-hotel. El fix debe permitirlo SOLO para `userType==='admin'`/`super_admin`, no para merchant. Given/When/Then en la spec cubre ambos caminos.
- **TTLock en producción**: V2 toca generación de códigos de puerta reales. Requiere test de que un merchant NO puede generar código fuera de su hotel, y regresión de que SÍ puede dentro.

## Rollback
Los fixes son validaciones adicionales (rechazan requests que antes pasaban). Rollback =
revertir los commits; no hay cambio de schema ni de datos. El único efecto de revertir es
reabrir las vulnerabilidades.

## MisterPlan / referencia
No aplica equivalente MisterPlan (es hardening interno). Referencia: OWASP API Security
Top 10 — API1:2023 Broken Object Level Authorization (BOLA/IDOR).
