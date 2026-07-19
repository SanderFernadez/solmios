// Puente entre la llave maestra y el hardware real de TTLock.
//
// `MasterKeysUseCase` declara qué necesita (crear un PIN, borrarlo, leer el
// historial) sin saber de dónde sale; acá se conecta con las cerraduras de
// verdad. Ese corte es lo que permite probar los casos feos —una puerta que
// falla, una revocación a medias— sin tocar una cerradura.
import * as hw from './ttlock-hardware'
import type { HardwareDeps } from './ttlock-hardware'
import { MasterKeysUseCase, type MasterKeyHardware } from './master-keys'

function masterKeyHardware(deps: HardwareDeps): MasterKeyHardware {
  return {
    createPermanentCode: (hotelId, lockId, code, name) => hw.createPermanentCode(deps, hotelId, lockId, code, name),
    removePasscode: (hotelId, lockId, pwdId) => hw.removePasscode(deps, hotelId, lockId, pwdId),
    getRecords: (hotelId, lockId, days) => hw.getRecords(deps, hotelId, lockId, days),
  }
}

/** Arma el usecase ya conectado a las cerraduras reales. */
export function createMasterKeys(lockDevicesRepo: any, lockCodesRepo: any, deps: HardwareDeps): MasterKeysUseCase {
  return new MasterKeysUseCase(lockDevicesRepo, lockCodesRepo, masterKeyHardware(deps))
}
