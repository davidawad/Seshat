import { type CardId, type SetId, cardIdSchema, setIdSchema } from '../types'

export const newSetId = (): SetId => setIdSchema.parse(crypto.randomUUID())
export const newCardId = (): CardId => cardIdSchema.parse(crypto.randomUUID())
