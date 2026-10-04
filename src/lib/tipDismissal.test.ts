import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TIP_DISMISSED_KEY,
  dismissTip,
  forgetTipCacheForTests,
  isTipDismissed,
  resetDismissedTips,
  subscribeTipDismissals,
} from './tipDismissal'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
  forgetTipCacheForTests()
})

describe('tip dismissal store', () => {
  it('starts empty, remembers a dismissal and persists it as a JSON id list', () => {
    expect(isTipDismissed('a')).toBe(false)
    dismissTip('a')
    dismissTip('a')
    expect(isTipDismissed('a')).toBe(true)
    expect(window.localStorage.getItem(TIP_DISMISSED_KEY)).toBe('["a"]')
  })

  it('reads dismissals saved by an earlier visit', () => {
    window.localStorage.setItem(TIP_DISMISSED_KEY, '["x","y"]')
    forgetTipCacheForTests()
    expect(isTipDismissed('x')).toBe(true)
    expect(isTipDismissed('z')).toBe(false)
  })

  it.each(['not json', '{"a":1}', '[1,2]', `[${'"a",'.repeat(70)}"b"]`])('ignores corrupt data %#', (raw) => {
    window.localStorage.setItem(TIP_DISMISSED_KEY, raw)
    forgetTipCacheForTests()
    expect(isTipDismissed('a')).toBe(false)
  })

  it('never throws and still works for the session when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    forgetTipCacheForTests()
    expect(isTipDismissed('a')).toBe(false)
    expect(() => dismissTip('a')).not.toThrow()
    expect(isTipDismissed('a')).toBe(true)
  })

  it('notifies subscribers, and resetting brings every tip back', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeTipDismissals(listener)
    dismissTip('a')
    resetDismissedTips()
    resetDismissedTips()
    expect(listener).toHaveBeenCalledTimes(2)
    expect(isTipDismissed('a')).toBe(false)
    unsubscribe()
    dismissTip('b')
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
