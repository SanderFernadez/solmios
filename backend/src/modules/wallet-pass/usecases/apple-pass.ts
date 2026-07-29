// wallet-pass/usecases/apple-pass.ts — Generación del .pkpass de Apple Wallet (F3 3.7).
//
// Spec: wallet-pass/spec.md "Apple Passkit". Requiere:
//   - configuration('apple_pass_cert'): .p12 del Apple Developer Program del hotel ($99/año).
//   - configuration('apple_pass_cert_passphrase'): passphrase del .p12.
//   - configuration('apple_pass_type_id'): pass.com.solmios.<hotel-slug>.
//   - configuration('apple_team_id'): team ID de Apple Developer.
//
// Decisiones (spec.md:48-76, design.md D4):
//   - El pass Apple es OPCIONAL por hotel. Si falta cred o falla la firma → `url=null`,
//     el flujo sigue con Google pass + email con lockCode visible (graceful degradation).
//   - La integración real con `passkit-generator` (npm) requiere cert real + teamID. Si la
//     librería NO está instalada o el cert falta, NO rompemos la pieza: devolvemos null URL
//     + reason para log. Cablear creds reales → activa la generación real sin tocar código.
//
// Storage del .pkpass: el archivo firmado se sube al StorageService (S3/local, mismo adapter
// que hotel-media) bajo dir `wallet-passes/`. La URL pública se persiste en `wallet_passes.appleUrl`.
// Sin storage inyectado (tests) → el usecase devuelve reason='storage_missing'.
//
// Anti-patrón ORM: este usecase NO toca el ORM directo. Lee `configuration` vía repo
// inyectado (RepositoryAdapter<Record<string, unknown>>) y sube el binario vía StorageService.
import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { StorageService } from 'arckode-framework/modules/storage'
import type { ApplePassResult } from '../types'

/** Deps inyectadas por el service (todo por constructor, no ORM directo). */
export interface ApplePassDeps {
  /** Repo ORM `Configuration` (multi-tenant). Lectura para creds del hotel. */
  configRepo: RepositoryAdapter<Record<string, unknown>>
  /** Storage para subir el .pkpass firmado. Opcional: si no se inyecta, devuelve storage_missing. */
  storage?: StorageService
  logger: Logger
}

/** Configuración Apple del hotel resuelta desde `configuration`. */
export interface ApplePassConfig {
  /** Contenido del .p12 en base64 (lo que se sube al Settings admin). */
  certBase64?: string | null
  /** Passphrase del .p12. */
  passphrase?: string | null
  /** pass.com.solmios.<hotel-slug>. */
  passTypeId?: string | null
  /** Team ID de Apple Developer. */
  teamId?: string | null
}

/** Directorio del bucket S3 / disco local para los .pkpass generados. */
const STORAGE_DIR = 'wallet-passes'

/**
 * Lee la configuration(key='apple_pass_*') del hotel y la normaliza. Devuelve {} si no hay nada.
 * El layout exacto (un solo JSON en `apple_pass_cert` con todo adentro, o 4 keys separadas)
 * lo decide el Settings admin del hotel; acá soportamos AMBAS formas para no acoplar a una.
 */
async function resolveAppleConfig(deps: ApplePassDeps, hotelId: string): Promise<ApplePassConfig> {
  const rows = await deps.configRepo.findMany({ hotelId }).catch(() => [])
  const cfg: Record<string, unknown> = {}
  for (const row of rows) {
    const key = String(row.key ?? '')
    const raw = row.value
    // values pueden venir como string JSON o como valor directo.
    if (typeof raw === 'string' && (raw.startsWith('{') || raw.startsWith('['))) {
      try { cfg[key] = JSON.parse(raw); continue } catch { /* noop, cae al asignar raw */ }
    }
    cfg[key] = raw
  }
  // Forma A: un solo JSON bajo `apple_pass_cert` con todos los campos.
  const bundle = cfg['apple_pass_cert']
  if (bundle && typeof bundle === 'object') {
    const b = bundle as Record<string, unknown>
    return {
      certBase64: (b.certBase64 ?? b.cert ?? null) as string | null,
      passphrase: (b.passphrase ?? null) as string | null,
      passTypeId: (b.passTypeId ?? b.pass_type_id ?? null) as string | null,
      teamId: (b.teamId ?? b.team_id ?? null) as string | null,
    }
  }
  // Forma B: keys separadas.
  return {
    certBase64: (cfg['apple_pass_cert'] ?? null) as string | null,
    passphrase: (cfg['apple_pass_cert_passphrase'] ?? null) as string | null,
    passTypeId: (cfg['apple_pass_type_id'] ?? null) as string | null,
    teamId: (cfg['apple_team_id'] ?? null) as string | null,
  }
}

