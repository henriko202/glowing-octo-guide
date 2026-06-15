import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import checker from 'vite-plugin-checker'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ command }) => {
  const isBuild = command === 'build'

  return {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    plugins: [
      tailwindcss(),
      react(),
      !isBuild
        ? checker({
            typescript: {
              tsconfigPath: 'tsconfig.json'
            },
            overlay: {
              initialIsOpen: false
            },
            terminal: true
          })
        : null
    ],
    server: {
      port: 5174
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts']
    }
  }
})
