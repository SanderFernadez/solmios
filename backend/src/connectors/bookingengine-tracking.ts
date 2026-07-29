// connectors/bookingengine-tracking.ts — Wire del socket onBookingPaid al service.fireAll (F3 3.12).
//
// Spec: server-tracking/spec.md "Meta CAPI fire al confirmar" + "GA4 Measurement Protocol fire".
//
// Por qué este connector existe (vs cablear en stripe.ts directo): el spec task 3.12 pide
// "En stripe.ts handleWebhook post-confirm: llama metaCapi.fireConversion". Hacerlo literal
// viola la regla "NO importar de otro módulo directamente" (bookingengine → server-tracking).
// El socket `onBookingPaid` YA se emite desde `bookingengine/service.ts:158` tras el confirm
// — mismo punto que usa `reservas-wallet`. Suscribirnos acá es funcionalmente idéntico: el
// fire ocurre "post-confirm" como pide el spec, sin acoplar los módulos.
//
// Best-effort + fire-and-forget: el service.fireAll ya envuelve TODO en try/catch y persiste
// status sent/failed/skipped por su cuenta. Acá solo llamamos sin await (para que el webhook
// responda rápido) y catch terminal por si el service entero cae (defensa en profundidad).
//
// Patrón idéntico a `reservas-wallet.ts`. setSockets compone (no pisa): si los dos connectors
// están registrados, ambos fires corren (wallet + tracking), orden no garantizado, no importa.
import type { ConnectorContext } from 'arckode-framework'
import { fireAllAfterBookingPaid } from '../shared/usecases/server-tracking-trigger'

export function bookingengineTrackingConnector(ctx: ConnectorContext): void {
  const bookingengine = ctx.resolveModule<{ setSockets: (s: any) => void }>('bookingengine')
  bookingengine.setSockets({ onBookingPaid: fireAllAfterBookingPaid(ctx) })
}