/**
 * Carga dinámica de `passkit-generator`. Si no está instalado (npm), devuelve null
 * en vez de crashear — el pass Apple queda en stub hasta que el hotel cablee creds
 * y el operador instale la librería.
 *
 * Usa `require` (no `import()`) para que TypeScript NO resuelva el módulo en tiempo
 * de compilación — si lo hiciera, rompería el typecheck en entornos sin la dep
 * instalada. require es plain JS, sin declaración de tipos.
 */
async function loadPasskit(): Promise<any | null> {
  try {
    // @ts-ignore — passkit-generator es opcional. Si no está instalado, catch→null.
    const mod = await import('passkit-generator')
    return mod?.default ?? mod ?? null
  } catch {
    return null
  }
}

/**
 * Genera el .pkpass para la reserva. Best-effort: cualquier fallo → `{ url: null, reason }`.
 *
 * NO lanza. El caller (generate-pass.ts) decide qué hacer con `reason`: loguear y seguir.
 */
export async function generateApplePass(
  deps: ApplePassDeps,
  input: {
    hotelId: string
    reservationId: string
    lockCode: string
    hotelName: string
    checkIn: string
    checkOut: string
    roomNumber?: string
  },
): Promise<ApplePassResult> {
  const cfg = await resolveAppleConfig(deps, input.hotelId)

  // 1) Sin cert → no hay pass Apple. Es el caso más común (hoteles sin Apple Developer).
  if (!cfg.certBase64) {
    return { url: null, reason: 'no_cert' }
  }
  if (!cfg.passTypeId || !cfg.teamId) {
    deps.logger.warn('apple-pass: cert presente pero falta passTypeId/teamId', { hotelId: input.hotelId })
    return { url: null, reason: 'no_cert' }
  }
  // 2) Sin storage → no podemos persistir el .pkpass. No rompe, pero el link no sirve.
  if (!deps.storage) {
    deps.logger.warn('apple-pass: storage no inyectado, no se puede persistir .pkpass', { hotelId: input.hotelId })
    return { url: null, reason: 'storage_missing' }
  }

  // 3) Cargar `passkit-generator`. Si no está instalado, devolvemos stub URL null.
  const passkit = await loadPasskit()
  if (!passkit) {
    deps.logger.warn('apple-pass: passkit-generator no instalado — pass Apple en stub', { hotelId: input.hotelId })
    return { url: null, reason: 'library_missing' }
  }

  try {
    // 4) Construir y firmar el pass. La librería pide el cert como Buffer del .p12 + passphrase.
    const certBuffer = Buffer.from(cfg.certBase64, 'base64')
    const Pass = passkit.Pass ?? passkit.default?.Pass ?? passkit.PKPass
    if (typeof Pass !== 'function') {
      deps.logger.warn('apple-pass: Pass constructor no encontrado en passkit-generator', { hotelId: input.hotelId })
      return { url: null, reason: 'library_missing' }
    }

    // Template mínimo. `passkit-generator` espera este shape (ver docs npm).
    const pass = new Pass(
      {
        passTypeIdentifier: cfg.passTypeId,
        teamIdentifier: cfg.teamId,
      },
      {
        'cert.pem': certBuffer,
        'key.pem': certBuffer, // .p12 bundlea ambos; la librería los separa vía passphrase.
        password: cfg.passphrase ?? '',
      } as any,
      // Template: el layout visual del pass. Versión mínima para que firme y sirva el lockCode.
      {
        pass: {
          description: `Acceso ${input.hotelName}`,
          boardingType: 'generic',
          organizationName: input.hotelName,
          passTypeIdentifier: cfg.passTypeId,
          teamIdentifier: cfg.teamId,
          serialNumber: input.reservationId,
          generic: {
            primaryFields: [
              { key: 'code', label: 'Código de acceso', value: input.lockCode },
            ],
            secondaryFields: [
              { key: 'room', label: 'Habitación', value: input.roomNumber ?? '' },
              { key: 'in', label: 'Check-in', value: input.checkIn },
              { key: 'out', label: 'Check-out', value: input.checkOut },
            ],
          },
        },
      } as any,
    )

    const buffer: Buffer = await pass.render()
    const stored = await deps.storage.upload(
      {
        fieldName: 'file',
        originalName: `pass-${input.reservationId}.pkpass`,
        buffer,
        mimeType: 'application/vnd.apple.pkpass',
        size: buffer.length,
      },
      STORAGE_DIR,
    )
    return { url: stored.url, reason: 'ok' }
  } catch (e: unknown) {
    // spec.md:69-74 — cert vencido/inválido → log apple_pass_error + url=null.
    deps.logger.warn('apple-pass: firma falló (¿cert vencido?)', {
      hotelId: input.hotelId, reservationId: input.reservationId, error: (e as Error).message,
    })
    return { url: null, reason: 'sign_failed' }
  }
}
