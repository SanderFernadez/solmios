// PM2 — ManagerHotel (SOLMI OS)
// Daemon + autorestart on crash + logs centralizados. Sin `watch`:
// el backend usa `bun --hot` (recarga módulos en caliente) y el frontend Vite HMR,
// por lo que los cambios se aplican sin reiniciar el proceso.
//
// ⚠ interpreter: 'none' es OBLIGATORIO con Bun: PM2 v7 envuelve el proceso en un
// ProcessContainerFork que hace require() del script → casca con top-level await
// (composition-root.ts tiene `await system.start()`). Con 'none', PM2 ejecuta el
// binario bun directo, sin wrapper.
//
// Uso:
//   pm2 start ecosystem.config.cjs     # arrancar
//   pm2 logs mh-backend mh-frontend    # logs en vivo
//   pm2 restart mh-backend             # solo si un cambio estructural lo requiere
//   pm2 stop mh-backend mh-frontend    # detener
//   pm2 delete mh-backend mh-frontend  # sacar del daemon
const BUN = '/home/phantom/.bun/bin/bun'

module.exports = {
  apps: [
    {
      name: 'mh-backend',
      cwd: './backend',
      script: './start.sh',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      env: { NODE_ENV: 'development' },
      watch: false,
    },
    {
      name: 'mh-frontend',
      cwd: './frontend',
      script: BUN,
      args: 'run dev',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      env: { NODE_ENV: 'development' },
    },
  ],
}
