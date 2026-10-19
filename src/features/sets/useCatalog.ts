import { useEffect, useState } from 'react'
import { type Catalog, loadCatalog } from './catalog'

/** `null` while loading; the catalog never rejects (bad files are reported inside it). */
export const useCatalog = (): Catalog | null => {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  useEffect(() => {
    let live = true
    void loadCatalog().then((loaded) => {
      if (live) setCatalog(loaded)
    })
    return () => {
      live = false
    }
  }, [])
  return catalog
}
