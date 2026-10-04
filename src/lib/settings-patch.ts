import { type Result, type Settings, err, ok, settingsSchema } from '../types'

/**
 * The ONLY sanctioned way to read a partial settings object.
 *
 * `settingsSchema.partial()` still fills `.default(...)` fields for keys that
 * were never supplied, so spreading its output silently resets unrelated
 * settings. This helper validates each present key against that field's own
 * schema (`settingsSchema.shape`, so new Settings fields flow through with no
 * edit here) and returns ONLY the keys actually present. A key whose value is
 * `undefined` counts as absent. A test forbids `settingsSchema.partial(`
 * anywhere else in src.
 */
export interface SettingsPatchOptions {
  /** `reject` (default) fails on non-setting keys; `ignore` drops them. */
  readonly unknownKeys?: 'reject' | 'ignore'
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

type Shape = Record<
  string,
  {
    safeParse: (value: unknown) => {
      success: boolean
      data?: unknown
      error?: { issues: readonly { message: string }[] }
    }
  }
>

const shape: Shape = settingsSchema.shape as unknown as Shape

/** Every setting key, derived from the schema. */
export const SETTING_KEYS: readonly string[] = Object.keys(shape)

type Entry = Result<readonly [string, unknown] | null, string>

const parseEntry = (key: string, value: unknown, reject: boolean): Entry => {
  const field = Object.hasOwn(shape, key) ? shape[key] : undefined
  if (field === undefined) return reject ? err(`Unknown setting: ${key}.`) : ok(null)
  if (value === undefined) return ok(null)
  const parsed = field.safeParse(value)
  return parsed.success
    ? ok([key, parsed.data] as const)
    : err(`${key}: ${parsed.error?.issues[0]?.message ?? 'invalid value'}`)
}

export const parseSettingsPatch = (
  raw: unknown,
  options: SettingsPatchOptions = {},
): Result<Partial<Settings>, string> => {
  if (!isPlainObject(raw)) return err('Settings must be an object.')
  const entries = Object.entries(raw).map(([key, value]) => parseEntry(key, value, options.unknownKeys !== 'ignore'))
  const failed = entries.find((entry) => !entry.ok)
  if (failed !== undefined && !failed.ok) return failed
  const kept = entries.flatMap((entry) => (entry.ok && entry.value !== null ? [entry.value] : []))
  return ok(Object.fromEntries(kept) as Partial<Settings>)
}
