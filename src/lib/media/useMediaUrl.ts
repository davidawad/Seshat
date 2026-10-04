import { useEffect, useState } from 'react'
import { acquireMediaUrl, type UrlHandle } from './media-url-cache'
import { useMediaStore } from './MediaStoreProvider'
import type { MediaRef } from './types'

type MediaUrlStatus = 'loading' | 'ready' | 'missing'

export interface MediaUrlState {
  readonly url: string | null
  readonly status: MediaUrlStatus
}

export const MEDIA_RETRY_DELAY_MS = 250

interface Resolved {
  readonly id: string
  readonly state: MediaUrlState
}

/**
 * Object URL for a stored image. Shared and ref-counted across components
 * (revoked when the last user unmounts); a missing blob is retried once, since
 * it may be mid-write in another tab.
 */
export const useMediaUrl = (media: Pick<MediaRef, 'id'> | null | undefined): MediaUrlState => {
  const store = useMediaStore()
  const id = media?.id
  const [resolved, setResolved] = useState<Resolved | null>(null)

  useEffect(() => {
    if (id === undefined) return
    let cancelled = false
    let handle: UrlHandle | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    const attempt = (retriesLeft: number): void => {
      const current = acquireMediaUrl(store, id)
      handle = current
      void current.promise.then((url) => {
        if (cancelled) return current.release()
        if (url) return setResolved({ id, state: { url, status: 'ready' } })
        current.release()
        handle = null
        if (retriesLeft > 0) {
          timer = setTimeout(() => attempt(retriesLeft - 1), MEDIA_RETRY_DELAY_MS)
        } else {
          setResolved({ id, state: { url: null, status: 'missing' } })
        }
      })
    }
    attempt(1)

    return () => {
      cancelled = true
      clearTimeout(timer)
      handle?.release()
    }
  }, [store, id])

  if (id === undefined) return { url: null, status: 'missing' }
  return resolved?.id === id ? resolved.state : { url: null, status: 'loading' }
}
