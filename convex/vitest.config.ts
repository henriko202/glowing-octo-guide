import { configDefaults, defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      'convex/server': path.resolve(__dirname, '../convex-mocks/_test/__mocks__/convex_server_generics.ts')
    }
  },
  test: {
    // Integration suites run under vitest.integration.config.ts: under THIS config `convex/server` is
    // mocked, so convexTest cannot build a real schema. The package `test` script excludes
    // integration/ the same way — encoding it here keeps bare `vitest run <name>` consistent.
    exclude: [...configDefaults.exclude, '**/integration/**']
  }
})
