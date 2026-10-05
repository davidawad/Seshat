import {
  recordBackupDownloaded,
  recordNudgeDismissed,
  recordReviewUndone,
  recordReviewed,
  recordSetAdded,
} from './activation'
import {
  type Activation,
  type AppState,
  type CardId,
  type FirstSetSource,
  type SetId,
  type Settings,
  type StudyCard,
  type StudySet,
  createEmptyAppState,
} from '../types'

/** The app-state reducer and its actions, kept apart from the provider (store.tsx). */

export interface NewCardInput {
  readonly prompt: StudyCard['prompt']
  readonly promptImage?: StudyCard['promptImage']
  readonly content: StudyCard['content']
  readonly explanation: string | null
  readonly sourceRef: string | null
  readonly tags: string[]
}

export interface NewSetInput {
  readonly name: string
  readonly description: string
  readonly tags: string[]
  readonly goalDate?: string | null
}

export type Action =
  | { readonly type: 'hydrate'; readonly state: AppState }
  | { readonly type: 'add-set'; readonly set: StudySet }
  | { readonly type: 'update-set'; readonly id: SetId; readonly patch: Partial<NewSetInput>; readonly now: string }
  | { readonly type: 'delete-set'; readonly id: SetId }
  | { readonly type: 'add-card'; readonly card: StudyCard }
  | { readonly type: 'update-card'; readonly id: CardId; readonly patch: Partial<NewCardInput>; readonly now: string }
  | { readonly type: 'delete-card'; readonly id: CardId }
  | {
      readonly type: 'record-review'
      readonly cardId: CardId
      readonly scheduling: StudyCard['scheduling']
      readonly logEntry: AppState['reviewLog'][number]
    }
  | {
      readonly type: 'undo-review'
      readonly cardId: CardId
      readonly scheduling: StudyCard['scheduling']
      readonly reviewedAt: string
    }
  | {
      readonly type: 'import-set'
      readonly set: StudySet
      readonly cards: readonly StudyCard[]
      readonly source: FirstSetSource
    }
  | { readonly type: 'backup-downloaded'; readonly at: string }
  | { readonly type: 'backup-nudge-dismissed'; readonly at: string }
  | { readonly type: 'update-settings'; readonly patch: Partial<Settings> }
  | { readonly type: 'reset' }

const core = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'add-set':
      return {
        ...state,
        sets: [...state.sets, action.set],
      }
    case 'update-set':
      return {
        ...state,
        sets: state.sets.map((set) =>
          set.id === action.id ? { ...set, ...action.patch, updatedAt: action.now } : set,
        ),
      }
    case 'delete-set':
      return {
        ...state,
        sets: state.sets.filter((set) => set.id !== action.id),
        cards: state.cards.filter((card) => card.setId !== action.id),
        reviewLog: state.reviewLog.filter((entry) => entry.setId !== action.id),
      }
    case 'add-card':
      return { ...state, cards: [...state.cards, action.card] }
    case 'update-card':
      return {
        ...state,
        cards: state.cards.map((card) =>
          card.id === action.id ? { ...card, ...action.patch, updatedAt: action.now } : card,
        ),
      }
    case 'delete-card':
      return {
        ...state,
        cards: state.cards.filter((card) => card.id !== action.id),
        reviewLog: state.reviewLog.filter((entry) => entry.cardId !== action.id),
      }
    case 'record-review':
      return {
        ...state,
        cards: state.cards.map((card) =>
          card.id === action.cardId ? { ...card, scheduling: action.scheduling } : card,
        ),
        reviewLog: [...state.reviewLog, action.logEntry],
      }
    case 'undo-review':
      return {
        ...state,
        cards: state.cards.map((card) =>
          card.id === action.cardId ? { ...card, scheduling: action.scheduling } : card,
        ),
        reviewLog: state.reviewLog.filter(
          (entry) => !(entry.cardId === action.cardId && entry.reviewedAt === action.reviewedAt),
        ),
      }
    case 'import-set':
      return {
        ...state,
        sets: [...state.sets, action.set],
        cards: [...state.cards, ...action.cards],
      }
    case 'update-settings':
      return { ...state, settings: { ...state.settings, ...action.patch } }
    case 'reset':
      return createEmptyAppState()
    case 'backup-downloaded':
    case 'backup-nudge-dismissed':
      return state
  }
}

/** The local activation record after `action` (unchanged for actions that do not feed it). */
const trackActivation = (a: Activation, action: Action): Activation => {
  switch (action.type) {
    case 'add-set':
      return recordSetAdded(a, 'create', action.set.createdAt)
    case 'import-set':
      return recordSetAdded(a, action.source, action.set.createdAt)
    case 'record-review':
      return recordReviewed(a, action.logEntry.reviewedAt)
    case 'undo-review':
      return recordReviewUndone(a)
    case 'backup-downloaded':
      return recordBackupDownloaded(a, action.at)
    case 'backup-nudge-dismissed':
      return recordNudgeDismissed(a, action.at)
    default:
      return a
  }
}

export const reducer = (state: AppState, action: Action): AppState => {
  const next = core(state, action)
  // `hydrate` and `reset` bring their own activation; everything else carries the old one forward.
  if (next.activation !== state.activation) return next
  const activation = trackActivation(next.activation, action)
  return activation === next.activation ? next : { ...next, activation }
}
