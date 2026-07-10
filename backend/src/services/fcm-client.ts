// services/fcm-client.ts — Envío de avisos push por Firebase Cloud Messaging.
//
// Habla FCM HTTP v1, que pide un access token de OAuth2 obtenido firmando un JWT
// con la clave privada de una cuenta de servicio. La API legacy (`/fcm/send` con
// una server key) está apagada desde 2024.
//
// Sin credenciales el cliente no existe (`fromEnv` devuelve null) y el módulo
// `pushtokens` se limita a guardar tokens. La app sigue avisando mientras está
// abierta: eso lo hacen los vigilantes del cliente, no esto.

import { createSign } from 'node:crypto'
import type { Logger } from 'arckode-framework'
import type { PushNotification, PushSendResult, PushSender } from '../modules/pushtokens'

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

/** Los access token de Google duran una hora; se renueva antes para no cortar. */
const TOKEN_TTL_SECONDS = 3600
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * `invalid_argument` con un token mal formado, `not_registered` (404) cuando la
 * app se desinstaló. En los dos casos el token no sirve más y hay que borrarlo;
 * cualquier otro error es del momento y se reintenta en el próximo mensaje.
 */
function classify(status: number, body: string): PushSendResult {
  if (status >= 200 && status < 300) return 'sent'
  if (status === 404) return 'invalidToken'
  if (status === 400 && /registration token|invalid_argument/i.test(body)) return 'invalidToken'
  if (status === 403 && /senderid mismatch/i.test(body)) return 'invalidToken'
  return 'failed'
}

export class FcmClient implements PushSender {
  private accessToken: string | null = null
  private accessTokenExpiresAt = 0

  private constructor(
    private readonly account: ServiceAccount,
    private readonly logger: Logger,
    private readonly now: () => number = () => Date.now(),
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /**
   * Lee la cuenta de servicio de `FCM_SERVICE_ACCOUNT` (el JSON entero) o de
   * `FCM_SERVICE_ACCOUNT_PATH` (la ruta a ese archivo). Devuelve `null` si no
   * está configurada: arrancar sin push es un modo válido, no un error.
   */
  static fromEnv(logger: Logger, env: NodeJS.ProcessEnv = process.env): FcmClient | null {
    const raw = env.FCM_SERVICE_ACCOUNT
    const path = env.FCM_SERVICE_ACCOUNT_PATH
    if (!raw && !path) {
      logger.info('FCM sin configurar: los avisos push quedan apagados')
      return null
    }

    try {
      const json = raw ?? require('node:fs').readFileSync(path as string, 'utf8')
      const account = JSON.parse(json) as ServiceAccount
      if (!account.project_id || !account.client_email || !account.private_key) {
        throw new Error('faltan project_id, client_email o private_key')
      }
      // Las variables de entorno no guardan saltos de línea reales.
      account.private_key = account.private_key.replace(/\\n/g, '\n')
      logger.info('FCM listo', { project: account.project_id })
      return new FcmClient(account, logger)
    } catch (error) {
      logger.error('FCM mal configurado: los avisos push quedan apagados', { error: String(error) })
      return null
    }
  }

  /** Solo para tests: inyecta reloj y `fetch`. */
  static forTesting(
    account: ServiceAccount,
    logger: Logger,
    now: () => number,
    fetchFn: typeof fetch,
  ): FcmClient {
    return new FcmClient(account, logger, now, fetchFn)
  }

  async send(token: string, notification: PushNotification): Promise<PushSendResult> {
    const accessToken = await this.getAccessToken()
    const url = `https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: notification.title, body: notification.body },
          data: notification.data ?? {},
          // `high` despierta al teléfono en Doze; sin esto el aviso puede
          // esperar horas a que la pantalla se encienda.
          android: { priority: 'high' },
        },
      }),
    })

    const body = await response.text()
    const result = classify(response.status, body)
    if (result === 'failed') {
      this.logger.warn('FCM rechazó el envío', { status: response.status, body: body.slice(0, 200) })
    }
    return result
  }

  /** Cachea el access token: pedir uno por mensaje sería un viaje de más. */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.now() < this.accessTokenExpiresAt) return this.accessToken

    const assertion = this.signJwt()
    const response = await this.fetchFn(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`OAuth de Google falló (${response.status}): ${detail.slice(0, 200)}`)
    }

    const data = (await response.json()) as { access_token: string; expires_in: number }
    this.accessToken = data.access_token
    this.accessTokenExpiresAt = this.now() + data.expires_in * 1000 - TOKEN_REFRESH_MARGIN_MS
    return this.accessToken
  }

  private signJwt(): string {
    const issuedAt = Math.floor(this.now() / 1000)
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claims = base64Url(
      JSON.stringify({
        iss: this.account.client_email,
        scope: FCM_SCOPE,
        aud: OAUTH_TOKEN_URL,
        iat: issuedAt,
        exp: issuedAt + TOKEN_TTL_SECONDS,
      }),
    )

    const signer = createSign('RSA-SHA256')
    signer.update(`${header}.${claims}`)
    const signature = base64Url(signer.sign(this.account.private_key))
    return `${header}.${claims}.${signature}`
  }
}
