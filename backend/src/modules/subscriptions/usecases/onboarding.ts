// onboarding.ts — Qué le falta configurar al hotel para poder trabajar.
//
// Un hotel recién registrado entra a un panel con todo en cero y ninguna pista
// de por dónde empezar. Esta es la guía, y se calcula mirando los DATOS REALES:
// un checklist que se marca solo porque alguien apretó "listo" miente en cuanto
// el hotel borra lo que había cargado.
//
// El orden importa: sin habitaciones no se puede cargar una reserva, así que esa
// va primera. Lo demás es lo que se necesita para cobrar y operar el día a día.
import type { RepositoryAdapter } from 'arckode-framework'

export interface OnboardingStep {
  key: string
  title: string
  description: string
  /** A dónde va el botón. */
  route: string
  done: boolean
  /** Sin esto el hotel no puede operar; lo demás mejora la operación. */
  required: boolean
  /** Cuántos ítems ya tiene cargados (para mostrar "3 habitaciones"). */
  count?: number
}

export interface OnboardingStatus {
  /** `true` cuando ya no hay nada obligatorio pendiente: la guía se esconde. */
  completed: boolean
  /** Pasos hechos sobre el total, para la barra de progreso. */
  doneCount: number
  totalCount: number
  steps: OnboardingStep[]
}

export interface OnboardingDeps {
  roomsRepo: RepositoryAdapter<any>
  usersRepo: RepositoryAdapter<any>
  ratesRepo?: RepositoryAdapter<any>
  hotelsRepo: RepositoryAdapter<any>
}

export class OnboardingUseCase {
  constructor(private readonly deps: OnboardingDeps) {}

  async status(hotelId: string): Promise<OnboardingStatus> {
    const [rooms, users, hotel, rates] = await Promise.all([
      this.deps.roomsRepo.findMany({ hotelId }).catch(() => []),
      this.deps.usersRepo.findMany({ hotelId }).catch(() => []),
      this.deps.hotelsRepo.findById(hotelId).catch(() => null),
      this.deps.ratesRepo?.findMany({ hotelId }).catch(() => []) ?? [],
    ])

    // El dueño se creó solo en el alta: el paso se cumple cuando sumó a ALGUIEN
    // más, que es lo que de verdad significa "armé mi equipo".
    const team = (users as any[]).length
    const hotelReady = Boolean(hotel?.phone || hotel?.address)

    const steps: OnboardingStep[] = [
      {
        key: 'rooms',
        title: 'Cargá tus habitaciones',
        description: 'Sin habitaciones no se puede tomar una reserva. Es el primer paso.',
        route: '/panel/rooms',
        done: (rooms as any[]).length > 0,
        required: true,
        count: (rooms as any[]).length,
      },
      {
        key: 'hotel',
        title: 'Completá los datos del hotel',
        description: 'Dirección y teléfono: salen impresos en las facturas y en los mensajes al huésped.',
        route: '/panel/settings',
        done: hotelReady,
        required: true,
      },
      {
        key: 'rates',
        title: 'Definí tus tarifas',
        description: 'El precio por noche de cada tipo de habitación.',
        route: '/panel/pricing',
        done: (rates as any[]).length > 0,
        required: false,
        count: (rates as any[]).length,
      },
      {
        key: 'team',
        title: 'Sumá a tu equipo',
        description: 'Recepción, camareras y mantenimiento, cada uno con sus permisos.',
        route: '/panel/rrhh/team',
        done: team > 1,
        required: false,
        count: Math.max(0, team - 1),
      },
    ]

    const doneCount = steps.filter(s => s.done).length
    return {
      // La guía se esconde cuando lo obligatorio está hecho: dejarla para
      // siempre por un paso opcional la convierte en ruido.
      completed: steps.filter(s => s.required).every(s => s.done),
      doneCount,
      totalCount: steps.length,
      steps,
    }
  }
}
