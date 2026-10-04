import { resolve } from 'node:path'
import { build, type Plugin } from 'vite'
import { PALETTES } from '../src/features/settings/palettes.ts'

/**
 * Pre-paint theme boot.
 *
 * Problem: theme (light/dark/system), palette and custom accent used to be
 * applied only in a React effect, so a user with a non-default look saw the
 * default dark "archive" colors flash before React mounted.
 *
 * Approach: this plugin injects a small BLOCKING inline <script> into <head>
 * (build and dev, via transformIndexHtml) that reads the persisted settings
 * (localStorage app state, else the cookie mirror — same order as
 * src/lib/storage.ts), resolves the effective mode, and sets data-theme,
 * data-palette, the palette/accent/sizing CSS variables, data-typeface,
 * data-reduced-motion and <meta name="theme-color"> on <html> before first
 * paint.
 *
 * No duplicated logic: the script is NOT hand-written. It is generated at
 * plugin time by bundling vite-plugins/theme-boot-entry.ts (which calls
 * `bootTheme` from src/features/settings/theme-boot.ts) into a minified IIFE
 * with Vite's own `build` API. That module imports the very same
 * palettes.ts / contrast.ts data and decision functions the runtime's
 * `useApplyTheme` uses (resolveThemeDom + applyThemeDom), so the two cannot
 * drift; theme-boot.test.ts proves parity for every preset x mode x accent
 * by executing the generated script.
 *
 * Placement: the script replaces the `<!-- seshat:theme-boot -->` marker in
 * index.html (after charset/viewport, before any stylesheet), falling back
 * to just before </head>. The injected script is tagged data-seshat-boot, so
 * transforming twice is a no-op. The marker also yields a static fallback <meta name="theme-color">
 * generated from palette data (archive dark) for the no-JS case.
 *
 * Base path: the script reads only storage/cookies by name (no URLs), so it
 * is independent of Vite's `base` ('/seshat/' in build, '/' in dev).
 */

export const BOOT_MARKER = '<!-- seshat:theme-boot -->'
const ENTRY = resolve(import.meta.dirname, 'theme-boot-entry.ts')

/** The static no-JS fallback; the script overwrites it with the resolved color. */
export const fallbackThemeColorMeta = (): string =>
  `<meta name="theme-color" content="${PALETTES.archive.dark['--color-bg']}" />`

/** Bundles the boot entry into one minified IIFE string. */
export const buildBootScript = async (): Promise<string> => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: true,
      target: 'es2022',
      lib: { entry: ENTRY, formats: ['iife'], name: 'seshatThemeBoot' },
    },
  })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => ('output' in r ? r.output : []))
  const chunk = outputs.find((o) => o.type === 'chunk')
  if (chunk === undefined || chunk.type !== 'chunk') throw new Error('theme-boot: bundling produced no chunk')
  // An inline script must never contain a literal closing tag.
  return chunk.code.trim().replaceAll('</script', '<\\/script')
}

/** Pure html transform; `script` is the bundled code. Idempotent (marker is consumed). */
export const injectBootScript = (html: string, script: string): string => {
  const block = `${fallbackThemeColorMeta()}\n    <script data-seshat-boot>${script}</script>`
  if (html.includes('<script data-seshat-boot>')) return html
  if (html.includes(BOOT_MARKER)) return html.replace(BOOT_MARKER, () => block)
  return html.replace('</head>', () => `    ${block}\n  </head>`)
}

export const themeBoot = (): Plugin => {
  let script: Promise<string> | undefined
  return {
    name: 'seshat-theme-boot',
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        script ??= buildBootScript()
        return injectBootScript(html, await script)
      },
    },
  }
}
