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

# Cut a release: bump package.json, prepend a CHANGELOG.md entry, commit, and create an annotated
# tag vX.Y.Z. Never pushes. `just release patch --dry-run` previews. See docs/releasing.md.
release kind *flags:
    node scripts/release.ts {{kind}} {{flags}}

# Real-browser accessibility + WebMCP check (Playwright bundled Chromium, axe-core).
# Not part of `ci`: needs a browser. One-time: pnpm exec playwright-core install chromium
e2e:
    pnpm run build
    node e2e/real-browser.mjs

# Property-based UI exploration with Bombadil (github.com/antithesishq/bombadil, v0.7.8 tested),
# against the LOCAL preview build only. Not part of `ci`. Needs the `bombadil` release binary on
# PATH. Runs `runs` short explorations (default 5 x 4m) at desktop (1024x768) then phone (390x844);
# traces land in target/bombadil/<desktop|phone>-<n>/. A stall watchdog kills a wedged browser
# (Chrome can spin its browser process and stop answering CDP) and moves on. Exit 1 on a property
# violation, 3 if only wedges happened. Why and how: e2e/bombadil/run.sh and the header of spec.ts.
bombadil limit="4m" runs="5":
    e2e/bombadil/run.sh "{{limit}}" "{{runs}}"
