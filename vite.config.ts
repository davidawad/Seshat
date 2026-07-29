import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // This repo's established convention (see swe-typescript-standards):
      // pure logic gets unit tests, React wiring gets manual/browser
      // verification (documented throughout the commit history) — not
      // React Testing Library component tests. Coverage is scoped to the
      // pure-logic surface that convention actually covers, not blanket
      // 100% across .tsx UI that's deliberately tested a different way.
      exclude: [
        '**/*.tsx',
        'src/main.tsx',
        'src/lib/window-api.ts',
        'src/features/settings/theme.ts',
        'src/test-setup.ts',
        'src/features/sets/sample-set.ts',
        'src/features/sets/starter-sets.ts',
        '**/*.config.*',
      ],
      thresholds: {
        lines: 90,
        branches: 80,
        functions: 90,
        statements: 90,
      },
    },
  },
})
