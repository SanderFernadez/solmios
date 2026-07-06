import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Plugin: endpoint /__alive que SOLO responde cuando Vite está corriendo.
// El monitor en index.html lo usa para detectar si el servidor vuelve después de un restart.
function alivePlugin() {
  return {
    name: 'alive-endpoint',
    configureServer(server: any) {
      server.middlewares.use('/__alive', (_req: any, res: any) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('ok')
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), alivePlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      // Evidencia fotográfica de housekeeping y otros archivos estáticos servidos por el backend.
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
  },
})
