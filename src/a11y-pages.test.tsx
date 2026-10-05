import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { base, expectAccessible, installA11yTestEnv, renderAt, seed } from './a11y-fixtures'
import { missingTestIds } from './lib/a11y-audit'
import { TESTIDS } from './lib/testids'

installA11yTestEnv()

// Whole-App renders; see a11y-flows.test.tsx for why the timeout is explicit.
vi.setConfig({ testTimeout: 60_000 })

describe('accessibility tree: pages', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('home, empty: starter buttons are named and testids exist', () => {
    const { container } = renderAt('/')
    expectAccessible(container)
    expect(missingTestIds(container, [TESTIDS.setsBrowser, TESTIDS.setsBrowserStarterLoad])).toEqual([])
  })

  it('home with sets: card, set link and study link', () => {
    seed()
    const { container } = renderAt('/')
    expectAccessible(container)
    expect(
      missingTestIds(container, [
        TESTIDS.setsBrowserCard,
        TESTIDS.setsBrowserSetLink,
        TESTIDS.setsBrowserStudyLink,
        TESTIDS.setsBrowserEditLink,
      ]),
    ).toEqual([])
    expect(screen.getByRole('link', { name: 'Study Capitals' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /Capitals: 0 of 4 cards memorized/ })).toBeInTheDocument()
  })

  it('layout landmarks: one banner, labelled navs, one main, one contentinfo, a skip link', () => {
    seed()
    renderAt('/')
    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
    expect(screen.getByRole('navigation', { name: 'Footer' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content')
    for (const nav of screen.getAllByRole('navigation')) expect(nav).toHaveAccessibleName()
  })

  it('sets list', () => {
    seed()
    const { container } = renderAt('/sets')
    expectAccessible(container)
    expect(
      missingTestIds(container, [
        TESTIDS.setsBrowser,
        TESTIDS.setsBrowserSearch,
        TESTIDS.setsBrowserGrid,
        TESTIDS.setsBrowserCard,
        TESTIDS.setsBrowserEditLink,
        TESTIDS.setsBrowserCreate,
        TESTIDS.setsBrowserImport,
      ]),
    ).toEqual([])
  })

  it('sets list, empty: starter buttons', () => {
    const { container } = renderAt('/sets')
    expectAccessible(container)
    expect(missingTestIds(container, [TESTIDS.setsBrowserStarterLoad])).toEqual([])
  })

  it('set detail', () => {
    seed()
    const { container } = renderAt(base)
    expectAccessible(container)
    expect(
      missingTestIds(container, [
        TESTIDS.setPage,
        TESTIDS.setEditLink,
        TESTIDS.setExport,
        TESTIDS.setModeStudy,
        TESTIDS.setModeFlashcards,
        TESTIDS.setModeTest,
        TESTIDS.setModeGames,
        TESTIDS.setPreviewFlip,
        TESTIDS.setTermList,
      ]),
    ).toEqual([])
  })

  it('set edit: per-card controls have distinct names', async () => {
    seed()
    const { container } = renderAt(`${base}/edit`)
    await screen.findByTestId(TESTIDS.editPage)
    expectAccessible(container)
    expect(
      missingTestIds(container, [
        TESTIDS.editPage,
        TESTIDS.editName,
        TESTIDS.editTags,
        TESTIDS.editDescription,
        TESTIDS.editGoalDate,
        TESTIDS.editCardList,
        TESTIDS.editAddTerm,
        TESTIDS.editAddDefinition,
        TESTIDS.editAddOtherKind,
        TESTIDS.editCardEdit,
        TESTIDS.editCardDelete,
        TESTIDS.editDeleteSet,
      ]),
    ).toEqual([])
    const deletes = screen
      .getAllByRole('button', { name: /^Delete card:/ })
      .map((button) => button.getAttribute('aria-label'))
    expect(new Set(deletes).size).toBe(deletes.length)
  })
})

describe('accessibility tree: test mode, games and reference pages', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('test mode', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderAt(`${base}/test`)
    await screen.findByTestId(TESTIDS.testPage)
    expectAccessible(container)
    expect(
      missingTestIds(container, [TESTIDS.testPage, TESTIDS.testForm, TESTIDS.testQuestion, TESTIDS.testSubmit]),
    ).toEqual([])
    await user.click(screen.getByTestId(TESTIDS.testSubmit))
    expectAccessible(container)
    expect(missingTestIds(container, [TESTIDS.testScore])).toEqual([])
  })

  it('games list and each game', async () => {
    seed()
    const list = renderAt(`${base}/games`)
    await screen.findByTestId(TESTIDS.gamesPage, undefined, { timeout: 30_000 })
    expectAccessible(list.container)
    expect(
      missingTestIds(list.container, [
        TESTIDS.gamesPage,
        TESTIDS.gamesOpenMatch,
        TESTIDS.gamesOpenBlast,
        TESTIDS.gamesOpenBlocks,
      ]),
    ).toEqual([])
    expect(list.container.querySelectorAll(`[data-testid="${TESTIDS.gamesPreview}"][aria-hidden="true"]`)).toHaveLength(
      3,
    )
    list.unmount()

    const match = renderAt(`${base}/games/match`)
    await screen.findByTestId(TESTIDS.gamePage)
    expectAccessible(match.container)
    expect(missingTestIds(match.container, [TESTIDS.gamePage, TESTIDS.matchTile, TESTIDS.matchFeedback])).toEqual([])
    match.unmount()

    const blast = renderAt(`${base}/games/blast`)
    await screen.findByTestId(TESTIDS.gamePage)
    expectAccessible(blast.container)
    expect(missingTestIds(blast.container, [TESTIDS.blastOption, TESTIDS.blastFeedback])).toEqual([])
    blast.unmount()

    const blocks = renderAt(`${base}/games/blocks`)
    await screen.findByTestId(TESTIDS.gamePage)
    expectAccessible(blocks.container)
    expect(missingTestIds(blocks.container, [TESTIDS.blocksOption, TESTIDS.blocksFeedback])).toEqual([])
  })

  it('stats, docs, about, attributions and license', async () => {
    seed()
    const pages: readonly (readonly [string, readonly string[]])[] = [
      ['/stats', [TESTIDS.statsPage, TESTIDS.statsSummary, TESTIDS.statsCalibrationEmpty]],
      ['/docs', [TESTIDS.docsPage]],
      ['/releases', [TESTIDS.releasesPage, TESTIDS.releasesVersion]],
      ['/about', [TESTIDS.aboutPage]],
      ['/attributions', [TESTIDS.attributionsPage]],
      ['/licensing', [TESTIDS.licensePage]],
    ]
    for (const [path, ids] of pages) {
      const { container, unmount } = renderAt(path)
      // These routes are lazy-loaded; wait for the page to arrive.
      await screen.findByTestId(ids[0]!)
      expectAccessible(container)
      expect(missingTestIds(container, ids)).toEqual([])
      unmount()
    }
  })

  it('attribution links carry the citation title in their name', async () => {
    renderAt('/attributions')
    const links = await screen.findAllByRole('link', { name: /\(opens in a new tab\)/ })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAccessibleName(/^.+: https?:\/\//)
  })
})

describe('accessibility tree: create and import pages', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('create page: every control is named, headings in order, h1 gets focus on arrival', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderAt('/sets')
    await user.click(screen.getByRole('link', { name: 'Create' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Create a new set' })).toHaveFocus()
    expectAccessible(container)
    expect(
      missingTestIds(container, [
        TESTIDS.createPage,
        TESTIDS.createBack,
        TESTIDS.createTitle,
        TESTIDS.createDescription,
        TESTIDS.createTags,
        TESTIDS.createCardList,
        TESTIDS.createCardRow,
        TESTIDS.createTerm,
        TESTIDS.createDefinition,
        TESTIDS.createDeleteCard,
        TESTIDS.createAddCard,
        TESTIDS.createSubmit,
        TESTIDS.createSubmitPractice,
        TESTIDS.createDraftStatus,
      ]),
    ).toEqual([])
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/sets')
    for (const name of [
      'Title',
      'Description (optional)',
      'Tags (optional)',
      'Term for card 1',
      'Definition for card 2',
    ]) {
      expect(screen.getByRole('textbox', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Delete card 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add a card' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create and practice' })).toBeInTheDocument()
  })

  it('import page: dropzone, paste area and name are labelled, h1 gets focus on arrival', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderAt('/sets')
    await user.click(screen.getByRole('link', { name: 'Import' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Import a set' })).toHaveFocus()
    expectAccessible(container)
    expect(
      missingTestIds(container, [
        TESTIDS.importPage,
        TESTIDS.importBack,
        TESTIDS.importDropzone,
        TESTIDS.importFile,
        TESTIDS.importPasteName,
        TESTIDS.importPasteText,
        TESTIDS.importPreview,
        TESTIDS.importPasteSubmit,
      ]),
    ).toEqual([])
    expect(screen.getByLabelText(/upload a \.csv, \.tsv or \.txt file/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Paste terms and definitions' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Set name' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument()
  })
})
