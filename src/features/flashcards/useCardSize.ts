import { useEffect } from 'react'
import { useSeshatStore } from '../../lib/store'

/**
 * Mirrors the card-size setting onto <html data-card-size>, where tokens.css
 * turns it into the card's width and text scale. One attribute, so the
 * flashcards page and the set-page preview always agree.
 */
export const useApplyCardSize = (): void => {
  const { state } = useSeshatStore()
  const size = state.settings.flashcardsCardSize
  useEffect(() => {
    document.documentElement.dataset['cardSize'] = size
  }, [size])
}
