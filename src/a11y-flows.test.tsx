import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { base, expectAccessible, installA11yTestEnv, renderAt, seed } from './a11y-fixtures'
import { duplicatedTestIds, headingLevels, headingSkips, missingTestIds, unnamedInteractive } from './lib/a11y-audit'
import { TESTIDS } from './lib/testids'

installA11yTestEnv()

// These render the whole App and walk multi-step flows with user-event; they
// take seconds each alone and flaked at the global 20s when the full suite ran
// in parallel with coverage instrumentation.
vi.setConfig({ testTimeout: 60_000 })

describe('accessibility tree: flows', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('study walks answer -> confidence -> reveal, accessible at every step', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderAt(`${base}/study`)
    expectAccessible(container)
    expect(
      missingTestIds(container, [
        TESTIDS.studyPage,
        TESTIDS.studyProgress,
        TESTIDS.studyAnswerInput,
        TESTIDS.studyContinue,
      ]),
    ).toEqual([])

    await user.type(screen.getByTestId(TESTIDS.studyAnswerInput), 'Paris')
    await user.click(screen.getByTestId(TESTIDS.studyContinue))
    expectAccessible(container)
    expect(
      missingTestIds(container, [
        TESTIDS.studyConfidenceGuessed,
        TESTIDS.studyConfidenceUnsure,
        TESTIDS.studyConfidenceSure,
      ]),
    ).toEqual([])

    await user.click(screen.getByTestId(TESTIDS.studyConfidenceSure))
    expectAccessible(container)
    expect(
      missingTestIds(container, [
        TESTIDS.studyResult,
        TESTIDS.studyGradeAgain,
        TESTIDS.studyGradeHard,
        TESTIDS.studyGradeGood,
        TESTIDS.studyGradeEasy,
      ]),
    ).toEqual([])
  })

  it('study cloze and mcq cards: inputs and radios are named', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderAt(`${base}/study`)
    // Card 1 (short answer) -> grade it, then the cloze card shows.
    await user.type(screen.getByTestId(TESTIDS.studyAnswerInput), 'Paris')
    await user.click(screen.getByTestId(TESTIDS.studyContinue))
    await user.click(screen.getByTestId(TESTIDS.studyConfidenceSure))
    await user.click(screen.getByTestId(TESTIDS.studyGradeGood))
    expectAccessible(container)
    expect(screen.getByTestId(TESTIDS.studyAnswerInput)).toHaveAccessibleName()

    await user.type(screen.getByTestId(TESTIDS.studyAnswerInput), 'Madrid')
    await user.click(screen.getByTestId(TESTIDS.studyContinue))
    await user.click(screen.getByTestId(TESTIDS.studyConfidenceSure))
    await user.click(screen.getByTestId(TESTIDS.studyGradeGood))

    await user.click(screen.getByTestId(TESTIDS.studyShowOptions))
    expectAccessible(container)
    const group = screen.getByTestId(TESTIDS.studyMcqOptions)
    expect(within(group).getAllByRole('radio')).toHaveLength(3)
  })

  it('study session summary takes focus when the queue is finished', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderAt(`${base}/study`)
    for (const answer of ['Paris', 'Madrid']) {
      await user.type(screen.getByTestId(TESTIDS.studyAnswerInput), answer)
      await user.click(screen.getByTestId(TESTIDS.studyContinue))
      await user.click(screen.getByTestId(TESTIDS.studyConfidenceSure))
      await user.click(screen.getByTestId(TESTIDS.studyGradeGood))
    }
    await user.click(screen.getByTestId(TESTIDS.studyShowOptions))
    await user.click(screen.getByRole('radio', { name: 'Rome' }))
    await user.click(screen.getByTestId(TESTIDS.studyContinue))
    await user.click(screen.getByTestId(TESTIDS.studyConfidenceSure))
    await user.click(screen.getByTestId(TESTIDS.studyGradeGood))
    await user.type(screen.getByTestId(TESTIDS.studyAnswerInput), 'Berlin')
    await user.click(screen.getByTestId(TESTIDS.studyContinue))
    await user.click(screen.getByTestId(TESTIDS.studyConfidenceSure))
    await user.click(screen.getByTestId(TESTIDS.studyGradeGood))

    expectAccessible(container)
    expect(screen.getByTestId(TESTIDS.studySummary)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Session complete' })).toHaveFocus()
  })

  it('flashcards: the face names the card text, controls and modal are named', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderAt(`${base}/flashcards`)
    expectAccessible(container)
    expect(
      missingTestIds(container, [
        TESTIDS.flashcardsPage,
        TESTIDS.flashcardFace,
        TESTIDS.flashcardKnow,
        TESTIDS.flashcardStillLearning,
        TESTIDS.flashcardUndo,
        TESTIDS.flashcardShuffle,
        TESTIDS.flashcardOptions,
        TESTIDS.flashcardProgress,
      ]),
    ).toEqual([])
    expect(screen.getByTestId(TESTIDS.flashcardFace).getAttribute('aria-label')).toMatch(/^Question shown: .+\S/)
    expect(screen.getByRole('link', { name: 'Back to Capitals' })).toBeInTheDocument()

    await user.click(screen.getByTestId(TESTIDS.flashcardOptions))
    const dialog = screen.getByRole('dialog', { name: 'Options' })
    expect(unnamedInteractive(dialog)).toEqual([])
    expect(within(dialog).getByRole('switch', { name: 'Track progress' })).toBeInTheDocument()
    expect(
      missingTestIds(container, [TESTIDS.flashcardTrackProgress, TESTIDS.flashcardFront, TESTIDS.flashcardRestart]),
    ).toEqual([])
  })

  it('flashcards: only one live region announces a grade (no double announcement)', () => {
    seed()
    renderAt(`${base}/flashcards`)
    expect(screen.getByTestId(TESTIDS.flashcardProgress)).not.toHaveAttribute('aria-live')
    expect(screen.getByTestId(TESTIDS.flashcardsAnnouncer)).toHaveAttribute('role', 'status')
  })

  it('footer, settings modal and shortcuts modal', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderAt('/')
    expect(
      missingTestIds(container, [TESTIDS.shortcutsOpen, TESTIDS.settingsOpen, TESTIDS.footerDocs, TESTIDS.footerAbout]),
    ).toEqual([])

    await user.click(screen.getByTestId(TESTIDS.settingsOpen))
    const settings = screen.getByRole('dialog', { name: 'Settings' })
    expect(unnamedInteractive(settings)).toEqual([])
    expect(headingSkips(headingLevels(settings).map((level) => level - 1))).toEqual([])
    await user.click(screen.getByTestId(TESTIDS.settingsModalClose))

    await user.click(screen.getByTestId(TESTIDS.shortcutsOpen))
    const shortcuts = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    expect(unnamedInteractive(shortcuts)).toEqual([])
    const changeNames = within(shortcuts)
      .getAllByRole('button', { name: /^Change shortcut:/ })
      .map((button) => button.getAttribute('aria-label'))
    expect(new Set(changeNames).size).toBe(changeNames.length)
    expect(duplicatedTestIds(container, [TESTIDS.settingsModalClose, TESTIDS.shortcutsModalClose])).toEqual([])
    expect(
      missingTestIds(container, [TESTIDS.shortcutsModal, TESTIDS.settingsModal, TESTIDS.shortcutsPresetGroup]),
    ).toEqual([])
  })

  it('moves focus to the new page heading after navigating', async () => {
    const user = userEvent.setup()
    seed()
    renderAt('/')
    await user.click(screen.getByTestId(TESTIDS.homeSetLink))
    expect(screen.getByRole('heading', { level: 1, name: 'Capitals' })).toHaveFocus()
    await user.click(screen.getByTestId(TESTIDS.footerDocs))
    expect(screen.getByRole('heading', { level: 1, name: 'Docs' })).toHaveFocus()
  })
})
