/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Guard: color values live in palettes.ts / tokens.css and nowhere else, so every
 * palette (and the user's custom accent) actually themes the whole app. A hard-coded
 * literal silently ignores the palette. This test fails on any literal not allowlisted.
 */

type Allow = { readonly file: string; readonly literal: string; readonly reason: string }

/** Whole files that legitimately own color values. */
const ALLOWED_FILES: readonly string[] = [
  'src/styles/tokens.css', // the palette variables themselves
  'src/features/settings/palettes.ts', // palette definitions
]

/** Neutral, non-themable literals. Keep this short; each needs a one-line reason. */
const ALLOWLIST: readonly Allow[] = [
  {
    file: 'src/index.css',
    literal: 'rgba(0, 0, 0, 0.6)',
    reason: 'modal backdrop scrim: neutral black dim, same in every palette',
  },
  { file: 'src/index.css', literal: 'rgba(0, 0, 0, 0.2)', reason: 'neutral drop shadow, not a themed color' },
  { file: 'src/index.css', literal: 'rgba(0, 0, 0, 0.3)', reason: 'neutral drop shadow, not a themed color' },
  {
    file: 'src/features/settings/contrast.ts',
    literal: '#000000',
    reason: 'black/white candidates for auto-contrast math',
  },
  {
    file: 'src/features/settings/contrast.ts',
    literal: '#ffffff',
    reason: 'black/white candidates for auto-contrast math',
  },
  {
    file: 'src/features/settings/accentStatus.ts',
    literal: '#000000',
    reason: 'compared against contrast.ts output to name black vs white',
  },
  {
    file: 'src/features/settings/accentStatus.ts',
    literal: '#3a7bd5',
    reason: 'example hex shown in validation message text',
  },
  {
    file: 'src/features/settings/PaletteField.tsx',
    literal: '#3a7bd5',
    reason: 'input placeholder example, not applied as a style',
  },
]

const NAMED_COLORS = (
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood ' +
  'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray ' +
  'darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
  'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue ' +
  'firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew ' +
  'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
  'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
  'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue ' +
  'mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred ' +
  'midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
  'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
  'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue ' +
  'slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white ' +
  'whitesmoke yellow yellowgreen'
).split(' ')

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g
const FUNC = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)/g
const NAMED = new RegExp(`(?<![\\w#.-])(?:${NAMED_COLORS.join('|')})(?![\\w(-])`, 'gi')
const COLOR_PROP =
  /^(?:--[\w-]+|color|background(?:-[\w-]+)?|border(?:-[\w-]+)?|outline(?:-[\w-]+)?|fill|stroke|stop-color|flood-color|caret-color|accent-color|box-shadow|text-shadow|text-decoration(?:-[\w-]+)?|column-rule(?:-[\w-]+)?)$/

type Hit = { file: string; line: number; literal: string }

const blank = (m: string): string => m.replace(/[^\n]/g, ' ')

const stripComments = (src: string, isCss: boolean): string => {
  const block = src.replace(/\/\*[\s\S]*?\*\//g, blank)
  return isCss ? block : block.replace(/(^|[^:\w'"`])\/\/[^\n]*/g, (m, p: string) => p + blank(m.slice(p.length)))
}

const stripCssNoise = (value: string): string => value.replace(/(?:var|url)\([^)]*\)/g, (m) => ' '.repeat(m.length))

const namedIn = (decl: RegExpExecArray | null): string[] => {
  if (decl === null || !COLOR_PROP.test(decl[1] ?? '')) return []
  const value = (decl[2] ?? '').replace(/(["']).*?\1/g, '')
  return [...value.matchAll(NAMED)].map((m) => m[0])
}

const lineLiterals = (line: string, isCss: boolean): string[] => {
  const decl = isCss ? /^\s*([-\w]+)\s*:(.*)$/.exec(line) : null
  // `#fff` as a CSS id selector is not a color; in CSS only look inside declarations.
  if (isCss && decl === null) return []
  const colors = [...line.matchAll(HEX), ...line.matchAll(FUNC)].map((m) => m[0])
  return [...colors, ...namedIn(decl)]
}

const scan = (file: string, text: string): Hit[] => {
  const isCss = file.endsWith('.css')
  return stripComments(text, isCss)
    .split('\n')
    .flatMap((raw, i) =>
      lineLiterals(isCss ? stripCssNoise(raw) : raw, isCss).map((literal) => ({ file, line: i + 1, literal })),
    )
}

const isAllowed = (h: Hit): boolean =>
  ALLOWED_FILES.includes(h.file) || ALLOWLIST.some((a) => a.file === h.file && a.literal === h.literal)

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  )

// Read from disk (not import.meta.glob ?raw): vitest stubs CSS modules to empty strings.
const sources = walk('src').filter((f) => /\.(css|tsx?)$/.test(f) && !/\.test\.tsx?$/.test(f))

const allHits = (): Hit[] => sources.flatMap((f) => scan(f, readFileSync(f, 'utf8')))

describe('color literals', () => {
  it('only appear in tokens.css, palettes.ts, or the explicit allowlist', () => {
    const violations = allHits().filter((h) => !isAllowed(h))
    const report = violations.map((v) => `  ${v.file}:${v.line}  ${v.literal}`).join('\n')
    const message =
      `Hard-coded color literals ignore the user's palette:\n${report}\n` +
      'Fix: use a token (var(--color-fg), var(--color-accent), ...) or derive one with ' +
      'color-mix(in srgb, var(--color-x) 20%, transparent). Only neutral, non-themable ' +
      'effects (black shadows/scrims) may be added to ALLOWLIST in src/styles/color-literals.test.ts, with a reason.'
    expect(violations.length === 0 ? '' : message).toBe('')
  })

  it('allowlist has no stale entries and every entry has a reason', () => {
    const all = allHits()
    const stale = ALLOWLIST.filter(
      (a) => a.reason.trim() === '' || !all.some((h) => h.file === a.file && h.literal === a.literal),
    )
    expect(stale).toEqual([])
  })

  it('detector catches the literal shapes it claims to', () => {
    const css = scan(
      'x.css',
      'a {\n color: #fff;\n background: rgb(1 2 3);\n border: 1px solid red;\n outline-color: var(--color-red);\n}',
    )
    expect(css.map((h) => h.literal)).toEqual(['#fff', 'rgb(1 2 3)', 'red'])
    expect(scan('x.css', 'a {\n color: currentColor;\n background: transparent;\n}\n#abc { margin: 0 }')).toEqual([])
    expect(scan('x.tsx', 'const s = { background: "#123456" } // #fff')).toHaveLength(1)
  })
})
