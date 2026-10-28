import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { splitMath } from '../../lib/math/split'
import { typesetTex } from '../../lib/math/render'
import { normalizeAnswer } from '../study/grading'

const ROOT = 'src/features/sets/sample-data/catalog'

const jsonFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory()
      ? jsonFiles(path)
      : name.endsWith('.json') && name !== 'categories.json'
        ? [path]
        : []
  })

/** Every string field of a card that is shown to the learner (prompt, answers, options, explanation, cloze text). */
const cardStrings = (card: Record<string, unknown>): string[] => {
  const content = (card['content'] ?? {}) as Record<string, unknown>
  const options = Array.isArray(content['options']) ? (content['options'] as string[]) : []
  return [card['prompt'], card['explanation'], content['answer'], content['text'], ...options].filter(
    (value): value is string => typeof value === 'string',
  )
}

const cardsOf = (path: string): Record<string, unknown>[] => {
  const json = JSON.parse(readFileSync(path, 'utf8')) as { cards?: Record<string, unknown>[]; terms?: unknown[] }
  return json.cards ?? []
}

describe('bundled sets with LaTeX', () => {
  const files = jsonFiles(ROOT)

  it('typesets every formula in every bundled set without a MathJax error', async () => {
    const formulas = new Map<string, { file: string; display: boolean; tex: string }>()
    const found = files.flatMap((file) =>
      cardsOf(file)
        .flatMap(cardStrings)
        .flatMap(splitMath)
        .flatMap((segment) => (segment.kind === 'math' ? [{ file, display: segment.display, tex: segment.tex }] : [])),
    )
    for (const formula of found) formulas.set(`${formula.display}:${formula.tex}`, formula)

    const failures: string[] = []
    for (const { file, display, tex } of formulas.values()) {
      const markup = await typesetTex(tex, display)
      if (markup === '' || markup.includes('merror') || markup.includes('data-mjx-error'))
        failures.push(`${file}: ${tex}`)
    }
    expect(failures).toEqual([])
  }, 120_000)

  it('keeps a typeable plain form for every short answer that has a formula', () => {
    const missing: string[] = []
    for (const file of files) {
      for (const card of cardsOf(file)) {
        const content = (card['content'] ?? {}) as Record<string, unknown>
        if (content['kind'] !== 'short-answer' || typeof content['answer'] !== 'string') continue
        if (!splitMath(content['answer']).some((segment) => segment.kind === 'math')) continue
        const accepted = (content['acceptableAnswers'] as string[] | undefined) ?? []
        // At least one accepted answer is plain text a learner can type on a keyboard (no TeX commands).
        if (!accepted.some((answer) => !answer.includes('\\') && normalizeAnswer(answer) !== '')) {
          missing.push(`${file}: ${String(card['prompt'])}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
