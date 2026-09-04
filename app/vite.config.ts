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
      setupFiles: ['./src/test/setup.ts'],
      // Force host-only cookies under jsdom (page origin is http://localhost).
      // Otherwise a developer's .env.local VITE_COOKIE_DOMAIN=.linkintothessi.com
      // leaks in and jsdom rejects the cross-domain cookie, failing cookie tests.
      env: { VITE_COOKIE_DOMAIN: '' }
    }
  }
})
