import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useFocusWhen } from '../../lib/routeFocus'
import { TESTIDS } from '../../lib/testids'
import type { SetId, StudyCard } from '../../types'
import { cardFrontBack } from '../study/card-summary'
import {
  type Entry,
  type LearnState,
  type Mastery,
  accuracyPercent,
  allMastered,
  countMastery,
  hardestCards,
  masteryOf,
} from './learn-session'

const MASTERY_LABEL: Readonly<Record<Mastery, string>> = {
  mastered: 'Mastered',
  learning: 'Learning',
  'not-started': 'Not started',
}

const frontOf = (cards: ReadonlyMap<string, StudyCard>, entry: Entry): string => {
  const card = cards.get(entry.id)
  return card === undefined ? '(deleted card)' : cardFrontBack(card).front
}

interface CardListProps {
  readonly entries: readonly Entry[]
  readonly cards: ReadonlyMap<string, StudyCard>
  readonly label: string
}

/** One row per card with its mastery as text (never colour alone). */
const CardList = ({ entries, cards, label }: CardListProps) => (
  <ul className="learn-card-list" aria-label={label}>
    {entries.map((entry) => (
      <li key={entry.id} className={`learn-card-row is-${masteryOf(entry)}`}>
        <span className="learn-card-front">{frontOf(cards, entry)}</span>
        <span className="learn-card-level">{MASTERY_LABEL[masteryOf(entry)]}</span>
      </li>
    ))}
  </ul>
)

const MasteryStats = ({ entries }: { readonly entries: readonly Entry[] }) => {
  const counts = countMastery(entries)
  return (
    <dl className="session-summary-stats">
      <div>
        <dt>Mastered</dt>
        <dd>{counts.mastered}</dd>
      </div>
      <div>
        <dt>Learning</dt>
        <dd>{counts.learning}</dd>
      </div>
      <div>
        <dt>Not started</dt>
        <dd>{counts.notStarted}</dd>
      </div>
    </dl>
  )
}

interface RoundSummaryProps {
  readonly state: LearnState
  readonly cards: ReadonlyMap<string, StudyCard>
  readonly onNext: () => void
  readonly onFinish: () => void
}

/** End of a round: where every card in it stands, then on to the next round or stop. */
export const RoundSummary = ({ state, cards, onNext, onFinish }: RoundSummaryProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useFocusWhen(headingRef, true)
  const roundEntries = state.entries.filter((entry) => state.roundIds.includes(entry.id))
  const last = allMastered(state)
  return (
    <div className="illuminated-panel session-summary" role="status" data-testid={TESTIDS.learnRoundSummary}>
      <h2 ref={headingRef} tabIndex={-1} className="session-summary-heading">
        Round {state.round} complete
      </h2>
      <MasteryStats entries={state.entries} />
      <CardList entries={roundEntries} cards={cards} label="Cards in this round" />
      <div className="learn-actions">
        <button type="button" data-testid={TESTIDS.learnNextRound} onClick={onNext}>
          {last ? 'See results' : 'Next round'}
        </button>
        {!last && (
          <button type="button" data-testid={TESTIDS.learnFinish} onClick={onFinish}>
            Finish session
          </button>
        )}
      </div>
    </div>
  )
}

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  return minutes > 0 ? `${minutes}m ${totalSeconds % 60}s` : `${totalSeconds}s`
}

interface FinalSummaryProps {
  readonly state: LearnState
  readonly cards: ReadonlyMap<string, StudyCard>
  readonly elapsedMs: number
  readonly setId: SetId
  readonly onRestart: () => void
}

/** End of the session: mastery counts, accuracy, time, the terms missed most, and every term's level. */
export const FinalSummary = ({ state, cards, elapsedMs, setId, onRestart }: FinalSummaryProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useFocusWhen(headingRef, true)
  const hardest = hardestCards(state.entries)
  return (
    <div className="illuminated-panel session-summary" role="status" data-testid={TESTIDS.learnSummary}>
      <h2 ref={headingRef} tabIndex={-1} className="session-summary-heading">
        {allMastered(state) ? 'Every term mastered' : 'Session complete'}
      </h2>
      <MasteryStats entries={state.entries} />
      <dl className="session-summary-stats">
        <div>
          <dt>Questions</dt>
          <dd>{state.answered}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{accuracyPercent(state)}%</dd>
        </div>
        <div>
          <dt>Time spent</dt>
          <dd>{formatDuration(elapsedMs)}</dd>
        </div>
      </dl>
      {hardest.length > 0 && (
        <>
          <h3 className="learn-subheading">Missed most</h3>
          <ul className="learn-card-list" aria-label="Terms you missed most">
            {hardest.map((entry) => (
              <li key={entry.id} className="learn-card-row">
                <span className="learn-card-front">{frontOf(cards, entry)}</span>
                <span className="learn-card-level">
                  {entry.misses} {entry.misses === 1 ? 'miss' : 'misses'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <details className="learn-all-terms">
        <summary>All terms</summary>
        <CardList entries={state.entries} cards={cards} label="All terms" />
      </details>
      <p className="learn-note">Typed answers and misses were added to your review history and FSRS schedule.</p>
      <div className="learn-actions">
        <button type="button" data-testid={TESTIDS.learnRestart} onClick={onRestart}>
          Learn again
        </button>
        <Link to={`/sets/${setId}`}>Back to the set</Link>
      </div>
    </div>
  )
}
