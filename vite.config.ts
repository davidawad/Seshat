import { realpathSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import packageJson from './package.json' with { type: 'json' }

// GitLab Pages serves this project (no custom domain) at
// /<gitlab-project-name>/, so the base path must track the project's
// actual slug rather than a second hardcoded copy of it — derived from
// package.json's `name` so renaming the GitLab project (as happened once
// already, seshsat -> seshat) only requires updating package.json.
const GITLAB_PAGES_BASE = `/${packageJson.name}/`

// Dev-only fix: Vite's server.fs.allow defaults to the directory containing
// the nearest pnpm-workspace.yaml (see searchForWorkspaceRoot). This repo's
// pnpm-workspace.yaml (the supply-chain minimumReleaseAge setting) is a
// tracked file, so it's checked out into every git worktree — which means
// the search stops at the worktree root and never climbs to wherever
// node_modules is actually located. In worktrees set up with node_modules
// symlinked back to the primary checkout (to skip a redundant `pnpm
// install` per worktree), that leaves the *real*, symlink-resolved path to
// node_modules outside the allow-list: Vite's /@fs/ handler resolves
// symlinks to their realpath before checking fs.allow/fs.strict, so any
// asset reached only through node_modules (e.g. the woff2 files @fontsource
// CSS references via url(), which — unlike JS deps — never go through
// optimizeDeps' explicitly-allowed cacheDir) 403s. Explicitly allowing the
// realpath of node_modules fixes this regardless of whether it's a real
// directory (a no-op, already inside the default allow-list) or a symlink
// elsewhere. Production builds inline/copy font assets into dist/, so this
// never affects `vite build` + `vite preview`.
const NODE_MODULES_REAL_PATH = realpathSync(new URL('./node_modules', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // Only plain `vite dev` stays at '/'; `command` alone can't tell `vite
  // preview` apart from `vite dev` (both report 'serve'), hence the
  // separate `isPreview` check — without it, `vite preview` serves the
  // build's GITLAB_PAGES_BASE-prefixed HTML but resolves static assets at
  // '/', 404s straight into the SPA fallback, and silently renders a blank
  // page.
  base: command === 'build' || isPreview ? GITLAB_PAGES_BASE : '/',
  plugins: [react()],
  server: {
    fs: {
      allow: ['.', NODE_MODULES_REAL_PATH],
    },
  },
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
      // .tsx is still excluded from the coverage GATE even though a growing
      // set of components now have real React Testing Library tests
      // (FlashcardSession, ReviewSession, MatchSession, TestSession, etc.)
      // — most .tsx files (editors, forms, layout chrome) are still
      // untested, so folding component coverage into the threshold here
      // would either fail the gate or require auditing every .tsx file's
      // coverage individually. Revisit this exclude once component test
      // coverage is broad enough to set a real .tsx threshold rather than
      // an all-or-nothing one.
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
