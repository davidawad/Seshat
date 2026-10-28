---
title: Bundling MathJax 4 under Vite without a CDN
date: 2026-10-28
category: tooling-decisions
module: math rendering
problem_type: tooling_decision
component: tooling
severity: medium
applies_when:
  - 'adding or changing LaTeX rendering (src/lib/math)'
  - 'upgrading @mathjax/src or its font package'
  - 'a formula with a rarer alphabet (blackboard bold, script) fails to render'
tags: [mathjax, vite, latex, bundling, svg, lazy-loading]
---

# Bundling MathJax 4 under Vite without a CDN

## Context

Seshat typesets card LaTeX with MathJax and promises "no account, no server", so nothing may load from a CDN and the
entry bundle must stay small (the `size-limit` gate is 170 kB brotli). `mathjax-full` is deprecated in favour of
`@mathjax/src` (v4), whose SVG output keeps its glyph tables in a separate font package.

## Guidance

- Use `@mathjax/src` with the lite adaptor, TeX input and SVG output with `fontCache: 'none'`
  (each formula is a self-contained SVG, no shared defs to collide). See `src/lib/math/render.ts:29-30`.
- Load the whole renderer lazily: `MathText` only does `import('../lib/math/render')` once a card actually contains a
  formula, so MathJax never enters the entry chunk.
- MathJax asks for rarer glyph tables (blackboard bold, script, fraktur) while converting, by calling
  `mathjax.asyncLoad(name)` with a name like `@mathjax/mathjax-newcm-font/js/svg/dynamic/double-struck.js`. Without a
  handler the conversion throws `dynamic file 'double-struck' failed to load`. Provide one that maps `/js/` to
  `/mjs/` and serves the file from `import.meta.glob('/node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/*.js')`
  (`src/lib/math/render.ts:17-22`), so each table becomes its own lazy chunk.
- The glob path only resolves when the font package is a **direct** dependency (it is otherwise only a transitive one
  inside the pnpm store), so `@mathjax/mathjax-newcm-font` is listed in `package.json`. Because it is referenced by
  a path string rather than an import, tell knip: it is under `ignoreDependencies` in `knip.json`.
- Convert inside `mathjax.handleRetriesFor(...)` so the async font load can complete, and cache the resulting markup per
  formula and display mode.
- Do not register the `html` or `require` TeX packages: imported sets are untrusted text and must not be able to emit
  links or load code (a test asserts `\href` renders no anchor).

## Why This Matters

Skipping the `asyncLoad` handler works for `\frac` and Greek letters and then fails only on a specific alphabet, which is
easy to miss. Using the transitive font path, or a CDN default, breaks either the build or the offline promise.

## When to Apply

- Any change to `src/lib/math/` or the MathJax dependency versions.
- Adding another TeX package: check that it needs no dynamic file the glob does not cover.

## Examples

`pnpm exec vitest run src/components/MathText.test.tsx` typesets `$$x \in \mathbb{R}^n$$` (needs the
`double-struck` file) and `src/features/sets/catalog-math.test.ts` typesets every formula in the bundled sets.

## Related

- Design and grading rules for LaTeX answers: `docs/` Docs page section "Math and LaTeX".
