import { z } from 'zod'
import { reviewLogEntrySchema, studyCardSchema, studySetSchema } from '../types'

/**
 * The backup envelope's Zod schema, kept apart from `backup.ts` (which pulls
 * in browser-only modules) so build tooling can import it to emit the
 * published JSON Schema (`vite-plugins/agent-files.ts`). `backup.ts` owns
 * parsing, migrations and merge/replace; this file is only the shape.
 */

export const BACKUP_FORMAT = 'seshat-backup'
export const BACKUP_VERSION = 1

// Settings are an untyped record here on purpose: `parseBackup` validates them as a *patch*
// (`parseSettingsPatch`: only the keys present, unknown keys rejected) and layers the result over
// the defaults, so a backup taken before a setting existed still imports and new Settings fields
// flow through with no edit. The published JSON Schema describes the real fields instead (see
// `buildBackupSchema` in vite-plugins/agent-files.ts).
export const backupV1Schema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  appVersion: z.string(),
  exportedAt: z.iso.datetime(),
  settings: z.record(z.string(), z.unknown()),
  keybindings: z.record(z.string(), z.string()),
  sets: z.array(studySetSchema),
  cards: z.array(studyCardSchema),
  reviewLog: z.array(reviewLogEntrySchema),
})
