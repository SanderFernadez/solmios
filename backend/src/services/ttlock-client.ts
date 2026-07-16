// src/services/ttlock-client.ts — Cliente REAL de la API de Sciener/TTLock.
// OAuth2 "Resource Owner Password" + endpoints v3 de cerraduras.
// Docs: https://euopen.ttlock.com/doc/  (Sciener Open Platform)
//
// Las credenciales viven en `configuration` (key: ttlock_config), NUNCA en código.
// Regiones: eu (euapi.sciener.com) · us (api.us.sciener.com) · cn (api.sciener.com).

import { createHash } from 'node:crypto'

const REGION_BASE: Record<string, string> = {
  eu: 'https://euapi.sciener.com',
  us: 'https://api.us.sciener.com',
  cn: 'https://api.sciener.com',
}

/**
 * Cómo se entrega el PIN a la cerradura física.
 * 1 = bluetooth (requiere un teléfono con la app al lado de la puerta)
 * 2 = gateway (remoto: el hotel tiene un gateway TTLock en la red)
 * 3 = NB-IoT
 */
export type TTLockAddType = 1 | 2 | 3
export const DEFAULT_ADD_TYPE: TTLockAddType = 2

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
  addType?: TTLockAddType
}

/**
 * Sciener exige el password como MD5 hex de 32 chars en minúsculas
 * (doc oficial /oauth2/token: "Password(32 chars, low case, md5 encrypted)").
 * Si ya viene hasheado se respeta, para no re-hashear un valor migrado.
 */
function md5Password(password: string): string {
  if (/^[a-f0-9]{32}$/.test(password)) return password
  return createHash('md5').update(password, 'utf8').digest('hex')
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
      password: md5Password(c.password),
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

/** Crea un PIN temporal en la cerradura FÍSICA. Devuelve { keyboardPwdId }. */
export async function addKeyboardPassword(
  c: TTLockCreds, lockId: number, password: string, startMs: number, endMs: number,
): Promise<{ keyboardPwdId?: string }> {
  const res = await fetch(`${base(c.region)}/v3/keyboardPwd/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      clientId: c.clientId,
      accessToken: c.accessToken!,
      lockId: String(lockId),
      keyboardPwd: password,
      startDate: String(startMs),
      endDate: String(endMs),
      addType: String(c.addType ?? DEFAULT_ADD_TYPE),
      date: String(nowMs()),
    }),
  })
  const data = await readJson(res)
  assertOk(data, 'crear PIN de cerradura')
  return { keyboardPwdId: data?.keyboardPwdId != null ? String(data.keyboardPwdId) : undefined }
}

/**
 * Borra el PIN de la cerradura FÍSICA. Sin esto, revocar/expirar un código solo cambia
 * una fila en la base y el huésped que ya se fue puede seguir abriendo la puerta.
 * `deleteType` usa la misma semántica que `addType` (2 = gateway).
 */
export async function deleteKeyboardPassword(
  c: TTLockCreds, lockId: number, keyboardPwdId: string,
): Promise<void> {
  const res = await fetch(`${base(c.region)}/v3/keyboardPwd/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      clientId: c.clientId,
      accessToken: c.accessToken!,
      lockId: String(lockId),
      keyboardPwdId: String(keyboardPwdId),
      deleteType: String(c.addType ?? DEFAULT_ADD_TYPE),
      date: String(nowMs()),
    }),
  })
  assertOk(await readJson(res), 'borrar PIN de cerradura')
}

export interface TTLockGateway {
  gatewayId: number
  gatewayName?: string
  gatewayMac?: string
  networkName?: string
  isOnline?: number
  lockNum?: number
  gatewayVersion?: number
}

/** Lista los gateways de la cuenta TTLock (paginando). `isOnline` 1 = conectado. */
export async function listGateways(c: TTLockCreds): Promise<TTLockGateway[]> {
  if (!c.accessToken) throw new Error('Sin access_token de TTLock (conectá primero)')
  const all: TTLockGateway[] = []
  let pageNo = 1
  for (;;) {
    const qs = new URLSearchParams({
      clientId: c.clientId, accessToken: c.accessToken,
      pageNo: String(pageNo), pageSize: '50', date: String(nowMs()),
    })
    const data = await readJson(await fetch(`${base(c.region)}/v3/gateway/list?${qs}`))
    assertOk(data, 'listar gateways')
    const list: any[] = data?.list || []
    for (const g of list) {
      all.push({
        gatewayId: g.gatewayId, gatewayName: g.gatewayName, gatewayMac: g.gatewayMac,
        networkName: g.networkName, isOnline: g.isOnline, lockNum: g.lockNum, gatewayVersion: g.gatewayVersion,
      })
    }
    const total = Number(data?.total ?? 0)
    if (list.length < 50 || all.length >= total) break
    pageNo++
    if (pageNo > 20) break
  }
  return all
}

/**
 * Un código tal como vive HOY en la cerradura física (distinto de la tabla `lock_codes` de la BD).
 * `keyboardPwdType`: 1 permanente · 2 temporal · 3 período · 4 borrado, etc. (Sciener). `status` 1 = válido.
 */
export interface TTLockPasscode {
  keyboardPwdId: number
  keyboardPwd?: string
  keyboardPwdName?: string
  keyboardPwdType?: number
  startDate?: number
  endDate?: number
  status?: number
}

/** Lee los códigos (keyboardPwd) reales de UNA cerradura física, paginando. */
export async function listLockPasscodes(c: TTLockCreds, lockId: number): Promise<TTLockPasscode[]> {
  if (!c.accessToken) throw new Error('Sin access_token de TTLock (conectá primero)')
  const all: TTLockPasscode[] = []
  let pageNo = 1
  for (;;) {
    const qs = new URLSearchParams({
      clientId: c.clientId, accessToken: c.accessToken, lockId: String(lockId),
      pageNo: String(pageNo), pageSize: '50', date: String(nowMs()),
    })
    const data = await readJson(await fetch(`${base(c.region)}/v3/lock/listKeyboardPwd?${qs}`))
    assertOk(data, 'listar códigos de la cerradura')
    const list: any[] = data?.list || []
    for (const p of list) {
      all.push({
        keyboardPwdId: p.keyboardPwdId, keyboardPwd: p.keyboardPwd,
        keyboardPwdName: p.keyboardPwdName ?? p.nickName, keyboardPwdType: p.keyboardPwdType,
        startDate: p.startDate, endDate: p.endDate, status: p.status,
      })
    }
    const total = Number(data?.total ?? 0)
    if (list.length < 50 || all.length >= total) break
    pageNo++
    if (pageNo > 20) break
  }
  return all
}
