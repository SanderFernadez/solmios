// wallet-pass/index.ts — PUERTA PÚBLICA del módulo (F3, spec wallet-pass).
// ⚠ REGLA: Append-only. No sacar ni modificar exports existentes.
//
// Wiring: registra el modelo `WalletPasses`, construye repos + service + controller, y
// expone 2 rutas admin (auth + permiso settings:* — el pass seadministra junto al módulo
// de cerraduras/digital-access, mismo criterio que ttlock):
//   GET /api/wallet-pass                          → list (paginado, multi-tenant)
//   GET /api/wallet-pass/reservation/:reservationId → get por reserva (admin)
//
// No hay ruta pública del pass: el huésped lo recibe por email (3.9) y la confirmación
// web (3.17, frontend) accede con el accessToken de la reserva (ya protegido por F0 IDOR).
//
// El trigger de generación NO pasa por las rutas: el connector `reservas-wallet.ts`
// subscribe a `bookingengine.onBookingPaid` y dispara `service.generatePass(reservationId)`.
// Para activar el email, `email-bootstrap.ts` inyecta el EmailService al módulo vía
// `setEmailDeps()` (mismo patrón que reservas/payroll/opiniones).
//
// Permisos: `settings:view|edit` (HC: si no existe, cae a `billing:*` — ver
// createPermissionGuard). Hoteles con wallet pass habilitado necesitan el permiso en su rol.
import { createModule, OrmRepository } from 'arckode-framework'
import type { StorageService } from 'arckode-framework/modules/storage'
import { registerWalletPassModels } from './model'
import { WalletPassService } from './service'
import { WalletPassController } from './controller'
import type { WalletPassDTO } from './types'
import type { EmailService } from '../../services/email-service'
import type { TtlockPort } from './usecases/generate-pass'
import { createPermissionGuard } from '../../infrastructure/auth/create-permission-guard'
import { createModuleGuard } from '../../infrastructure/auth/require-module'
import { requireUserType } from '../../infrastructure/auth/require-user-type'

export { WalletPassService, WalletPassController }
export { registerWalletPassModels } from './model'
export type {
  WalletPassDTO, CreateWalletPassDTO, GeneratePassResult,
  WalletPassQuery, WalletPassPaginated, CurrentUser,
  ApplePassResult, GooglePassResult,
} from './types'
export type { WalletPassSockets } from './sockets'
export { WalletPassValidator, RegenerateWalletPassSchema } from './validators/schema'

/**
 * Opciones del módulo.
 *  - `storage`: StorageService global (S3/local) para subir el .pkpass firmado.
 *    Si no se pasa (tests), `appleUrl` queda null con reason='storage_missing'.
 */
export interface WalletPassModuleOpts {
  storage?: StorageService
}

export function WalletPassModule(opts: WalletPassModuleOpts = {}) {
  return createModule({
    name: 'wallet-pass',
    version: '1.0.0',
    description: 'Módulo de wallet pass — Apple + Google + email (F3)',

    contract: {
      name: 'wallet-pass',
      version: '1.0.0',
      description: 'Wallet pass generation on reservation confirm (Apple .pkpass + Google save URL)',
      actions: ['generatePass', 'getByReservation', 'list'],
      events: [],
      tables: ['wallet_passes'],
      dependencies: [],
      rules: [
        'Unique (reservationId) — 1 pass vigente por reserva, idempotente',
        'Best-effort: Apple/Google URLs null si faltan creds (graceful)',
        'lockCode REQUIRED — si ttlock no puede generarlo, no se persiste',
        'Trigger via onBookingPaid (connector reservas-wallet), NO cron',
        'Email encolado tras generar pass (best-effort)',
      ],
    },

    create({ logger, orm, router, auth }) {
      if (!auth) throw new Error('wallet-pass: auth dependency required')
      registerWalletPassModels(orm)

      const repo = new OrmRepository<WalletPassDTO>(orm, 'WalletPasses')
      const configRepo = new OrmRepository<Record<string, unknown>>(orm, 'Configuration')
      const lockCodeRepo = new OrmRepository<{ reservationId?: string; hotelId?: string; code?: string; status?: string }>(orm, 'LockCodes')
      const reservationRepo = new OrmRepository<any>(orm, 'Reservations')
      const hotelRepo = new OrmRepository<any>(orm, 'Hotels')
      const guestRepo = new OrmRepository<any>(orm, 'Guests')
      const roomRepo = new OrmRepository<any>(orm, 'Rooms')
      const log = logger.child('wallet-pass')

      // El service arranca sin EmailService ni ttlock: se inyectan post-init desde
      // composition-root (email-bootstrap inyecta email; setTtlockPort lo conecta al módulo
      // ttlock cuando ya está registrado). Esto evita orden-de-carga entre módulos.
      const service = new WalletPassService(repo, log, {
        auth,
        configRepo,
        lockCodeRepo,
        reservationRepo,
        hotelRepo,
        guestRepo,
        roomRepo,
        ttlock: null,
        storage: opts.storage,
        emailService: null,
      })
      const controller = new WalletPassController(service, log)

      // Guard admin: userType merchant + permiso settings:view + module guard (settings.locks
      // — mismo bloque que ttlock: el pass es "extensión digital" de la cerradura).
      const roleRepo = new OrmRepository<any>(orm, 'Roles')
      const permGuard = createPermissionGuard(auth, roleRepo)
      const moduleGuard = createModuleGuard(orm)
      const adminGuard = (action: 'view' | 'edit') => [
        ...permGuard('settings', action),
        moduleGuard('settings.locks'),
        requireUserType('merchant'),
      ]

      router.get('/api/wallet-pass', adminGuard('view'), (req) => controller.index(req))
      router.get('/api/wallet-pass/reservation/:reservationId', adminGuard('view'), (req) => controller.getByReservation(req))

      log.info('Módulo wallet-pass v1 listo (CRUD lectura admin)')
      return service
    },
  })
}
