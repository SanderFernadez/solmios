// publicapi/sockets.ts — Este módulo no emite eventos propios: es una fachada de lectura/escritura
// hacia habitaciones/reservas (que sí emiten sus propios sockets, ej. `onReservasCreated`).
// Interfaz vacía para mantener la convención estructural del módulo.

export interface PublicapiSockets {}
