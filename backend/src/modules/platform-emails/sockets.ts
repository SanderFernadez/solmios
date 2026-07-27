// platform-emails/sockets.ts — Este módulo no escucha eventos de otros módulos (lo llaman
// directo: subscriptions y el cron de trial vía resolveModule/connector). Interfaz vacía para
// mantener la convención estructural del módulo (ver webhooks/sockets.ts, mismo criterio).

export interface PlatformEmailsSockets {}
