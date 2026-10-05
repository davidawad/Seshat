default: run

# pnpm is canonical (see `packageManager` in package.json) — never npm/yarn here.
install:
    pnpm install

run:
    pnpm run dev

build:
    pnpm run build

test:
    pnpm run test

lint:
    pnpm run lint

typecheck:
    pnpm run typecheck

format:
    pnpm run format

format-check:
    pnpm run format:check

# format:check + lint + typecheck + circular + duplication + license +
# test:coverage + build + size — see the `ci` script in package.json.
ci:
    pnpm run ci

# The gate the landing queue (`land`) runs on a merge candidate before
# publishing it: install exactly what the lockfile says, then the full CI.
test-gate:
    pnpm install --frozen-lockfile
    pnpm run ci

# Real-browser accessibility + WebMCP check (Playwright bundled Chromium, axe-core).
# Not part of `ci`: needs a browser. One-time: pnpm exec playwright-core install chromium
e2e:
    pnpm run build
    node e2e/real-browser.mjs
