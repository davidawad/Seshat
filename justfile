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

# Property-based UI exploration with Bombadil (github.com/antithesishq/bombadil, v0.7.8 tested),
# against the LOCAL preview build only. Not part of `ci`. Needs the `bombadil` release binary on
# PATH. Runs desktop then phone width; traces land in target/bombadil/. Non-zero on any violation.
bombadil limit="10m":
    #!/usr/bin/env bash
    set -euo pipefail
    command -v bombadil >/dev/null || { echo "bombadil not on PATH"; exit 1; }
    pnpm run build
    port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')
    pnpm exec vite preview --port "$port" --strictPort --host 127.0.0.1 >/dev/null 2>&1 &
    server=$!
    trap 'kill $server 2>/dev/null || true' EXIT
    until curl -fs "http://127.0.0.1:$port/seshat/" >/dev/null; do sleep 0.5; done
    status=0
    bombadil browser test "http://127.0.0.1:$port/seshat/" e2e/bombadil/spec.ts --headless \
      --time-limit "{{limit}}" --output-path target/bombadil/desktop --output-path-overwrite || status=$?
    bombadil browser test "http://127.0.0.1:$port/seshat/" e2e/bombadil/spec.ts --headless \
      --width 390 --height 844 --time-limit "{{limit}}" --output-path target/bombadil/phone \
      --output-path-overwrite || status=$?
    exit $status
