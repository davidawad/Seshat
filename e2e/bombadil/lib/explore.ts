// The default exploration actions minus keyboard input: Bombadil's `inputs` generator (CDP
// TypeText/PressKey) is replaced by the in-page `typeRandom` and `keyJab` flows. See spec.ts header.
import { weighted } from '@antithesishq/bombadil/browser'
import { back, clicks, forward, reload, scroll, waitOnce } from '@antithesishq/bombadil/browser/defaults/actions'

export const explore = weighted([
  [10, clicks],
  [3, scroll],
  [2, back],
  [1, forward],
  [1, reload],
  [1, waitOnce],
])
