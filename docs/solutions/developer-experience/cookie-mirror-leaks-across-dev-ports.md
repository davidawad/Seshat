---
title: The settings cookie mirror is shared by every dev server on the same host
date: 2026-10-03
category: developer-experience
module: settings-persistence
problem_type: developer_experience
component: development_workflow
severity: low
applies_when:
  - 'Running two or more dev servers or previews on different ports of 127.0.0.1 or localhost'
  - 'A fresh-looking origin shows settings or key bindings you never set there'
  - 'Manually testing first-run or empty-state behavior in a browser'
tags: [cookies, localStorage, dev-server, settings, keybindings, testing]
---

# The settings cookie mirror is shared by every dev server on the same host

## Context

Seshat mirrors its settings and key-binding overrides into two small cookies
(`seshat_settings`, `seshat_keys`) as a durability layer beneath `localStorage`
(`src/lib/persistence.ts`, constants near line 86). While several agents each
ran their own `vite` dev server on different ports (5190, 5194, 5195) against
the same browser profile, a navigation preset (WASD) chosen on one port
appeared on another port that had never had it set: the flashcards hint strip
read "A"/"D" on an origin whose `localStorage` was empty.

## Guidance

Treat the cookie mirror as **host-scoped, not origin-scoped**. `buildCookie`
emits only `Path`, `Max-Age` and `SameSite=Lax` and no `Domain`
(`src/lib/persistence.ts:125`), so the cookie belongs to the host
(`127.0.0.1`) and browsers do not partition cookies by port. `localStorage`,
by contrast, is per origin (scheme + host + port).

The loaders prefer `localStorage` and only fall back to the cookie when it has
nothing: `loadKeybindingOverrides` returns the mirrored overrides when the
`localStorage` key is absent (`src/lib/keybindingStorage.ts:23`), and
`loadInitialState` boots from the mirrored settings when stored state cannot
be loaded (`src/lib/storage.ts:65`). So the leak only ever surfaces on an
origin with empty storage, which is exactly the situation a fresh dev port
creates.

## Why This Matters

- A "first run" check on a new port is not a clean first run: settings and
  keybindings may already be customised, which can make a layout or shortcut
  look wrong (for example key names shown as WASD letters) when nothing is
  broken.
- Agents or developers running parallel servers can change each other's
  state without noticing.
- It is also the feature working as designed: the cookie mirror exists so
  preferences survive a cleared or unavailable `localStorage`.

## When to Apply

- When a dev-server screenshot or test shows non-default settings on a brand
  new port.
- Before concluding a settings, theme or keybinding bug is in the code: clear
  both cookies first.

## Examples

Reset to a true first run in the browser console on the affected host:

```js
for (const name of ['seshat_settings', 'seshat_keys']) {
  document.cookie = `${name}=; Path=/; Max-Age=0`
}
localStorage.clear()
```

Use `Path=` equal to Vite's `base` if it is not `/` (the cookie path is
`import.meta.env.BASE_URL`, `src/lib/persistence.ts:156`). In the production
GitLab Pages build that base is `/seshat/`.

Unit tests that touch persistence reset the mirror themselves with
`clearMirrors()` (`src/lib/persistence.ts:197`) so they do not depend on
cookie state left by an earlier test.
