# AGENTS.md

Instructions for a coding agent (Claude Code, Codex, Cursor, etc.) working in this repo. This file is
agent-workflow-focused — it does not repeat product/architecture context that's already in
[`README.md`](./README.md); read that first for what Seshat is, the tech stack, the routes, and the card model.

## Orientation

Seshat is a free, local-first, zero-backend flashcard/spaced-repetition app: Vite + React 19 + TypeScript
(strict) + react-router-dom + Zod + ts-fsrs, all state in the browser's `localStorage`, no server at all. If
you're asked to do something like "add these flashcards to Seshat" or "load this study material into Seshat and
quiz me," the two mechanisms below — the URL query-param importer and the `window.seshat` console API — are the
fast paths. Editing `localStorage` by hand or reverse-engineering the storage format is never necessary; use one
of these instead.

## Running it locally

Check `package.json` for the current canonical scripts before trusting this list — it can drift.

```sh
pnpm install
pnpm run dev          # start the dev server (Vite)
pnpm run build         # tsc -b && vite build — type-checks then builds
pnpm run test           # vitest run — the full test suite
pnpm run test:watch      # vitest in watch mode
pnpm run lint              # oxlint
pnpm run typecheck          # tsc -b --noEmit
pnpm run format:check        # prettier --check .
pnpm run format                # prettier --write .
pnpm run ci                     # format:check + lint + typecheck + test + build, in order — run this before
                                  # calling anything done
```

pnpm is canonical (see `packageManager` in `package.json`) — never `npm install`/`yarn` here.

No environment variables, no backend, no database, no accounts to configure — `pnpm install && pnpm run dev` is
the entire setup.

## The `window.seshat` browser-console API

For scripting an already-running instance from the browser's own console (bookmarklets, userscripts, ad hoc
one-liners). Full docs: the "Scripting Seshat's data" section of [`README.md`](./README.md#scripting-seshats-data);
implementation: `src/lib/window-api.ts`. Methods: `listSets()`, `listCards(setId)`, `exportSet(setId)`,
`exportSetSimple(setId)`, `importSet(json)`, `importSimpleJson(raw, setName?)`.

**Caveat that matters for agents:** this API reads and writes `localStorage` directly — it does not go through
React state. If the Seshat tab is open and mounted while you call it, the page won't reflect the change until it
reloads (React only reads `localStorage` once, on mount). If you're driving a browser and want the change to
show up live without a manual reload, use the URL query-param importer below instead — it goes through React's
own state via the app's store, not around it.

## URL query-param import (the fast path for a fresh set)

The recommended way to get a new set into Seshat with no file upload and no console scripting: visit a URL with
the set's JSON in the `import` query param, and the app imports it and navigates you straight to the new set's
page.

- **Param name:** `import`
- **Param value:** `encodeURIComponent(JSON.stringify(...))` — plain URL-encoded JSON, not base64. Anyone (human
  or agent) can hand-construct this with nothing beyond standard URL encoding.
- **Where to put it:** any URL in the app — it's handled once per page load regardless of route (e.g.
  `http://localhost:5173/sets?import=...` or just `http://localhost:5173/?import=...` both work).
- **What happens:** on success, the app imports the set via its live store (not `window.seshat` — see the
  caveat above, this path doesn't have it), navigates to `/sets/:id` for the new set, and strips `import` from
  the URL so a refresh doesn't re-import. On failure (malformed JSON, or JSON that matches neither accepted
  shape), it shows a brief inline error banner and leaves you on whatever page you were headed to — nothing
  crashes.
- **Implementation, if you need to extend it:** the decode/validate logic is a pure function,
  `parseImportParam` in `src/features/sets/url-import.ts` (unit-tested in the co-located
  `url-import.test.ts`); the React wiring — `useSearchParams`, the store call, navigation, error display — is
  `src/features/sets/ImportFromUrl.tsx`, mounted once in `src/components/Layout.tsx` so it fires on every route.

