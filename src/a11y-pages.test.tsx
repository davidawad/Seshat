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
    expect(missingTestIds(container, [TESTIDS.homePage, TESTIDS.homeStarterLoad, TESTIDS.homeManageSets])).toEqual([])
  })

  it('home with sets: card, set link and study link', () => {
    seed()
    const { container } = renderAt('/')
    expectAccessible(container)
    expect(missingTestIds(container, [TESTIDS.homeSetCard, TESTIDS.homeSetLink, TESTIDS.homeStudyLink])).toEqual([])
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
        TESTIDS.setsPage,
        TESTIDS.setsSearch,
        TESTIDS.setsList,
        TESTIDS.setsListItem,
        TESTIDS.setsEditLink,
        TESTIDS.setsNewButton,
        TESTIDS.importSetButton,
      ]),
    ).toEqual([])
  })

  it('sets list, empty: starter buttons', () => {
    const { container } = renderAt('/sets')
    expectAccessible(container)
    expect(missingTestIds(container, [TESTIDS.setsStarterLoad])).toEqual([])
  })

  it('new set form and import panel expose their fields', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderAt('/sets')
    await user.click(screen.getByTestId(TESTIDS.setsNewButton))
    await user.click(screen.getByTestId(TESTIDS.importSetButton))
    expectAccessible(container)
    expect(
      missingTestIds(container, [
        TESTIDS.setsNewName,
        TESTIDS.setsNewSubmit,
        TESTIDS.setsNewCancel,
        TESTIDS.importPanel,
        TESTIDS.importFile,
        TESTIDS.importPasteName,
        TESTIDS.importPasteText,
        TESTIDS.importPasteSubmit,
      ]),
    ).toEqual([])
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

  it('set edit: per-card controls have distinct names', () => {
    seed()
    const { container } = renderAt(`${base}/edit`)
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
    expectAccessible(container)
    expect(
      missingTestIds(container, [TESTIDS.testPage, TESTIDS.testForm, TESTIDS.testQuestion, TESTIDS.testSubmit]),
    ).toEqual([])
    await user.click(screen.getByTestId(TESTIDS.testSubmit))
    expectAccessible(container)
    expect(missingTestIds(container, [TESTIDS.testScore])).toEqual([])
  })

  it('games list and each game', () => {
    seed()
    const list = renderAt(`${base}/games`)
    expectAccessible(list.container)
    expect(
      missingTestIds(list.container, [
        TESTIDS.gamesPage,
        TESTIDS.gamesOpenMatch,
        TESTIDS.gamesOpenBlast,
        TESTIDS.gamesOpenBlocks,
      ]),
    ).toEqual([])
    list.unmount()

    const match = renderAt(`${base}/games/match`)
    expectAccessible(match.container)
    expect(missingTestIds(match.container, [TESTIDS.gamePage, TESTIDS.matchTile, TESTIDS.matchFeedback])).toEqual([])
    match.unmount()

    const blast = renderAt(`${base}/games/blast`)
    expectAccessible(blast.container)
    expect(missingTestIds(blast.container, [TESTIDS.blastOption, TESTIDS.blastFeedback])).toEqual([])
    blast.unmount()

    const blocks = renderAt(`${base}/games/blocks`)
    expectAccessible(blocks.container)
    expect(missingTestIds(blocks.container, [TESTIDS.blocksOption, TESTIDS.blocksFeedback])).toEqual([])
  })

  it('stats, docs, about, attributions and license', () => {
    seed()
    const pages: readonly (readonly [string, readonly string[]])[] = [
      ['/stats', [TESTIDS.statsPage, TESTIDS.statsSummary, TESTIDS.statsCalibrationTable]],
      ['/docs', [TESTIDS.docsPage]],
      ['/about', [TESTIDS.aboutPage]],
      ['/attributions', [TESTIDS.attributionsPage]],
      ['/licensing', [TESTIDS.licensePage]],
    ]
    for (const [path, ids] of pages) {
      const { container, unmount } = renderAt(path)
      expectAccessible(container)
      expect(missingTestIds(container, ids)).toEqual([])
      unmount()
    }
  })

  it('attribution links carry the citation title in their name', () => {
    renderAt('/attributions')
    const links = screen.getAllByRole('link', { name: /\(opens in a new tab\)/ })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAccessibleName(/^.+: https?:\/\//)
  })
})
