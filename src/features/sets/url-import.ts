import { type ExportedSet, type Result, err, exportedSetSchema, ok } from '../../types'
import { parseSimpleJson } from './simple-json'

/**
 * Parses the value of Seshat's `?import=` query param into an `ExportedSet`
 * — the "quick, agent-friendly" onboarding path: visit a URL with a set's
 * JSON in `import` and land on a populated set with zero file upload or
 * console scripting. See `src/features/sets/ImportFromUrl.tsx` for the
 * effect that wires this into the app, and `AGENTS.md` / `public/agents.txt`
 * for the full external contract (exact param name, both JSON shapes, size
 * caveat).
 *
 * `raw` is the value exactly as `useSearchParams().get('import')` returns
 * it — react-router already URL-decodes query params, so the only decoding
 * this function does itself is `JSON.parse`. Callers pass plain
 * `encodeURIComponent(JSON.stringify(...))` JSON in the URL, not base64 —
 * deliberately something a human or agent can hand-construct with no extra
 * encoding step beyond what every URL needs anyway.
 *
 * Accepts either of the two shapes Seshat already imports elsewhere,
 * auto-detected the same way `ImportPanel.tsx`'s file import does: try the
 * full round-trip `exportedSetSchema` first (preserves cloze/mcq/
 * image-occlusion), then fall back to `parseSimpleJson`'s portable
 * `{term, definition}` format.
 *
 * Total and pure: every input maps to an output, no exceptions escape.
 * `raw === null` (no `import` param present — the overwhelmingly common
 * case) returns `null` as a distinct "nothing to do" signal, separate from
 * `Result`'s ok/err — callers should no-op on `null` rather than treating
 * it as failure.
 */
export const parseImportParam = (raw: string | null): Result<ExportedSet, string> | null => {
  if (raw === null) return null

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch (error) {
    return err(`That import link isn't valid JSON (${error instanceof Error ? error.message : 'parse error'}).`)
  }

  const rich = exportedSetSchema.safeParse(parsedJson)
  if (rich.success) return ok(rich.data)

  const simple = parseSimpleJson(raw)
  if (simple.ok) {
    if (simple.value.name === null) {
      return err(
        'That import link has no set name — use a {"name": ..., "terms": [...]} shape (a bare array has nowhere to put one).',
      )
    }
    return ok({
      seshatExportVersion: 1,
      name: simple.value.name,
      description: '',
      tags: [],
      cards: simple.value.cards,
    })
  }

  return err(
    "That import link's JSON doesn't match either format Seshat understands: Seshat's own set export, or {term, definition} pairs.",
  )
}
