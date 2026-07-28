// hotelmedia/controller.ts — Adaptador HTTP (STUB).
// Scope F0 (tasks 0.6 + 0.7): solo modelo + service + usecases. El controller y las
// rutas admin/pública se implementan en la task 0.8 (otra pieza paralela). Acá dejamos
// un stub tipado que compile sin romper el `arckode analyze` (que exige ver el archivo).
//
// El service ya está totalmente funcional y testeado via usecases — cuando la task 0.8
// cablee las rutas, va a instanciar este controller y delegar al service.
import type { HttpRequest, Logger } from 'arckode-framework'
import type { HotelMediaService } from './service'

export class HotelMediaController {
  constructor(
    private readonly service: HotelMediaService,
    private readonly logger: Logger,
  ) {}

  // Los handlers concretos (index/store/update/destroy/reorder/publicMedia) se agregan
  // en la task 0.8. El `service` y el `logger` ya están cableados por el constructor —
  // la task 0.8 solo completa los métodos.
  readonly _todo_task_0_8 = true
}
