import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { newCardId, newSetId } from '../../lib/id'
import { STORAGE_KEY, saveState } from '../../lib/storage'
import { SeshatProvider } from '../../lib/store'
import { type AppState, type SetId, type StudyCard, createEmptyAppState } from '../../types'
import { TestSession } from './TestSession'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

interface Fixture {
  readonly card: StudyCard
  readonly prompt: string
  readonly answer: string
}

const buildFixture = (prompt: string, answer: string, setId: SetId): Fixture => {
  const now = new Date().toISOString()
  return {
    prompt,
    answer,
    card: {
      id: newCardId(),
      setId,
      prompt,
      content: { kind: 'short-answer', answer, acceptableAnswers: [] },
      explanation: null,
      sourceRef: null,
      tags: [],
      createdAt: now,
      updatedAt: now,
      scheduling: createInitialScheduling(new Date()),
    },
  }
}

/** Seeds real localStorage-backed state so `useSeshatStore`'s `recordReview`
 *  can find the card being reviewed (it's a no-op otherwise). */
const seedStore = (setId: SetId, cards: readonly StudyCard[]) => {
  const now = new Date().toISOString()
  const state = createEmptyAppState()
  saveState({
    ...state,
    sets: [
      { id: setId, name: 'Fixture set', description: '', tags: [], createdAt: now, updatedAt: now, goalDate: null },
    ],
    cards: [...cards],
  })
}

const readReviewLog = (): AppState['reviewLog'] => {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return []
  return (JSON.parse(raw) as AppState).reviewLog
}

const renderTestSession = (cards: readonly StudyCard[]) =>
  render(
    <SeshatProvider>
      <TestSession cards={cards} />
    </SeshatProvider>,
  )

const findQuestionItem = (prompt: string): HTMLElement => {
  const item = screen.getAllByRole('listitem').find((li) => within(li).queryByText(prompt, { exact: false }) !== null)
  if (item === undefined) throw new Error(`no question item found for prompt "${prompt}"`)
  return item
}

/**
 * Answers whichever question format is currently rendered for this card
 * (written textbox, or a true/false radio group — this fixture never has
 * enough cards to trigger multiple-choice), format-agnostically:
 * - written: types the real answer, or an obviously wrong one.
 * - true/false: reads which claim is actually true by checking whether the
 *   claim text matches the card's own known answer, then picks accordingly.
 */
const answerQuestion = async (
  user: ReturnType<typeof userEvent.setup>,
  item: HTMLElement,
  fixture: Fixture,
  correct: boolean,
) => {
  const scoped = within(item)
  const textbox = scoped.queryByRole('textbox')
  if (textbox !== null) {
    await user.type(textbox, correct ? fixture.answer : `not ${fixture.answer}`)
    return
  }
  const group = scoped.getByRole('group')
  const claimIsTrue = within(group).queryByText(fixture.answer, { exact: true }) !== null
  const wantTrue = correct ? claimIsTrue : !claimIsTrue
  await user.click(within(group).getByRole('radio', { name: wantTrue ? 'True' : 'False' }))
}