### Accepted JSON shapes

Both of the shapes Seshat already accepts elsewhere (file import, `window.seshat`) work here too, auto-detected
in that order — full shape tried first, simple shape as fallback:

**1. Full `ExportedSet` shape** (`exportedSetSchema` in `src/types.ts`) — round-trips every card kind including
scheduling-free cloze/mcq/image-occlusion content:

```json
{
  "seshatExportVersion": 1,
  "name": "Cell Biology Basics",
  "description": "",
  "tags": [],
  "cards": [
    {
      "prompt": "Powerhouse of the cell?",
      "content": { "kind": "short-answer", "answer": "Mitochondria", "acceptableAnswers": [] },
      "explanation": null,
      "sourceRef": null,
      "tags": []
    }
  ]
}
```

**2. Simple term/definition shape** (`parseSimpleJson` in `src/features/sets/simple-json.ts`) — a bare array,
or `{name, terms}` (also accepts `title` for `name`, and `question`/`answer` or `front`/`back` as aliases for
`term`/`definition` per entry). A bare array with no `name`/`title` field will fail the URL import specifically
(there's no UI to prompt for a name the way file import has) — always include a name for this path:

```json
{ "name": "Cell Biology Basics", "terms": [{ "term": "Powerhouse of the cell?", "definition": "Mitochondria" }] }
```

Every card imported through the simple shape becomes a `short-answer` card.

### Full example URL

Against a local dev server, for the simple-shape example above:

```
http://localhost:5173/sets?import=%7B%22name%22%3A%22Cell%20Biology%20Basics%22%2C%22terms%22%3A%5B%7B%22term%22%3A%22Powerhouse%20of%20the%20cell%3F%22%2C%22definition%22%3A%22Mitochondria%22%7D%5D%7D
```

(That's `encodeURIComponent(JSON.stringify({name: "Cell Biology Basics", terms: [{term: "Powerhouse of the cell?", definition: "Mitochondria"}]}))` appended as the `import` value — construct it the same way for any other set.)

### Size caveat — read before building a large set this way

This is client-side only, so there's no server-imposed URL length cap — but browsers do have practical ceilings.
Chrome and Firefox comfortably handle URLs in the tens of KB, but treat **~8KB as a soft target** for the whole
URL if you want this to work reliably everywhere (older browsers, URL-shortening or logging middleware in
between, etc.). That's plenty for a set of short-answer/cloze/mcq cards, but **image-occlusion cards embed a
full `data:` URL image** in their content and will blow past that ceiling almost immediately — don't use this
import path for image-occlusion cards; use the in-app editor instead (see below).

## Card kinds — which are realistic to author via URL import

| Kind              | Realistic via URL import?  | Notes                                                                                                                                                                                                                                                                                                           |
| ----------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `short-answer`    | Yes                        | The default for both accepted JSON shapes; straightforward to hand-construct.                                                                                                                                                                                                                                   |
| `cloze`           | Yes                        | `{"kind": "cloze", "text": "..."}` with deletions written as `{{answer}}` inside `text`. Full shape only — the simple shape can't express this.                                                                                                                                                                 |
| `mcq`             | Yes, for small option sets | `{"kind": "mcq", "options": [...], "correctIndex": 0}`. Full shape only. Keep option text short — it all counts against the size budget.                                                                                                                                                                        |
| `image-occlusion` | No — use the in-app editor | Requires an embedded `data:` image plus percentage-based region rectangles (`src/types.ts` `imageOcclusionContentSchema`). Blows past the practical URL-length ceiling and there's no reasonable way to hand-author occlusion regions as raw JSON. Create these at `/sets/:id/edit` in the running app instead. |

For anything beyond short-answer/cloze/mcq authored programmatically, or any image-occlusion card, drive the
running app's editor UI directly rather than trying to force it through either import path.
