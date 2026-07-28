import { type CardId, type DeckId, cardIdSchema, deckIdSchema } from '../types'

export const newDeckId = (): DeckId => deckIdSchema.parse(crypto.randomUUID())
export const newCardId = (): CardId => cardIdSchema.parse(crypto.randomUUID())
