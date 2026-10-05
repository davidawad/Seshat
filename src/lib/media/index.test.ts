import { describe, expect, it } from 'vitest'
import * as media from './index'

describe('media barrel', () => {
  it('exposes the foundation API later tasks build on', () => {
    for (const name of [
      'mediaIdSchema',
      'mediaRefSchema',
      'createMemoryMediaStore',
      'createIdbMediaStore',
      'createDefaultMediaStore',
      'MediaStoreError',
      'MediaStoreProvider',
      'useMediaStore',
      'useMediaUrl',
      'MediaImage',
      'selectOrphans',
      'collectReferencedIds',
      'sha256Hex',
      'processImage',
      'ImagePipelineError',
    ]) {
      expect(Object.keys(media)).toContain(name)
    }
  })
})
