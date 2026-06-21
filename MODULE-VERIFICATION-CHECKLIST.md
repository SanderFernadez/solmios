# Module Verification Checklist

> Guía para verificar CADA módulo antes de darlo por terminado.
> Basada en los issues encontrados durante la revisión exhaustiva del módulo Auth.

---

## Proceso obligatorio por módulo

```
1. Implementar → 2. Tests → 3. Consejo de expertos → 4. Fix issues → 5. Re-verificar → 6. Commit
```

**NUNCA** dar un módulo por terminado sin pasar por el consejo de expertos (GLM-5.2 + DeepSeek Pro + Flash).

---

## Checklist Backend

### Service

| # | Check | Descripción |
|---|-------|-------------|
| B1 | `JWT_SECRET` / secrets | Si usa JWT, verificar que no hay fallback hardcodeado. Throw si falta en producción. |
| B2 | `validateSchema()` en controllers | TODOS los POST/PUT/PATCH deben usar validateSchema. NUNCA recibir body crudo. |
| B3 | `auth.assertOwnership()` | En update/delete, verificar que el recurso pertenece al hotel del usuario autenticado. |
| B4 | `hotelId` desde token | NUNCA aceptar hotelId del body/query para operaciones de escritura. Siempre desde `req.user.hotelId`. |
| B5 | Whitelist de campos en update | No permitir actualizar campos sensibles (role, hotelId, active) sin permisos especiales. |
| B6 | Super_admin bypass | Si hay ownership check, el super_admin debe poder operar cross-hotel. |
| B7 | Filtrar campos sensibles | `list()`, `create()`, `update()` NUNCA deben devolver passwords, tokens, resetTokens. |
| B8 | Email normalization | Normalizar email (trim + lowercase) en login, create, update, forgotPassword. |
| B9 | Password hashing | Usar bcrypt (o argon2). NUNCA plaintext. Migración lazy de legacy. |
| B10 | Rate limiting | En endpoints públicos críticos (login), aplicar rate limiting. |
| B11 | Tokens en DB | Si se guardan tokens en DB, verificar que logout/changePassword/resetPassword los invalidan. |
| B12 | Tipos sync | `types.ts` debe coincidir EXACTAMENTE con `model.ts`. Sin campos fantasma. |

### Model

| # | Check | Descripción |
|---|-------|-------------|
| B13 | Todos los campos usados | Si el service usa un campo (ej: resetToken), debe estar en el modelo. |
| B14 | Índices | Campos de búsqueda frecuente (email, resetToken) deben tener `indexed: true`. |
| B15 | English only | TODOS los nombres de tablas y campos en INGLÉS. Cero español en la DB. |

### Validators

| # | Check | Descripción |
|---|-------|-------------|
| B16 | Campos requeridos | `required: true` en campos obligatorios. |
| B17 | Longitudes | `min` y `max` en strings. |
| B18 | Enums | Roles, estados, tipos deben ser enum, no string libre. |
| B19 | Unused validators | Si hay schema definido, DEBE usarse en el controller. |

---

## Checklist Frontend

### Pages

| # | Check | Descripción |
|---|-------|-------------|
| F1 | `<script setup lang="ts">` | SIEMPRE. Sin excepciones. |
| F2 | `<style scoped>` | SIEMPRE. Sin excepciones. |
| F3 | Service para API calls | NUNCA `fetch()` directo en componentes. Usar `XxxService.method()`. |
| F4 | `<router-link>` | NUNCA `<a href>` para rutas internas. |
| F5 | Loading states | Todo fetch debe tener `loading` ref. |
| F6 | Error states | Todo fetch debe manejar errores y mostrar al usuario. |
| F7 | Router registration | TODAS las páginas deben tener ruta en `router/index.ts`. |

### Services

