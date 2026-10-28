import { mathjax } from '@mathjax/src/js/mathjax.js'
import { TeX } from '@mathjax/src/js/input/tex.js'
import { SVG } from '@mathjax/src/js/output/svg.js'
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js'
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js'
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js'
import '@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js'

/**
 * MathJax 4 typesetter: TeX in, self-contained SVG markup out. Everything is bundled (no CDN, in keeping with the
 * no-server promise) and this module is only ever imported lazily, so the MathJax code stays out of the entry
 * bundle. Glyph tables for rarer alphabets (blackboard bold, script, ...) are separate files MathJax asks for on
 * demand; `asyncLoad` serves them from the font package as their own chunks.
 */

const FONT_FILES = import.meta.glob('/node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/*.js')

mathjax.asyncLoad = (name: string) => {
  const load = FONT_FILES[`/node_modules/${name.replace('/js/', '/mjs/')}`]
  return load === undefined ? Promise.reject(new Error(`MathJax font file not bundled: ${name}`)) : load()
}

const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)

// No `html` or `require` packages: formulas come from imported sets and must not be able to emit links or load code.
const document = mathjax.document('', {
  InputJax: new TeX({ packages: ['base', 'ams', 'noundefined'] }),
  OutputJax: new SVG({ fontCache: 'none' }),
})

const cache = new Map<string, Promise<string>>()

/** The SVG markup for `tex` (cached per formula and display mode). Never rejects: bad TeX renders as its source. */
export const typesetTex = (tex: string, display: boolean): Promise<string> => {
  const key = `${display ? 'D' : 'I'}:${tex}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const pending = mathjax
    .handleRetriesFor(() => adaptor.innerHTML(document.convert(tex, { display })))
    .then((markup: string) => markup)
  const safe = pending.catch(() => '')
  cache.set(key, safe)
  return safe
}
