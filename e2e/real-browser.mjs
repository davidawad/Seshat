// Real-browser accessibility + WebMCP check (bead seshat-8dc). NOT part of `pnpm run ci`:
// it launches Chromium and a preview server. Run via `just e2e` (builds first).
// Uses Playwright's bundled Chromium; install once with `pnpm exec playwright-core install chromium`.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { chromium } from 'playwright-core'

const require = createRequire(import.meta.url)
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const PORT = 4179
const BASE = `http://127.0.0.1:${PORT}/seshat`
const INTERACTIVE = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'combobox',
  'switch',
  'radio',
  'checkbox',
  'slider',
  'spinbutton',
  'tab',
  'menuitem',
  'option',
])

const failures = []
const fail = (where, what) => {
  failures.push(`${where}: ${what}`)
  console.log(`FAIL ${where}: ${what}`)
}
const pass = (what) => console.log(`ok   ${what}`)
const check = (where, condition, what) => (condition ? pass(`${where}: ${what}`) : fail(where, what))

const server = spawn(
  'pnpm',
  ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
  { stdio: 'ignore', detached: true },
)
const waitForServer = async () => {
  for (let i = 0; i < 60; i += 1) {
    try {
      // nosemgrep: react-insecure-request -- local preview server readiness probe
      if ((await fetch(`${BASE}/`)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('vite preview did not start (run `pnpm run build` first)')
}

// Names come from the browser's own accessibility tree (CDP), not from our DOM heuristics.
const unnamedInAxTree = async (page) => {
  const cdp = await page.context().newCDPSession(page)
  const { nodes } = await cdp.send('Accessibility.getFullAXTree')
  await cdp.detach()
  return nodes
    .filter((n) => !n.ignored && INTERACTIVE.has(n.role?.value) && !(n.name?.value ?? '').trim())
    .map((n) => n.role.value)
}

const axeViolations = async (page) => {
  await page.evaluate(axeSource)
  return page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations)
}

const settle = (page, ms = 300) => page.waitForTimeout(ms)

const checkAccessibility = async (page, setId) => {
  const routes = [
    '/',
    '/sets',
    `/sets/${setId}`,
    `/sets/${setId}/flashcards`,
    `/sets/${setId}/study`,
    `/sets/${setId}/games`,
    '/docs',
    '/about',
    '/attributions',
  ]
  for (const route of routes) {
    await page.goto(`${BASE}${route}`)
    await page.waitForSelector('main')
    await settle(page)
    const violations = await axeViolations(page)
    for (const v of violations) {
      fail(`axe ${route}`, `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(' ')}`)
    }
    if (violations.length === 0) pass(`axe ${route}: no violations`)
    const unnamed = await unnamedInAxTree(page)
    check(
      `ax-tree ${route}`,
      unnamed.length === 0,
      `every interactive control named${unnamed.length ? ` (unnamed: ${unnamed.join(',')})` : ''}`,
    )
  }
}

const checkRouteFocus = async (page) => {
  // Focus moves to the h1 on client-side route change.
  await page.goto(`${BASE}/`)
  for (const [testid, label] of [
    ['nav-sets', 'sets'],
    ['nav-stats', 'stats'],
    ['footer-docs', 'docs'],
    ['footer-about', 'about'],
  ]) {
    await page.getByTestId(testid).click()
    await settle(page, 400)
    const tag = await page.evaluate(() => document.activeElement?.tagName)
    check('route focus', tag === 'H1', `focus on h1 after navigating to ${label} (got ${tag})`)
  }
}

const checkKeyboardFlashcards = async (page, setId) => {
  // Keyboard-only flashcards: flip (Space), grade (2 = know).
  await page.goto(`${BASE}/sets/${setId}/flashcards`)
  await page.getByTestId('flashcard-face').waitFor()
  const tally = () => page.getByTestId('flashcard-tally-know').innerText()
  const before = await tally()
  await page.keyboard.press('Space')
  await settle(page)
  await page.keyboard.press('2')
  await settle(page)
  const after = await tally()
  check('keyboard flashcards', before !== after, `Space then 2 graded Know (${before.trim()} -> ${after.trim()})`)
}

const checkKeyboardStudy = async (page, setId) => {
  // Keyboard-only study: type answer, Enter, confidence 3.
  await page.goto(`${BASE}/sets/${setId}/study`)
  await page.getByTestId('study-page').waitFor()
  if ((await page.getByTestId('study-answer-input').count()) > 0) {
    await page.getByTestId('study-answer-input').fill('Paris')
    await page.keyboard.press('Enter')
    await settle(page)
    await page.keyboard.press('3')
    await settle(page)
    check(
      'keyboard study',
      (await page.getByTestId('study-result').count()) > 0,
      'answer, Enter, confidence key reaches the grading step',
    )
  } else {
    pass('keyboard study: first card is not typed-answer (skipped)')
  }
}

const checkPalette = async (page) => {
  // Command palette via Ctrl+K and Meta+K; Escape closes it.
  for (const mod of ['Control', 'Meta']) {
    await page.goto(`${BASE}/`)
    await page.getByTestId('nav-sets').focus()
    await page.keyboard.press(`${mod}+k`)
    const opened = await page
      .getByTestId('palette-input')
      .waitFor({ timeout: 3000 })
      .then(
        () => true,
        () => false,
      )
    check('palette', opened, `${mod}+K opens the command menu`)
    if (opened) {
      const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
      check('palette', focused === 'palette-input', `input focused on open (got ${focused})`)
      await page.keyboard.press('Escape')
      await settle(page)
      check('palette', (await page.getByTestId('palette-input').count()) === 0, `${mod}+K palette closes on Escape`)
    }
  }
}

const checkWindowApiAndWebMcp = async (page, setId) => {
  // window.seshat + WebMCP in the real browser.
  await page.goto(`${BASE}/`)
  await settle(page, 500)
  const sets = await page.evaluate(() => window.seshat.listSets())
  check(
    'window.seshat',
    sets.some((s) => s.id === setId),
    'listSets returns the seeded set',
  )
  const surfaces = await page.evaluate(() => ({
    document: typeof document.modelContext,
    navigator: typeof navigator.modelContext,
    version: navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0],
  }))
  console.log(`info WebMCP surfaces: ${JSON.stringify(surfaces)}`)
  // Chrome's native WebMCP: getTools() yields RegisteredTool objects, executeTool(tool, jsonString).
  const callTool = (name, args) =>
    page.evaluate(
      async ([toolName, input]) => {
        const context = document.modelContext ?? navigator.modelContext
        const tool = (await context.getTools()).find((candidate) => candidate.name === toolName)
        if (tool === undefined) return null
        return context.executeTool(tool, JSON.stringify(input))
      },
      [name, args],
    )
  if (surfaces.document === 'undefined' && surfaces.navigator === 'undefined') {
    fail('webmcp', 'this Chromium exposes no modelContext (flag not honoured); tools not exercised')
  } else {
    const names = await page.evaluate(async () =>
      (await (document.modelContext ?? navigator.modelContext).getTools()).map((tool) => tool.name),
    )
    console.log(`info registered tools: ${JSON.stringify(names)}`)
    const expected = [
      'list_sets',
      'list_cards',
      'get_settings',
      'update_settings',
      'import_set',
      'export_set',
      'export_all',
      'import_all',
      'navigate',
    ]
    const missing = expected.filter((name) => !names.includes(name))
    check(
      'webmcp',
      missing.length === 0,
      `all tools registered${missing.length ? ` (missing: ${missing.join(',')})` : ''}`,
    )
    const listed = await callTool('list_sets', {})
    check('webmcp', JSON.stringify(listed).includes('E2E Capitals'), 'list_sets executes and returns the seeded set')
    const cards = await callTool('list_cards', { setId })
    check('webmcp', JSON.stringify(cards).includes('Paris'), 'list_cards executes and returns the seeded cards')
    const bad = await callTool('list_cards', { setId: 'not-a-set' })
    check(
      'webmcp',
      bad?.isError === true || JSON.stringify(bad).includes('error'),
      'bad arguments return a structured error',
    )
    await callTool('navigate', { to: 'docs' })
    await settle(page, 500)
    check('webmcp', page.url().endsWith('/docs'), 'navigate tool changes the route')
  }
}

const main = async () => {
  await waitForServer()
  const browser = await chromium.launch({
    args: ['--enable-features=WebMCP,WebMCPTesting', '--enable-experimental-web-platform-features'],
  })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto(`${BASE}/`)
  await page.waitForFunction(() => typeof window.seshat?.importSimpleJson === 'function')
  const seeded = await page.evaluate(() =>
    window.seshat.importSimpleJson(
      JSON.stringify([
        { term: 'France', definition: 'Paris' },
        { term: 'Japan', definition: 'Tokyo' },
        { term: 'Egypt', definition: 'Cairo' },
        { term: 'Peru', definition: 'Lima' },
      ]),
      'E2E Capitals',
    ),
  )
  check('seed', seeded.ok === true, `window.seshat.importSimpleJson ok (${JSON.stringify(seeded).slice(0, 90)})`)
  const setId = seeded.value?.id
  await page.reload()

  await checkAccessibility(page, setId)
  await checkRouteFocus(page)
  await checkKeyboardFlashcards(page, setId)
  await checkKeyboardStudy(page, setId)
  await checkPalette(page)
  await checkWindowApiAndWebMcp(page, setId)

  check('console', errors.length === 0, `no uncaught page errors${errors.length ? `: ${errors[0]}` : ''}`)
  await browser.close()
}

try {
  await main()
} catch (e) {
  fail('script', String(e))
} finally {
  process.kill(-server.pid)
}
console.log(failures.length ? `\n${failures.length} failure(s)` : '\nall checks passed')
process.exit(failures.length ? 1 : 0)
