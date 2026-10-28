import { type CardId, type FolderId, type SetId, cardIdSchema, folderIdSchema, setIdSchema } from '../types'

export const newSetId = (): SetId => setIdSchema.parse(crypto.randomUUID())
export const newCardId = (): CardId => cardIdSchema.parse(crypto.randomUUID())
export const newFolderId = (): FolderId => folderIdSchema.parse(crypto.randomUUID())
