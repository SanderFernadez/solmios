// src/services/ttlock-client.ts — Cliente REAL de la API de Sciener/TTLock.
// OAuth2 "Resource Owner Password" + endpoints v3 de cerraduras.
// Docs: https://euopen.ttlock.com/doc/  (Sciener Open Platform)
//
// Las credenciales viven en `configuration` (key: ttlock_config), NUNCA en código.
// Regiones: eu (euapi.sciener.com) · us (api.us.sciener.com) · cn (api.sciener.com).

const REGION_BASE: Record<string, string> = {
  eu: 'https://euapi.sciener.com',
  us: 'https://api.us.sciener.com',
  cn: 'https://api.sciener.com',
}

/** Genera un PIN numérico aleatorio de seis dígitos para una cerradura TTLock. */
export function randomPin(): string {
  const min = 100000
  const span = 900000
  return String(Math.floor(min + Math.random() * span))
}

function base(region?: string): string {
  return REGION_BASE[(region || 'eu').toLowerCase()] || REGION_BASE.eu
}

/** ms timestamp actual (la API de Sciener lo pide como `date`). */
function nowMs(): number { return Date.now() }

/** Lee el body JSON de una response Sciener y normaliza errores. */
async function readJson(res: Response): Promise<any> {
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { _raw: text } }
}

function assertOk(data: any, fallback: string): void {
  // Sciener responde con errcode/errmsg (o errmsg en /oauth2/token como error_description).
  const code = data?.errcode ?? data?.errorCode
  const msg = data?.errmsg ?? data?.error_description ?? data?.error
  if (code !== undefined && code !== 0) throw new Error(`TTLock: ${msg || code}`)
  if (msg && (data?.error || data?.error_description)) throw new Error(`TTLock: ${msg}`)
  void fallback
}

export interface TTLockCreds {
  clientId: string
  clientSecret?: string
  username?: string
  password?: string
  accessToken?: string
  region?: string
}

/** OAuth2 Resource Owner Password → { accessToken, refreshToken, uid }. */
export async function getAccessToken(c: TTLockCreds): Promise<{ accessToken: string; refreshToken?: string; uid?: string }> {
  if (!c.clientId || !c.clientSecret || !c.username || !c.password) {
    throw new Error('Faltan clientId/clientSecret/username/password de TTLock')
  }
  const res = await fetch(`${base(c.region)}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      clientId: c.clientId,
      clientSecret: c.clientSecret,
      username: c.username,
      password: c.password,
    }),
  })
  const data = await readJson(res)
  if (!data?.access_token) {
    throw new Error(data?.error_description || data?.errmsg || 'TTLock: credenciales inválidas o sin permisos')
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, uid: data.uid }
}

export interface TTLockDevice {
  lockId: number
  lockName?: string
  lockAlias?: string
  lockMac?: string
  electricQuantity?: number
}

/** Lista TODAS las cerraduras de la cuenta TTLock (paginando). */
export async function listLocks(c: TTLockCreds): Promise<TTLockDevice[]> {
  if (!c.accessToken) throw new Error('Sin access_token de TTLock (conectá primero)')
  const all: TTLockDevice[] = []
  let pageNo = 1
  for (;;) {
    const qs = new URLSearchParams({
      clientId: c.clientId, accessToken: c.accessToken,
      pageNo: String(pageNo), pageSize: '50', date: String(nowMs()),
    })
    const data = await readJson(await fetch(`${base(c.region)}/v3/lock/list?${qs}`))
    assertOk(data, 'listar cerraduras')
    const list: any[] = data?.list || []
    for (const l of list) {
      all.push({
        lockId: l.lockId,
        lockName: l.lockName,
        lockAlias: l.lockAlias,
        lockMac: l.lockMac,
        electricQuantity: l.electricQuantity,
      })
    }
    const total = Number(data?.total ?? 0)
    if (list.length < 50 || all.length >= total) break
    pageNo++
    if (pageNo > 20) break // salvaguarda
  }
  return all
}

/** Versión del teclado de la cerradura (requerida antes de crear un PIN). */
export async function getKeyboardPwdVersion(c: TTLockCreds, lockId: number): Promise<number> {
  const qs = new URLSearchParams({
    clientId: c.clientId, accessToken: c.accessToken!, lockId: String(lockId), date: String(nowMs()),
  })
  const data = await readJson(await fetch(`${base(c.region)}/v3/lock/getKeyboardPwdVersion?${qs}`))
  assertOk(data, 'obtener versión de teclado')
  return Number(data?.keyboardPwdVersion ?? data?.version ?? 1)
}

/** Crea un PIN temporal en la cerradura FÍSICA. Devuelve { keyboardPwdId }. */
export async function addKeyboardPassword(
  c: TTLockCreds, lockId: number, password: string, startMs: number, endMs: number,
): Promise<{ keyboardPwdId?: string }> {
  const keyboardPwdVersion = await getKeyboardPwdVersion(c, lockId)
  const res = await fetch(`${base(c.region)}/v3/lock/addKeyboardPassword`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      clientId: c.clientId,
      accessToken: c.accessToken!,
      lockId: String(lockId),
      keyboardPwd: password,
      keyboardPwdVersion: String(keyboardPwdVersion),
      startDate: String(startMs),
      endDate: String(endMs),
      date: String(nowMs()),
    }),
  })
  const data = await readJson(res)
  assertOk(data, 'crear PIN de cerradura')
  return { keyboardPwdId: data?.keyboardPwdId != null ? String(data.keyboardPwdId) : undefined }
}
