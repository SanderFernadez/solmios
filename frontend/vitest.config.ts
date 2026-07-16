import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// Config de tests unitarios (separada de vite.config.ts para no afectar el build de prod).
// Runner: vitest 4 + @vue/test-utils + happy-dom. Alias @ = src (igual que vite.config.ts).
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    css: false,
  },
})
