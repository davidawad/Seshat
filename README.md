# Seshat

Seshat is a free, open-source flashcard and spaced-repetition app. It exists because Quizlet put flashcards I
made myself behind a paywall — so instead of paying to study my own material, I built something better and gave
it away.

## Why it's different

Most flashcard apps optimize for engagement: streaks, hearts, leaderboards. Seshat optimizes for learning.
Every non-trivial product decision — recall-first card design, the spacing algorithm, the confidence prompt,
even the typography — is backed by a citation from the cognitive-science and legibility literature, not a growth
metric. See the in-app `/` (home) and `/attributions` pages, or the [`research/`](./research) folder, for the
receipts.

## Core features

- **Sets** — a named collection of cards, the core abstraction (`/sets` to manage them, `/sets/:id` for one
  set's hub page: study-mode buttons plus a random-card preview, the way Quizlet's own set page works).
- **Recall-first study (the default, and the one we recommend)** — short-answer, cloze deletion,
  multiple-choice, and image-occlusion card types, confidence captured before you see the answer, FSRS spaced
  scheduling, and optional per-set goal dates that tighten the schedule as an exam or deadline nears.
- **Confidence calibration** — rate your confidence on each answer and see, over time, whether that confidence
  is actually justified.
- **Every major Quizlet-style study mode, too** — jump into any of these for a set on demand, independent of
  what's due:
  - **Flashcards** — classic flip-and-self-rate.
  - **Test** — a generated, multi-format practice test (written, true/false, multiple-choice) across a whole
    set, scored at the end.
  - **Match** — a timed term/definition matching drill. Purely a speed supplement — results aren't fed into the
    spaced-repetition system, unlike the other modes.
- **FSRS spaced scheduling** — per-card, per-learner difficulty/stability modeling (via [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)) instead of a fixed interval table, with selectable desired-retention
  presets (85% / 90% / 93%).
- **Local-first, zero-backend** — no account, no server, no tracking. Your sets, cards, review history, and
  settings live entirely in your browser (text in `localStorage`, images in IndexedDB) and never leave your device. Settings and keyboard
  remaps are also mirrored to two small cookies as a recovery net (never study data).
- **A real legibility system, not just a font picker** — `<Legible>` (`src/components/Legible.tsx`) is the one
  component every card/set surface uses to apply the whole research-backed cluster at once: Settings-driven
  typeface, 11.5–13pt size, 1.4–1.5 line height, and a 55–75 character measure. Seshat's own UI intentionally
  uses a separate, fixed typeface (Fraunces/Newsreader/IBM Plex Mono) — only the material you're actually
  studying gets the legibility treatment.
- **Portable JSON everywhere** — the full Seshat format round-trips every card kind; a simpler Quizlet-style
  `[{term, definition}]` (or `{name, terms: [...]}`) format also imports and exports per set, for interop with
  plain files from other tools. One icon button imports (auto-detects the format), one exports.
- **Full-data backup** — Settings -> Backup downloads one JSON file with everything (settings, keybindings, sets,
  cards, FSRS scheduling, review history) and restores it by merging or replacing.
- **Keyboard-first** — Cmd/Ctrl+K opens a command menu to jump anywhere; footer "Keyboard shortcuts" lists every binding; navigation keys switch between Arrow keys,
  WASD and HJKL, and every action is remappable.
- **Agent-friendly** — a `?import=` URL importer, a browser-only scripting API (`window.seshat`, see below), WebMCP
  tools where the browser supports them, and JSON Schemas for imports, backups and settings.

## Tech stack

Client-only, no backend:

- [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript (strict mode)
- [react-router-dom](https://reactrouter.com) for routing — RESTfully nested: `/sets`, `/sets/:id`,
  `/sets/:id/edit`, `/sets/:id/{study,flashcards,test,learn,match}`, plus a global `/study` across every set
- [Zod](https://zod.dev) — every persisted or imported shape is validated at the storage/import boundary
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) — the FSRS scheduling engine
- [Vitest](https://vitest.dev) + Testing Library for tests

## Running it

```sh
pnpm install
pnpm run dev        # start the dev server
pnpm run build       # type-check and build for production
pnpm run test         # run the test suite
pnpm run lint          # lint with oxlint
pnpm run ci            # every gate: format, lint, types, circular, duplication, license, coverage, build, size
```

## Scripting Seshat's data

Open the browser console on the app and call `window.seshat` directly — `listSets()`, `listCards(setId)`,
`exportSet(setId)`, `exportSetSimple(setId)`, `importSet(json)`, `importSimpleJson(raw, setName?)`, `exportAll()`,
`importAll(json, mode)` (`'merge'` or `'replace'`; `importSet` and `importAll` are async), plus
`exportAllWithMedia()` / `exportSetWithMedia(setId)` which embed image bytes. It reads and writes the same `localStorage` and IndexedDB the app does, with
no server involved (a browser tab can't run an MCP server or accept incoming connections at all — there's no
listening-socket API in JS — so this is the real "browser-only, zero-backend" version of programmatic access).
Writes dispatch a `seshat:external-write` event, so an open tab updates live without a reload.

Other agent entry points, all documented in [`AGENTS.md`](./AGENTS.md) and `public/agents.txt`:

- `?import=<url-encoded JSON>` on any URL imports a set and opens it.
- WebMCP tools (`list_sets`, `import_all`, `update_settings`, ...) register on `document.modelContext` where the
  browser exposes it.
- JSON Schemas, generated from the Zod schemas at build time: `/schema/set-import.schema.json`,
  `/schema/seshat-backup.schema.json`, `/schema/seshat-settings.schema.json`. Discovery files `/llms.txt`,
  `/llms-full.txt` and `/agents.txt` link them.

## License

[GNU GPLv3](./LICENSE) — Copyright (C) 2026 David Awad. Use it, fork it, self-host it — and any distributed
modifications stay free software under the same license.

## Learn more

- In-app: `/` (what Seshat is and why, with citations), `/docs` (how it works, how data is stored), and
  `/attributions` (full citation list)
- [`research/`](./research) — the underlying learning-science and legibility research, one file per source, with
  verified links and summaries
