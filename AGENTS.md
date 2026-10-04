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
pnpm run ci                     # format:check + lint + typecheck + circular + duplication + license +
                                  # test:coverage + build + size — run this before calling anything done
pnpm run knip                    # unused files/exports (a commit gate, not part of ci)
```

pnpm is canonical (see `packageManager` in `package.json`) — never `npm install`/`yarn` here.

No environment variables, no backend, no database, no accounts to configure — `pnpm install && pnpm run dev` is
the entire setup.

## The `window.seshat` browser-console API

For scripting an already-running instance from the browser's own console (bookmarklets, userscripts, ad hoc
one-liners). Full docs: the "Scripting Seshat's data" section of [`README.md`](./README.md#scripting-seshats-data);
implementation: `src/lib/window-api.ts`. Methods: `listSets()`, `listCards(setId)`, `exportSet(setId)`,
`exportSetSimple(setId)`, `importSet(json)`, `importSimpleJson(raw, setName?)`, `exportAll()`,
`importAll(json, mode)` (`mode` is `'merge'` or `'replace'`).

**How it reaches the page:** this API reads and writes `localStorage` directly, then dispatches a
`seshat:external-write` window event (`notifyExternalWrite` in `src/lib/persistence.ts`); the app's store listens
for it and re-hydrates, so an open tab updates live without a reload. `importSet` takes a parsed object;
`importSimpleJson` and `importAll` take a JSON string; `importAll` returns `{ ok, value: report }` or
`{ ok: false, error }`. The URL query-param importer below and the WebMCP tools go through the app's store
directly.

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

## WebMCP tools

Where the browser supports WebMCP, the app registers structured tools an agent can call instead of clicking.
Implementation: `src/lib/webmcp.ts` (pure, tested) mounted once by `src/lib/useWebMcp.ts` in `Layout.tsx`. Built
against the W3C WebML CG draft of 2 October 2026: entry point is `document.modelContext` (the older
`navigator.modelContext` is the fallback, see `detectModelContext`), tools are registered with
`registerTool(tool, { signal })` and unregistered by aborting the signal (StrictMode-safe), and results are
`{ content: [{ type: 'text', text }] }` with `isError` on failure. Chrome only ships it behind a flag, so nothing
registers elsewhere.

| Tool              | Input                                                      | Annotations                        |
| ----------------- | ---------------------------------------------------------- | ---------------------------------- |
| `list_sets`       | none                                                       | readOnlyHint, untrustedContentHint |
| `list_cards`      | `{setId}`                                                  | readOnlyHint, untrustedContentHint |
| `get_settings`    | none                                                       | readOnlyHint                       |
| `update_settings` | `{patch}` (any subset of settings)                         | none                               |
| `import_set`      | `{json}` (simple or full set JSON string)                  | none                               |
| `export_set`      | `{setId}`                                                  | readOnlyHint, untrustedContentHint |
| `export_all`      | none                                                       | readOnlyHint, untrustedContentHint |
| `import_all`      | `{json, mode}` (`merge` default / `replace`)               | consequentialHint                  |
| `navigate`        | `{to, setId?}` (`to`: home, sets, stats, docs, about, set) | none                               |

`list_cards` omits image bytes: an image-occlusion card's `content` has `image: { hasImage, approxBytes, mime }`
instead of `imageDataUrl` (regions and labels are kept). `export_set` and `export_all` return full data,
including image data URLs, and can be very large.

Each tool's Zod schema yields both its JSON Schema and its runtime validation. Security: the spec's security
section is unresolved, so agent input is untrusted: arguments are strict objects (unknown keys rejected),
string payloads are capped at 25M characters (`MAX_BACKUP_CHARS`), `update_settings` rejects the whole call on any
bad field and only applies keys actually sent, `replace` is destructive and flagged `consequentialHint`, errors
come back as `{ error }` values and never throw, and card text in results is flagged `untrustedContentHint`.
All writes go through the React store, so an open tab updates live.

## Full-data backup

One JSON file with settings, keybinding overrides, sets, cards (FSRS scheduling kept) and review history:
`{ format: 'seshat-backup', version: 1, appVersion, exportedAt, settings, keybindings, sets, cards, reviewLog }`.
Export/restore from Settings -> Backup (merge or replace), `window.seshat.exportAll()/importAll(json, mode)`, or the
`export_all`/`import_all` tools. `merge` (default) only adds sets/cards whose ids are missing, plus the review
history of added cards; it never touches existing data, settings or keybindings. `replace` swaps everything.
`parseBackup` (`src/lib/backup.ts`) is strict: unknown fields rejected, unique ids, cards need a set, log entries
need a card, `settings` may be partial, size-capped, newer versions refused, older versions migrated via
`MIGRATIONS` (bump `BACKUP_VERSION` and add a step when the format changes).

JSON Schemas are generated from the Zod schemas by the agent-files plugin and served at
`/schema/set-import.schema.json`, `/schema/seshat-backup.schema.json` and `/schema/seshat-settings.schema.json`
(draft 2020-12; the settings schema lists every field's enum/range/default). Change a Zod schema and the served
schema follows; `vite-plugins/agent-files.test.ts` checks parity.

## Settings, cookie mirror and keybindings

- Settings: `settingsSchema` in `src/types.ts` (typeface, size, line height, measure, theme, palette,
  `customAccent`, `reducedMotion`, retention, `selfExplanationEnabled`, `experimentalGamesEnabled`,
  `flashcardsTrackProgress`, `flashcardsFront`, `installPromptEnabled`). Add a field there with a `.default()` so old
  saves and backups still parse.
- Cookie mirror (`src/lib/persistence.ts`): settings and keybinding overrides only (never study data) are mirrored to
  the cookies `seshat_settings` and `seshat_keys`, read only when localStorage has no copy, and re-validated with
  the same schemas. Encoded budget 3500 characters per cookie (over budget drops the cookie); `Path` = deploy base,
  `Max-Age` 400 days, `SameSite=Lax`, `Secure` on https. Cookies are shared per host, not per port: dev servers on
  different ports of `localhost` see each other's cookies (localStorage stays per origin), so test a "fresh
  profile" with a new host or cleared cookies.
- Keyboard model (`src/lib/keybindings.ts`): every action is in `KEYBINDING_REGISTRY` (id, default key, label,
  scope); overrides live in localStorage `seshat:keybindings:v1` (and the cookie) and only differ-from-default
  entries are stored, so an agent reads live bindings from `exportAll().keybindings` plus the registry defaults.
  Navigation preset (`NAV_PRESETS`): Arrow keys, WASD, HJKL, remapped together. Number keys select numbered items
  (set modes 1-4, games 1-5, MCQ options, match tiles 1-9, confidence 1-3, grades 1-4). Flashcards: Space flips,
  1/Left still learning, 2/Right know, U undo, O toggle shuffled/original order. The footer "Keyboard shortcuts"
  modal lists everything with current bindings; `?` opens Settings; Cmd/Ctrl+K (`global.openPalette`, works
  from text fields too) opens the cmdk command menu in `src/features/palette/` (lazy-loaded; pages, sets, actions). Add a shortcut by adding a registry entry (the
  test enforces no same-scope default collisions); never hard-code a key.
- Flashcards Options: `flashcardsTrackProgress` (default on; off = grading only advances the session, no FSRS or
  review-log change) and `flashcardsFront` (`term` | `definition`). Undo restores the previous scheduling and removes
  that review-log entry.

## Beads Issue Tracker

This project uses **br (beads_rust)** for issue tracking — a local-first
SQLite+JSONL tracker, no background daemon (migrated from bd/Dolt,
2026-08-25). Run `br robot-docs guide` to see full workflow context and
commands (br's closest equivalent to bd's `prime`; br has no `prime`
subcommand, and there is no br-generated skill file — the
`.agents/skills/beads/` bd-vendored skill directory has been removed).
Issue ids keep the same `Seshat-` prefix as before the migration (lowercased
to `seshat-` internally — br always lowercases its issue-id prefix, unlike
bd).

### Quick Reference

```bash
br ready                # Find available work
br show <id>            # View issue details
br update <id> --claim  # Claim work
br close <id>           # Complete work
```

### Rules

- Use `br` for all task tracking; do not create markdown TODO lists.
- Run `br robot-docs guide` when br workflow context is needed — there is no automatic session-start hook (removed along with bd's, since br has no native-hook integration of its own).
- **bd's `bd remember` persistent-memory feature has NO br equivalent** — do not assume memories work; use MEMORY.md-style files instead if you need durable notes.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `br` for task tracking. Do not run git commits or git pushes unless explicitly asked (`br` itself never runs git). At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `br robot-docs guide`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**

- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.

**Architecture in one line:** issues live in a local SQLite DB (`.beads/beads.db`);
`.beads/issues.jsonl` is br's own JSONL export (kept current on every mutating
command, gitignored here). No git-remote sync mechanism (unlike bd's Dolt
`refs/dolt/data`) and no background daemon (unlike bd's Dolt sql-server).
See https://github.com/Dicklesworthstone/beads_rust for details.
