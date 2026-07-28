import { describe, expect, it } from 'vitest'
import { shuffle } from './shuffle'

describe('shuffle', () => {
  it('does not mutate the input array', () => {
    const items = [1, 2, 3, 4, 5]
    const copy = [...items]
    shuffle(items)
    expect(items).toEqual(copy)
  })

  it('preserves length and multiset of elements', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const result = shuffle(items)
    expect(result).toHaveLength(items.length)
    expect([...result].sort()).toEqual([...items].sort())
  })

  it('is a no-op on an empty array', () => {
    expect(shuffle([])).toEqual([])
  })

  it('is a no-op on a single-element array', () => {
    expect(shuffle([42])).toEqual([42])
  })

  it('is deterministic for an injected random source', () => {
    const fixed = () => 0 // always picks index 0 -> reverses the array
    expect(shuffle([1, 2, 3, 4], fixed)).toEqual([2, 3, 4, 1])
  })

  it('produces a different order with a different injected source than another', () => {
    const constantZero = () => 0
    const constantAlmostOne = () => 0.999999
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(shuffle(items, constantZero)).not.toEqual(shuffle(items, constantAlmostOne))
  })
})
