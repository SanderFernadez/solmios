// publicapi/service.ts — Facade de la API pública v1. NO importa habitaciones/reservas: recibe
// los "puertos" (rooms/reservations) inyectados por el connector `publicapi-reservas` en
// composition-root.ts, igual que `apikeys.setAuditDeps()` recibe su puerto desde un connector.

import type { Logger } from 'arckode-framework'
import { InternalError, NotFoundError, AuthError } from 'arckode-framework'
import type {
  PublicRoomsQuery, PublicRoomAvailabilityDTO,
  CreatePublicReservationDTO, PublicReservationDTO,
  PublicApiRoomsPort, PublicApiReservationsPort,
} from './types'

export class PublicapiService {
  private roomsPort: PublicApiRoomsPort | null = null
  private reservationsPort: PublicApiReservationsPort | null = null

  /** Inyectado por el connector `publicapi-reservas`. */
  setDeps(deps: { rooms?: PublicApiRoomsPort; reservations?: PublicApiReservationsPort }): void {
    if (deps.rooms) this.roomsPort = deps.rooms
    if (deps.reservations) this.reservationsPort = deps.reservations
  }

  constructor(private readonly logger: Logger) {}

  async listRooms(hotelId: string, query: PublicRoomsQuery): Promise<PublicRoomAvailabilityDTO[]> {
    if (!this.roomsPort) throw new InternalError('publicapi: rooms port no conectado (falta el connector publicapi-reservas)')
    this.logger.info('GET /api/public/v1/rooms', { hotelId })
    return this.roomsPort.listAvailability(hotelId, query)
  }

  async createReservation(hotelId: string, dto: CreatePublicReservationDTO): Promise<PublicReservationDTO> {
    if (!this.reservationsPort) throw new InternalError('publicapi: reservations port no conectado (falta el connector publicapi-reservas)')
    this.logger.info('POST /api/public/v1/reservations', { hotelId, roomId: dto.roomId })
    return this.reservationsPort.create(hotelId, dto)
  }

  async getReservation(hotelId: string, id: string): Promise<PublicReservationDTO> {
    if (!this.reservationsPort) throw new InternalError('publicapi: reservations port no conectado (falta el connector publicapi-reservas)')
    const item = await this.reservationsPort.getById(hotelId, id)
    if (!item) throw new NotFoundError('Reserva no encontrada')
    if (item.hotelId !== hotelId) throw new AuthError('No autorizado')
    return item
  }
}
