import type { ExportedSet } from '../../types'
import { SAMPLE_SET } from './sample-set'
import { parseSimpleJson } from './simple-json'
import mpepChaptersRaw from './sample-data/mpep-chapters.json?raw'
import patentBarTermsRaw from './sample-data/patent-bar-terms.json?raw'

export interface StarterSet {
  readonly id: string
  readonly label: string
  readonly set: ExportedSet
}

/**
 * Bundled test data, loaded through the exact same `parseSimpleJson` path a
 * user's own uploaded term/definition file would go through — these files
 * (src/features/sets/sample-data/*.json) double as worked examples of the
 * simple format documented on the Docs page.
 */
const fromSimpleJson = (raw: string, tags: readonly string[]): ExportedSet => {
  const result = parseSimpleJson(raw)
  if (!result.ok) throw new Error(`Bundled starter set failed to parse: ${result.error}`)
  return {
    seshatExportVersion: 1,
    name: result.value.name ?? 'Untitled set',
    description: '',
    tags: [...tags],
    cards: result.value.cards,
  }
}

export const STARTER_SETS: readonly StarterSet[] = [
  { id: 'learning-science', label: SAMPLE_SET.name, set: SAMPLE_SET },
  {
    id: 'patent-bar-terms',
    label: 'Patent Bar Key Terms (113 terms)',
    set: fromSimpleJson(patentBarTermsRaw, ['patent-bar', 'uspto']),
  },
  {
    id: 'mpep-chapters',
    label: 'MPEP Chapter Map (28 chapters)',
    set: fromSimpleJson(mpepChaptersRaw, ['patent-bar', 'mpep']),
  },
]
