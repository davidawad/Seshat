import { createContext, useContext, useState, type ReactNode } from 'react'
import { getSharedMediaStore } from './default-store'
import type { MediaStore } from './store'

const MediaStoreContext = createContext<MediaStore | null>(null)

/** Supplies a MediaStore; with no `store` prop, one shared lazily-created IndexedDB store (memory fallback). */
export function MediaStoreProvider({ store, children }: { store?: MediaStore; children: ReactNode }) {
  const [value] = useState<MediaStore>(() => store ?? getSharedMediaStore())
  return <MediaStoreContext.Provider value={value}>{children}</MediaStoreContext.Provider>
}

/** The nearest provided store, or the shared default when there is no provider. */
export const useMediaStore = (): MediaStore => useContext(MediaStoreContext) ?? getSharedMediaStore()