| # | Check | Descripción |
|---|-------|-------------|
| F8 | Naming `Xxx.service.ts` | PascalCase + `.service.ts`. |
| F9 | Usa `http.ts` | No fetch directo. El service usa el wrapper HTTP del proyecto. |
| F10 | Tipado | Métodos con tipos de retorno. No `any`. |

### Stores

| # | Check | Descripción |
|---|-------|-------------|
| F11 | Setup syntax | `defineStore('x', () => { ... })`. NUNCA options API. |
| F12 | Store no importa router | El componente hace `router.push()`, no el store. |
| F13 | Store orquesta service | El store llama al service, no fetch directo. |
| F14 | Logout completo | Logout debe llamar al backend Y limpiar estado local. |

---

## Checklist Seguridad

| # | Check | Descripción |
|---|-------|-------------|
| S1 | Sin fuga de datos | Responses HTTP NUNCA deben contener passwords, tokens, hashes. |
| S2 | Sin escalada de privilegios | Un usuario normal no puede hacerse admin. |
| S3 | Sin cross-tenant | Un hotel no puede ver/modificar datos de otro hotel. |
| S4 | Sin inyección de campos | ValidateSchema + whitelist en updates. |
| S5 | Rate limiting | Endpoints de autenticación con rate limit. |
| S6 | Tokens expiran | JWT con TTL razonable. Reset tokens con expiración. |
| S7 | Sesiones invalidables | Logout y changePassword deben invalidar el token. |
| S8 | Sin endpoints públicos peligrosos | No exponer datos sensibles sin auth. |
| S9 | Constant-time comparison | Para passwords/ tokens, usar comparación constante. |
| S10 | Input validation | Todo input validado antes de procesar. |

---

## Checklist Tests

| # | Check | Descripción |
|---|-------|-------------|
| T1 | Happy path | Test del caso exitoso de CADA método. |
| T2 | Error paths | Test de CADA error que el método puede lanzar. |
| T3 | Edge cases | Null, undefined, empty strings, límites de longitudes. |
| T4 | Security | Test de ownership check, role check, filtrado de campos sensibles. |
| T5 | Integration | Test de que el controller llama correctamente al service. |
| T6 | Rate limit | Test de que el rate limit funciona (bloquea después de N intentos). |
| T7 | Auth middleware | Test de que las rutas protegidas rechazan sin token. |
| T8 | Coverage | Mínimo 80% de cobertura de código. |

---

## Consejo de Expertos (obligatorio)

Antes de dar un módulo por terminado, enviar al consejo:

```
Revisión FINAL del módulo [NOMBRE]. Verificá:
1) Backend completo y seguro
2) Frontend completo y funcional
3) Tests cubren todas las features
4) Sin vulnerabilidades de seguridad
5) Tipos sincronizados
6) Rate limiting (si aplica)
7) Ownership checks (si aplica)
8) Campos sensibles filtrados

Lee TODOS los archivos del módulo y responda: "APROBADO — 10/10" o liste problemas.
```

**Modelos a usar:** GLM-5.2 + DeepSeek Pro + DeepSeek Flash

**Si hay issues:** Arreglar → Re-verificar → Solo commitear cuando los 3 aprueben.

---

## Errores comunes encontrados (Auth module)

| Error | Lección |
|-------|---------|
| `types.ts` con campos que no existen en el modelo | Siempre sync types.ts ↔ model.ts |
| `forgotPassword` sin test de happy path | Testear TODOS los caminos, no solo errores |
| `logout` en store no llama al backend | Logout debe invalidar token server-side |
| `resetAttempts` importado pero nunca usado | No importar código muerto |
| Rate limit cuenta éxitos | Rate limit solo en intentos fallidos |
| `forgotPassword` devuelve token en response | Tokens NUNCA en HTTP response |
| `resetPassword` hace `findMany({})` | Usar `findOne` con filtro, no cargar toda la tabla |
| `create` escribe `activo` en vez de `active` | Naming consistente entre modelo y service |
| Endpoint público expone todos los usuarios | No crear endpoints públicos sin verificar qué exponen |
