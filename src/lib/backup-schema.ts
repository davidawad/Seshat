import { z } from 'zod'
import { reviewLogEntrySchema, settingsSchema, studyCardSchema, studySetSchema } from '../types'

/**
 * The backup envelope's Zod schema, kept apart from `backup.ts` (which pulls
 * in browser-only modules) so build tooling can import it to emit the
 * published JSON Schema (`vite-plugins/agent-files.ts`). `backup.ts` owns
 * parsing, migrations and merge/replace; this file is only the shape.
 */

export const BACKUP_FORMAT = 'seshat-backup'
export const BACKUP_VERSION = 1

// Settings are validated as a *partial*, then layered over defaults: a
// backup taken before a setting existed must still import, and the schema
// stays generic (new Settings fields flow through with no edit here) while
// remaining strict about fields that are not settings at all.
const backupSettingsSchema = settingsSchema.partial().strict()

export const backupV1Schema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  appVersion: z.string(),
  exportedAt: z.iso.datetime(),
  settings: backupSettingsSchema,
  keybindings: z.record(z.string(), z.string()),
  sets: z.array(studySetSchema),
  cards: z.array(studyCardSchema),
  reviewLog: z.array(reviewLogEntrySchema),
})
