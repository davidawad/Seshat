import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // GitLab Pages serves a project site (no custom domain) under
  // /<project-name>/, not the domain root — every asset URL needs that
  // prefix. Only plain `vite dev` stays at '/'; `command` alone can't tell
  // `vite preview` apart from `vite dev` (both report 'serve'), hence the
  // separate `isPreview` check — without it, `vite preview` serves the
  // build's /seshsat/-prefixed HTML but resolves static assets at '/',
  // 404s straight into the SPA fallback, and silently renders a blank page.
  base: command === 'build' || isPreview ? '/seshsat/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Vitest's default exclude list skips .git but not .claude — a stray
    // git worktree under .claude/worktrees/ (e.g. from Claude Code's
    // EnterWorktree) duplicates every *.test.ts file into the run and
    // breaks tests that assume single-instance globals like localStorage.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
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
}))
