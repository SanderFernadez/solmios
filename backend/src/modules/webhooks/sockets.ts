// webhooks/sockets.ts — Este módulo es un "sink": otros módulos empujan eventos hacia `dispatch()`
// vía connectors (ej. `reservas-webhooks.ts`), en vez de que webhooks escuche sus sockets.
// Interfaz vacía para mantener la convención estructural del módulo.

export interface WebhooksSockets {}
