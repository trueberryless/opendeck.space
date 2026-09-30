import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: [
        'app/utils/**/*.ts',
        'app/composables/**/*.ts',
        'app/middleware/**/*.ts',
        'app/plugins/**/*.ts',
        'shared/**/*.ts',
        'netlify/**/*.{ts,mts}',
        'server/**/*.ts',
      ],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
    projects: [
      {
        resolve: {
          alias: { '~~': root, '~': `${root}app`, '@': `${root}app` },
        },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['tests/unit/setup.ts'],
          globalSetup: ['tests/global-setup.ts'],
          restoreMocks: true,
          unstubEnvs: true,
          unstubGlobals: true,
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          environment: 'nuxt',
          include: ['tests/nuxt/**/*.test.ts'],
          setupFiles: ['tests/nuxt/setup.ts'],
          restoreMocks: true,
        },
      }),
    ],
  },
})
