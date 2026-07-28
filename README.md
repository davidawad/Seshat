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
  settings live entirely in your browser's `localStorage` and never leave your device.
- **A real legibility system, not just a font picker** — `<Legible>` (`src/components/Legible.tsx`) is the one
  component every card/set surface uses to apply the whole research-backed cluster at once: Settings-driven
  typeface, 11.5–13pt size, 1.4–1.5 line height, and a 55–75 character measure. Seshat's own UI intentionally
  uses a separate, fixed typeface (Fraunces/Newsreader/IBM Plex Mono) — only the material you're actually
  studying gets the legibility treatment.
- **Portable JSON everywhere** — the full Seshat format round-trips every card kind; a simpler Quizlet-style
  `[{term, definition}]` (or `{name, terms: [...]}`) format also imports and exports per set, for interop with
  plain files from other tools. One icon button imports (auto-detects the format), one exports.
- **A browser-only scripting API** — `window.seshat` (see below) lets any same-page script read or write your
  sets with zero backend involved.

## Tech stack

Client-only, no backend:

- [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript (strict mode)
- [react-router-dom](https://reactrouter.com) for routing — RESTfully nested: `/sets`, `/sets/:id`,
  `/sets/:id/edit`, `/sets/:id/{study,flashcards,test,match}`, plus a global `/study` across every set
- [Zod](https://zod.dev) — every persisted or imported shape is validated at the storage/import boundary
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) — the FSRS scheduling engine
- [Vitest](https://vitest.dev) + Testing Library for tests

## Running it

```sh
npm install
npm run dev        # start the dev server
npm run build       # type-check and build for production
npm run test         # run the test suite
npm run lint          # lint with oxlint
```

## Scripting Seshat's data

Open the browser console on the app and call `window.seshat` directly — `listSets()`, `listCards(setId)`,
`exportSet(setId)`, `exportSetSimple(setId)`, `importSet(json)`, `importSimpleJson(raw, setName?)`. It reads
and writes the same `localStorage` the app does, with no server involved (a browser tab can't run an MCP server
or accept incoming connections at all — there's no listening-socket API in JS — so this is the real
"browser-only, zero-backend" version of programmatic access). One caveat: if the app is open in the same tab
while a script writes through this API, reload to see the change — React only reads `localStorage` once, on
mount.

## License

[MIT](./LICENSE) — Copyright (c) 2026 David Awad. Use it, fork it, self-host it.

## Learn more

- In-app: `/` (what Seshat is and why, with citations), `/docs` (how it works, how data is stored), and
  `/attributions` (full citation list)
- [`research/`](./research) — the underlying learning-science and legibility research, one file per source, with
  verified links and summaries
