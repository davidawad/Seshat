/** A run of card text: plain prose, or a LaTeX formula to typeset. */
export type MathSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'math'; readonly tex: string; readonly display: boolean }

/**
 * Delimiters, tried in order at each position: `$$..$$` and `\[..\]` (display), `$..$` and `\(..\)`
 * (inline). A literal dollar sign is written `\$`. To keep prices like "$5 and $10" as prose, a single
 * `$` only opens math when the next character is not whitespace, and only closes it when the previous
 * character is not whitespace and the next is not a digit (the pandoc rule).
 */
const isSpace = (char: string | undefined): boolean => char === undefined || /\s/.test(char)
const isDigit = (char: string | undefined): boolean => char !== undefined && /[0-9]/.test(char)

/** Index of the first unescaped `needle` at or after `from`, or -1. */
const findClose = (text: string, needle: string, from: number): number => {
  for (let i = from; i < text.length; i++) {
    if (text.startsWith(needle, i)) return i
    if (text[i] === '\\') i += 1
  }
  return -1
}

/** Index of the closing single `$` for an opener at `open`, honouring the pandoc rule, or -1. */
const findDollarClose = (text: string, open: number): number => {
  for (let i = open + 1; i < text.length; i++) {
    if (text[i] === '\\') {
      i += 1
      continue
    }
    if (text[i] === '$' && !isSpace(text[i - 1]) && !isDigit(text[i + 1])) return i
    if (text[i] === '$') return -1
  }
  return -1
}

const FENCES = [
  { open: '$$', close: '$$', display: true },
  { open: '\\[', close: '\\]', display: true },
  { open: '\\(', close: '\\)', display: false },
] as const

interface MathMatch {
  readonly tex: string
  readonly display: boolean
  /** Index just past the closing delimiter. */
  readonly next: number
}

/** The formula that starts at `i`, if one does (fenced `$$`, `\\[`, `\\(`, or a single `$`). */
const matchMath = (text: string, i: number): MathMatch | null => {
  for (const fence of FENCES) {
    if (!text.startsWith(fence.open, i)) continue
    const end = findClose(text, fence.close, i + fence.open.length)
    const tex = end === -1 ? '' : text.slice(i + fence.open.length, end).trim()
    if (tex !== '') return { tex, display: fence.display, next: end + fence.close.length }
  }
  if (text[i] !== '$' || isSpace(text[i + 1])) return null
  const end = findDollarClose(text, i)
  return end > i + 1 ? { tex: text.slice(i + 1, end), display: false, next: end + 1 } : null
}

export const splitMath = (text: string): MathSegment[] => {
  const out: MathSegment[] = []
  let plain = ''
  const flush = () => {
    if (plain !== '') out.push({ kind: 'text', text: plain })
    plain = ''
  }

  let i = 0
  while (i < text.length) {
    if (text.startsWith('\\$', i)) {
      plain += '$'
      i += 2
      continue
    }
    const found = matchMath(text, i)
    if (found === null) {
      plain += text[i]
      i += 1
      continue
    }
    flush()
    out.push({ kind: 'math', tex: found.tex, display: found.display })
    i = found.next
  }
  flush()
  return out
}

/** Whether the text contains any formula (cheap pre-check so plain cards never load MathJax). */
export const hasMath = (text: string): boolean => splitMath(text).some((segment) => segment.kind === 'math')

/** The text with formulas replaced by their TeX source, for places that cannot typeset (aria-labels, grading). */
export const stripMathDelimiters = (text: string): string =>
  splitMath(text)
    .map((segment) => (segment.kind === 'math' ? segment.tex : segment.text))
    .join('')
