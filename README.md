# Seshat

Seshat is a free, open-source flashcard and spaced-repetition app. It exists because Quizlet put flashcards I
made myself behind a paywall — so instead of paying to study my own material, I built something better and gave
it away.

## Why it's different

Most flashcard apps optimize for engagement: streaks, hearts, leaderboards. Seshat optimizes for learning.
Every non-trivial product decision — recall-first card design, the spacing algorithm, the confidence prompt,
even the typography — is backed by a citation from the cognitive-science and legibility literature, not a growth
metric. See the in-app `/docs` and `/attributions` pages, or the [`research/`](./research) folder, for the
receipts.

## Core features

- **Recall-first study** — short-answer, cloze deletion, and multiple-choice card types, weighted toward
  formats that require you to produce an answer rather than just recognize one.
- **FSRS spaced scheduling** — per-card, per-learner difficulty/stability modeling (via [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)) instead of a fixed interval table, with selectable desired-retention
  presets (85% / 90% / 93%).
- **Confidence calibration** — rate your confidence on each answer and see, over time, whether that confidence
  is actually justified.
- **Local-first, zero-backend** — no account, no server, no tracking. Your decks, cards, review history, and
  settings live entirely in your browser's `localStorage` and never leave your device.
- **Research-grounded typography** — a typeface, sizing, line-height, and measure system built from the
  legibility and accessibility literature, with presets for screen reading, UI text, long-form reading, and
  print.

## Tech stack

Client-only, no backend:

- [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript (strict mode)
- [react-router-dom](https://reactrouter.com) for routing
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

## License

[MIT](./LICENSE) — Copyright (c) 2026 David Awad. Use it, fork it, self-host it.

## Learn more

- In-app: `/docs` (how Seshat works, how data is stored) and `/attributions` (full citation list)
- [`research/`](./research) — the underlying learning-science and legibility research, one file per source, with
  verified links and summaries
