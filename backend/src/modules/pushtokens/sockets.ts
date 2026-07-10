// pushtokens/sockets.ts — Hooks OPCIONALES hacia otros módulos
// Los sockets son opcionales. El módulo funciona sin ellos.
//
// Este módulo no emite eventos: es la punta del camino, no el principio. Los
// que avisan son los otros —un mensaje nuevo, una tarea asignada— y llegan acá
// por connector, llamando a `notifyUser`/`notifyHotel`.

export interface PushTokensSockets {
  // Sin eventos por ahora.
}
