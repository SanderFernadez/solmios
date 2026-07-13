// src/infrastructure/health.ts — DEP-05: endpoint de salud para monitoreo externo.
//
// Público (sin auth) para que el health-check pueda pegarle antes de cualquier login.
// NO expone datos sensibles: solo estado up/down de la BD, uptime y timestamp.
// Devuelve 200 si todo OK, 503 si la BD no responde (para que el monitor alerte).

const startedAt = Date.now()
const MS_TO_SEC = 1000

export function registerHealthRoute(router: any, orm: any): void {
  router.get('/api/health', async () => {
    const checks: Record<string, string> = {}
    let healthy = true

    try {
      // Ping mínimo a la BD: si la conexión está caída, esto lanza.
      await orm.findMany('Configuration', { key: '__healthcheck__' })
      checks.db = 'up'
    } catch {
      checks.db = 'down'
      healthy = false
    }

    return {
      status: healthy ? 200 : 503,
      body: {
        status: healthy ? 'ok' : 'degraded',
        uptimeSeconds: Math.floor((Date.now() - startedAt) / MS_TO_SEC),
        checks,
        timestamp: new Date().toISOString(),
      },
    }
  })
}
