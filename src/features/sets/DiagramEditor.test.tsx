import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { MediaStoreProvider, createMemoryMediaStore } from '../../lib/media'
import { clearMirrors } from '../../lib/persistence'
import { saveState } from '../../lib/storage'
import { SeshatProvider, useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { type CardId, type SetId, type StudyCard, createEmptyAppState, setIdSchema } from '../../types'
import { DiagramEditor } from './DiagramEditor'

afterEach(() => cleanup())
// jsdom has no native <dialog> modal support; stub the two methods Modal.tsx calls.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})
beforeEach(() => {
  window.localStorage.clear()
  clearMirrors()
})

const setId: SetId = setIdSchema.parse('a1111111-1111-4111-8111-111111111111')
const DATA_URL = 'data:image/png;base64,AAAA'
const C1 = 'c1111111-1111-4111-8111-111111111111'
const C2 = 'c2222222-2222-4222-8222-222222222222'
const NOW = '2026-01-01T00:00:00.000Z'

const diagramCard = (id: string, askedRegionId: string): StudyCard => ({
  id: id as CardId,
  setId,
  prompt: 'Heart',
  promptImage: null,
  content: {
    kind: 'image-occlusion',
    image: null,
    imageDataUrl: DATA_URL,
    occlusions: [
      { id: 'a', xPct: 10, yPct: 10, widthPct: 20, heightPct: 20, label: 'Aorta' },
      { id: 'b', xPct: 50, yPct: 50, widthPct: 20, heightPct: 20, label: 'Atrium' },
    ],
    askedRegionId,
    diagramId: 'D1',
  },
  explanation: null,
  sourceRef: null,
  tags: [],
  createdAt: NOW,
  updatedAt: NOW,
  scheduling: createInitialScheduling(new Date()),
})

const cardsInStore = (): StudyCard[] => JSON.parse(window.localStorage.getItem('seshat:app-state:v2') ?? '{}').cards

const Probe = () => {
  const { state } = useSeshatStore()
  return <p data-testid="probe">{state.cards.length}</p>
}

const seed = (cards: StudyCard[]) =>
  saveState({
    ...createEmptyAppState(),
    sets: [{ id: setId, name: 'Anatomy', description: '', tags: [], createdAt: NOW, updatedAt: NOW, goalDate: null }],
    cards,
  })

const renderEditor = (cards: StudyCard[], onDone = vi.fn()) => {
  seed(cards)
  render(
    <MediaStoreProvider store={createMemoryMediaStore()}>
      <SeshatProvider>
        <DiagramEditor setId={setId} cards={cards} onDone={onDone} />
        <Probe />
      </SeshatProvider>
    </MediaStoreProvider>,
  )
  return onDone
}

const regionButtons = () => screen.getAllByTestId(TESTIDS.diagramRegion)

describe('DiagramEditor', () => {
  it('names each region by number, label and position, and exposes a keyboard hint', () => {
    renderEditor([diagramCard(C1, 'a'), diagramCard(C2, 'b')])
    expect(regionButtons().map((el) => el.getAttribute('aria-label'))).toEqual([
      'Region 1: Aorta, upper left',
      'Region 2: Atrium, centre',
    ])
    expect(screen.getByRole('group', { name: /Diagram canvas/ })).toHaveAccessibleDescription(
      /Shift plus arrows resize/,
    )
  })

  it('moves a focused region with arrows, resizes with Shift+arrows, and announces it', async () => {
    const user = userEvent.setup()
    renderEditor([diagramCard(C1, 'a'), diagramCard(C2, 'b')])
    const first = regionButtons()[0]!
    first.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}')
    expect(first).toHaveStyle({ left: '12%', top: '11%', width: '20%' })
    await user.keyboard('{Shift>}{ArrowRight}{ArrowDown}{/Shift}')
    expect(first).toHaveStyle({ width: '21%', height: '21%' })
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent(/Region 1/)
  })

  it('stops a region at the image edge', async () => {
    const user = userEvent.setup()
    renderEditor([diagramCard(C1, 'a'), diagramCard(C2, 'b')])
    const first = regionButtons()[0]!
    first.focus()
    await user.keyboard('{Control>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Control}')
    expect(first).toHaveStyle({ left: '0%' })
  })

  it('deletes a region with Delete and moves focus to a neighbour', async () => {
    const user = userEvent.setup()
    renderEditor([diagramCard(C1, 'a'), diagramCard(C2, 'b')])
    regionButtons()[0]!.focus()
    await user.keyboard('{Delete}')
    expect(regionButtons()).toHaveLength(1)
    expect(regionButtons()[0]).toHaveFocus()
    expect(screen.getByTestId(TESTIDS.diagramCardCount)).toHaveTextContent('1 label = 1 card')
  })

  it('undoes and redoes with the buttons and with Ctrl+Z / Ctrl+Shift+Z', async () => {
    const user = userEvent.setup()
    renderEditor([diagramCard(C1, 'a'), diagramCard(C2, 'b')])
    const undo = screen.getByTestId(TESTIDS.diagramUndo)
    const redo = screen.getByTestId(TESTIDS.diagramRedo)
    expect(undo).toBeDisabled()
    regionButtons()[0]!.focus()
    await user.keyboard('{Delete}')
    expect(regionButtons()).toHaveLength(1)
    await user.click(undo)
    expect(regionButtons()).toHaveLength(2)
    expect(redo).toBeEnabled()
    await user.click(redo)
    expect(regionButtons()).toHaveLength(1)
    regionButtons()[0]!.focus()
    await user.keyboard('{Control>}z{/Control}')
    expect(regionButtons()).toHaveLength(2)
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(regionButtons()).toHaveLength(1)
  })

  it('adds a region, requires a label, then saves one card per label', async () => {
    const user = userEvent.setup()
    const onDone = renderEditor([diagramCard(C1, 'a'), diagramCard(C2, 'b')])
    await user.click(screen.getByTestId(TESTIDS.diagramAddRegion))
    expect(regionButtons()).toHaveLength(3)
    expect(screen.getByTestId(TESTIDS.diagramCardCount)).toHaveTextContent('3 labels = 3 cards (adds 1, updates 2')

    await user.click(screen.getByTestId(TESTIDS.diagramSave))
    expect(screen.getByRole('alert')).toHaveTextContent(/Label every region \(missing: 3\)/)
    expect(onDone).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Label for region 3'), 'Valve')
    await user.click(screen.getByTestId(TESTIDS.diagramSave))
    expect(onDone).toHaveBeenCalled()
    expect(screen.getByTestId('probe')).toHaveTextContent('3')
    const cards = cardsInStore()
    expect(cards.map((c) => (c.content as { askedRegionId?: string }).askedRegionId).filter(Boolean)).toHaveLength(3)
    const regionCounts = new Set(cards.map((c) => (c.content as { occlusions: unknown[] }).occlusions.length))
    expect([...regionCounts]).toEqual([3])
  })

  it('creates a new diagram from scratch only once it has a title, an image and a labelled region', async () => {
    const user = userEvent.setup()
    const onDone = renderEditor([])
    await user.click(screen.getByTestId(TESTIDS.diagramSave))
    expect(screen.getByRole('alert')).toHaveTextContent(/title/)
    await user.type(screen.getByLabelText(/Diagram title/), 'Skull')
    await user.click(screen.getByTestId(TESTIDS.diagramSave))
    expect(screen.getByRole('alert')).toHaveTextContent(/image/i)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('asks before removing the card of a deleted label, and keeps the others', async () => {
    const user = userEvent.setup()
    const onDone = renderEditor([diagramCard(C1, 'a'), diagramCard(C2, 'b')])
    regionButtons()[1]!.focus()
    await user.keyboard('{Delete}')
    await user.click(screen.getByTestId(TESTIDS.diagramSave))
    const dialog = screen.getByTestId(TESTIDS.confirmDialog)
    expect(dialog).toHaveTextContent(/removes 1 card/)
    expect(onDone).not.toHaveBeenCalled()
    await user.click(within(dialog).getByTestId(TESTIDS.confirmDialogAccept))
    expect(onDone).toHaveBeenCalled()
    expect(screen.getByTestId('probe')).toHaveTextContent('1')
    expect(cardsInStore()[0]!.id).toBe(C1)
  })

  it('shows live question and answer previews for the selected region', () => {
    renderEditor([diagramCard(C1, 'a'), diagramCard(C2, 'b')])
    const preview = screen.getByTestId(TESTIDS.diagramPreview)
    expect(within(preview).getByText(/Hidden: the label for the upper left region/)).toBeInTheDocument()
    expect(within(preview).getByText(/Answer: Aorta, upper left region/)).toBeInTheDocument()
  })
})
