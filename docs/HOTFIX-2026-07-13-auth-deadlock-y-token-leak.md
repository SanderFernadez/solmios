# Hotfix 2026-07-13 — Deadlock de auth + fuga de token GitLab

Dos problemas detectados y corregidos. El segundo requiere **una acción manual tuya** (revocar el token).

---

## 1. Frontend se congela hasta F5 — deadlock en el refresh del token

**Síntoma reportado:** tras tener la app mucho tiempo abierta (o volver de que la laptop durmió), "deja de funcionar" y ninguna acción responde; recargar con F5 la arregla.

**Causa raíz** (`frontend/src/services/http.ts`):
1. El access token dura 24h; al vencer, la próxima request da 401 y dispara el refresh single-flight (`isRefreshing = true` + `failedQueue`).
2. `refreshAccessToken()` hacía `fetch('/api/auth/refresh')` **sin timeout ni AbortController**.
3. Si esa conexión quedó *stale* (TCP muerto tras idle largo / suspensión), el `await` **nunca resuelve** → el `finally { isRefreshing = false }` **nunca corre**.
4. A partir de ahí, **toda** request cae en `if (isRefreshing)` y se encola en `failedQueue` esperando una promesa que nadie resuelve → app congelada.
5. F5 recarga el módulo JS → `isRefreshing` vuelve a `false` → anda de nuevo. (Calza exacto con el síntoma.)

**Fix aplicado:** `AbortController` + timeout duro de 10s en el fetch de refresh. Así el `await` **siempre** termina (resuelve o rechaza por abort); si expira, se rechaza la cola, se resetea `isRefreshing` vía `finally`, y la request original hace `forceLogout()` con "Sesión expirada" en vez de congelar.

**No era:** ni el Service Worker (PC-4 desactivado, hay tombstone que se auto-desregistra) ni un mismatch en la respuesta del refresh (`token`/`refreshToken` se mapean bien).

**Gates:** `vue-tsc --noEmit` ✅ · `vite build` ✅.

**Mejora futura opcional (no incluida, es enhancement, no el bug):** refresh proactivo decodificando `exp` del JWT antes de las 24h + revalidación en `visibilitychange` al recuperar foco de la pestaña.

---

## 2. 🔴 Token de GitLab hardcodeado en el repo (fuga de secreto)

**Problema:** `cronograma/cronograma-sync.gs` tenía el Personal Access Token de GitLab (scope `api`) en texto plano y **commiteado** (`var TOKEN = "glpat-..."`). Cualquiera con acceso al repo — o a su historial de git — tenía el token con acceso total a la API.

**Fix aplicado (código):** eliminado del archivo. Ahora las credenciales se leen de **Script Properties** de Apps Script (cifrado, no versionado) vía `getGitLabConfig()`, con `setupCredentials()` para cargarlas una vez y un ítem de menú "Configurar credenciales".

**⚠️ ACCIÓN MANUAL OBLIGATORIA (no se puede automatizar):**
Quitar el token del archivo **NO lo borra del historial de git** — sigue siendo recuperable de commits viejos. El único remedio real:
1. **Revocá el PAT** en GitLab → *Settings → Access Tokens* → revocar `glpat-cj2...`.
2. Generá uno nuevo (scope `api`).
3. Cargalo en Apps Script vía "Cronograma → Configurar credenciales" (o Script Properties: `GITLAB_TOKEN`).

Hasta que lo revoques, el token viejo sigue siendo válido y comprometido.

---

## Regla relacionada (ya aplicada)
El sync Excel/CLI → GitLab ahora **solo** sincroniza título/labels/estado en el update; la **descripción** es propiedad de GitLab (specs para el dev) y no se pisa. Ver `cronograma/cronograma-sync.gs::updateGitLabIssue` y `openspec-gitlab-sync/src/index.ts`.