describe('TestSession', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows a fallback message instead of a form when there are no cards to test', () => {
    renderTestSession([])
    expect(screen.getByText(/doesn.t have enough cards to generate a test/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit test' })).not.toBeInTheDocument()
  })

  it('renders one question per card in the set', () => {
    const setId = newSetId()
    const alpha = buildFixture('Alpha term', 'Alpha answer', setId)
    const bravo = buildFixture('Bravo term', 'Bravo answer', setId)
    seedStore(setId, [alpha.card, bravo.card])
    renderTestSession([alpha.card, bravo.card])

    expect(screen.getByText(/Alpha term/)).toBeInTheDocument()
    expect(screen.getByText(/Bravo term/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit test' })).toBeInTheDocument()
  })

  it('grades a submitted test, counting an unanswered question as incorrect', async () => {
    const user = userEvent.setup()
    const setId = newSetId()
    const alpha = buildFixture('Alpha term', 'Alpha answer', setId)
    const bravo = buildFixture('Bravo term', 'Bravo answer', setId)
    seedStore(setId, [alpha.card, bravo.card])
    renderTestSession([alpha.card, bravo.card])

    await answerQuestion(user, findQuestionItem(alpha.prompt), alpha, true)
    // Bravo is left unanswered.
    await user.click(screen.getByRole('button', { name: 'Submit test' }))

    expect(screen.getByText('1 / 2 correct')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retry 1 missed question/ })).toBeInTheDocument()
  })

  it('does not show a retry button when every question is answered correctly', async () => {
    const user = userEvent.setup()
    const setId = newSetId()
    const alpha = buildFixture('Alpha term', 'Alpha answer', setId)
    seedStore(setId, [alpha.card])
    renderTestSession([alpha.card])

    await answerQuestion(user, findQuestionItem(alpha.prompt), alpha, true)
    await user.click(screen.getByRole('button', { name: 'Submit test' }))

    expect(screen.getByText('1 / 1 correct')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument()
  })

  it('scopes "Retry missed" to only the missed questions, and is re-invokable across successive retries', async () => {
    const user = userEvent.setup()
    const setId = newSetId()
    const alpha = buildFixture('Alpha term', 'Alpha answer', setId)
    const bravo = buildFixture('Bravo term', 'Bravo answer', setId)
    const charlie = buildFixture('Charlie term', 'Charlie answer', setId)
    const cards = [alpha.card, bravo.card, charlie.card]
    seedStore(setId, cards)
    renderTestSession(cards)

    await answerQuestion(user, findQuestionItem(alpha.prompt), alpha, true)
    await answerQuestion(user, findQuestionItem(bravo.prompt), bravo, false)
    await answerQuestion(user, findQuestionItem(charlie.prompt), charlie, false)
    await user.click(screen.getByRole('button', { name: 'Submit test' }))

    expect(screen.getByText('1 / 3 correct')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry 2 missed questions' }))

    // Only the two missed cards reappear — the one answered correctly the
    // first time is not part of the retry round.
    expect(screen.queryByText(/Alpha term/)).not.toBeInTheDocument()
    expect(screen.getByText(/Bravo term/)).toBeInTheDocument()
    expect(screen.getByText(/Charlie term/)).toBeInTheDocument()

    await answerQuestion(user, findQuestionItem(bravo.prompt), bravo, true)
    await answerQuestion(user, findQuestionItem(charlie.prompt), charlie, false)
    await user.click(screen.getByRole('button', { name: 'Submit test' }))

    expect(screen.getByText('1 / 2 correct')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry 1 missed question' }))

    // Re-invoked a second time: scoped down further to just the
    // still-missed card.
    expect(screen.queryByText(/Bravo term/)).not.toBeInTheDocument()
    expect(screen.getByText(/Charlie term/)).toBeInTheDocument()
    // With only one card in this retry round, true/false is disabled (it
    // needs >= 2 cards to source a decoy) — the question is guaranteed to
    // be the written format.
    expect(within(findQuestionItem(charlie.prompt)).getByRole('textbox')).toBeInTheDocument()
  })

  it('records a review-log entry per question on every submit, including retries (documents current behavior — see report)', async () => {
    const user = userEvent.setup()
    const setId = newSetId()
    const alpha = buildFixture('Alpha term', 'Alpha answer', setId)
    const bravo = buildFixture('Bravo term', 'Bravo answer', setId)
    const cards = [alpha.card, bravo.card]
    seedStore(setId, cards)
    renderTestSession(cards)

    await answerQuestion(user, findQuestionItem(alpha.prompt), alpha, true)
    await answerQuestion(user, findQuestionItem(bravo.prompt), bravo, false)
    await user.click(screen.getByRole('button', { name: 'Submit test' }))

    expect(readReviewLog()).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Retry 1 missed question' }))
    await answerQuestion(user, findQuestionItem(bravo.prompt), bravo, true)
    await user.click(screen.getByRole('button', { name: 'Submit test' }))

    // The retry's single question was recorded again on top of the
    // original two — retrying re-invokes `recordReview`.
    expect(readReviewLog()).toHaveLength(3)
  })
})
