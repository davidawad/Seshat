/**
 * Fisher-Yates shuffle. Pure and injectable-random so it's deterministically
 * unit-testable — the default `Math.random` source is only used at the call
 * site (session start), never inside the algorithm itself.
 */
export const shuffle = <T>(items: readonly T[], random: () => number = Math.random): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = result[i] as T
    result[i] = result[j] as T
    result[j] = swap
  }
  return result
}
