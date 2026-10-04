/** Runs `fn` exclusively across tabs under a named Web Lock. */
export type WithLock = <T>(name: string, fn: () => Promise<T>) => Promise<T>

export const MIGRATE_LOCK = 'seshat-migrate-v2'
export const GC_LOCK = 'seshat-media-gc'

/**
 * `navigator.locks.request` when it exists, otherwise just runs `fn` (single
 * tab, or an old browser: callers re-check their precondition inside `fn`, so
 * the worst case without locks is a harmless duplicate attempt). A lock API
 * that throws synchronously or rejects before running `fn` also falls back.
 */
export const withWebLock: WithLock = async (name, fn) => {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  if (locks === undefined || typeof locks.request !== 'function') return fn()
  let started = false
  try {
    return await locks.request(name, async () => {
      started = true
      return fn()
    })
  } catch (error) {
    if (started) throw error
    return fn() // the lock could not even be requested (e.g. SecurityError)
  }
}
