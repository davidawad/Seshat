import { describe, expect, it } from 'vitest'
import { hasMath, splitMath, stripMathDelimiters } from './split'

const math = (tex: string, display = false) => ({ kind: 'math', tex, display })
const text = (value: string) => ({ kind: 'text', text: value })

describe('splitMath', () => {
  it('returns one text segment when there is no formula', () => {
    expect(splitMath('Derivative of x squared')).toEqual([text('Derivative of x squared')])
    expect(hasMath('Derivative of x squared')).toBe(false)
  })

  it('finds inline $..$ and \\(..\\) formulas', () => {
    expect(splitMath('Slope is $\\frac{dy}{dx}$ here')).toEqual([
      text('Slope is '),
      math('\\frac{dy}{dx}'),
      text(' here'),
    ])
    expect(splitMath('so \\(x^2\\)!')).toEqual([text('so '), math('x^2'), text('!')])
  })

  it('finds display $$..$$ and \\[..\\] formulas', () => {
    expect(splitMath('$$\\int_0^1 x\\,dx$$')).toEqual([math('\\int_0^1 x\\,dx', true)])
    expect(splitMath('\\[a^2+b^2=c^2\\]')).toEqual([math('a^2+b^2=c^2', true)])
  })

  it('leaves prices alone', () => {
    expect(splitMath('Costs $5 and $10 total')).toEqual([text('Costs $5 and $10 total')])
    expect(splitMath('Pay $5, get $x$ back')).toEqual([text('Pay $5, get '), math('x'), text(' back')])
  })

  it('treats \\$ as a literal dollar sign', () => {
    expect(splitMath('Price: \\$3 and \\$4')).toEqual([text('Price: $3 and $4')])
  })

  it('keeps an unclosed delimiter as text', () => {
    expect(splitMath('half open $x^2')).toEqual([text('half open $x^2')])
    expect(splitMath('empty $$ here')).toEqual([text('empty $$ here')])
  })

  it('does not end a formula at an escaped dollar', () => {
    expect(splitMath('$a \\$ b$')).toEqual([math('a \\$ b')])
  })
})

describe('stripMathDelimiters', () => {
  it('replaces formulas by their TeX source', () => {
    expect(stripMathDelimiters('d/dx $x^{n}$ is $nx^{n-1}$')).toBe('d/dx x^{n} is nx^{n-1}')
  })
})
