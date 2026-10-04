import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acquireMediaUrl } from './media-url-cache'
import { createDefaultMediaStore } from './default-store'
import { MediaImage } from './MediaImage'
import { MediaStoreProvider, useMediaStore } from './MediaStoreProvider'
import { createMemoryMediaStore, MediaStoreError, type MediaStore } from './store'
import type { MediaRef } from './types'
import { MEDIA_RETRY_DELAY_MS, useMediaUrl } from './useMediaUrl'

let counter = 0
const created: string[] = []
const revoked: string[] = []

beforeEach(() => {
  counter = 0
  created.length = 0
  revoked.length = 0
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:test/${(counter += 1)}`
    created.push(url)
    return url
  })
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url)
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const putImage = async (store: MediaStore, extra: { alt?: string; decorative?: boolean } = {}) =>
  store.put(new Blob(['pixels'], { type: 'image/png' }), { width: 40, height: 30, ...extra })

const wrapper = (store: MediaStore) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MediaStoreProvider store={store}>{children}</MediaStoreProvider>
  }

describe('useMediaUrl', () => {
  it('resolves a stored image to an object URL and revokes on unmount', async () => {
    const store = createMemoryMediaStore()
    const ref = await putImage(store)
    const { result, unmount } = renderHook(() => useMediaUrl(ref), { wrapper: wrapper(store) })
    expect(result.current).toEqual({ url: null, status: 'loading' })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.url).toBe('blob:test/1')
    expect(revoked).toEqual([])
    unmount()
    expect(revoked).toEqual(['blob:test/1'])
  })

  it('shares one URL between users and revokes only after the last unmounts', async () => {
    const store = createMemoryMediaStore()
    const ref = await putImage(store)
    const a = renderHook(() => useMediaUrl(ref), { wrapper: wrapper(store) })
    const b = renderHook(() => useMediaUrl(ref), { wrapper: wrapper(store) })
    await waitFor(() => expect(a.result.current.status).toBe('ready'))
    await waitFor(() => expect(b.result.current.status).toBe('ready'))
    expect(created).toHaveLength(1)
    a.unmount()
    expect(revoked).toEqual([])
    b.unmount()
    expect(revoked).toEqual(['blob:test/1'])
  })

  it('reports missing after one retry', async () => {
    vi.useFakeTimers()
    const store = createMemoryMediaStore()
    const get = vi.spyOn(store, 'get')
    const { result } = renderHook(() => useMediaUrl({ id: 'f'.repeat(64) }), { wrapper: wrapper(store) })
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.status).toBe('loading')
    await act(() => vi.advanceTimersByTimeAsync(MEDIA_RETRY_DELAY_MS + 10))
    expect(result.current).toEqual({ url: null, status: 'missing' })
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('recovers when the blob appears before the retry', async () => {
    vi.useFakeTimers()
    const store = createMemoryMediaStore()
    const ref = await putImage(store)
    const real = store.get.bind(store)
    let first = true
    vi.spyOn(store, 'get').mockImplementation(async (id) => {
      if (first) {
        first = false
        return null
      }
      return real(id)
    })
    const { result } = renderHook(() => useMediaUrl(ref), { wrapper: wrapper(store) })
    await act(() => vi.advanceTimersByTimeAsync(MEDIA_RETRY_DELAY_MS + 10))
    expect(result.current.status).toBe('ready')
  })

  it('is missing for a null ref, and survives unmount while a lookup is in flight', async () => {
    const store = createMemoryMediaStore()
    expect(renderHook(() => useMediaUrl(null), { wrapper: wrapper(store) }).result.current.status).toBe('missing')
    const ref = await putImage(store)
    const pending = renderHook(() => useMediaUrl(ref), { wrapper: wrapper(store) })
    pending.unmount()
    await act(async () => {
      await Promise.resolve()
    })
    expect(revoked).toEqual(created)
  })

  it('treats a throwing store as missing', async () => {
    vi.useFakeTimers()
    const store = createMemoryMediaStore()
    vi.spyOn(store, 'get').mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useMediaUrl({ id: 'e'.repeat(64) }), { wrapper: wrapper(store) })
    await act(() => vi.advanceTimersByTimeAsync(MEDIA_RETRY_DELAY_MS + 10))
    expect(result.current.status).toBe('missing')
  })
})

describe('acquireMediaUrl', () => {
  it('release is idempotent and a late release after everyone left revokes once', async () => {
    const store = createMemoryMediaStore()
    const ref = await putImage(store)
    const h1 = acquireMediaUrl(store, ref.id)
    const h2 = acquireMediaUrl(store, ref.id)
    await h1.promise
    h1.release()
    h1.release()
    expect(revoked).toEqual([])
    h2.release()
    expect(revoked).toEqual(['blob:test/1'])
  })

  it('revokes immediately when everyone released before the blob arrived', async () => {
    const store = createMemoryMediaStore()
    const ref = await putImage(store)
    const h = acquireMediaUrl(store, ref.id)
    h.release()
    expect(await h.promise).toBeNull()
    expect(revoked).toEqual(created)
  })
})

describe('MediaImage', () => {
  const refOf = (overrides: Partial<MediaRef> = {}): MediaRef => ({
    id: 'c'.repeat(64),
    mime: 'image/png',
    width: 40,
    height: 30,
    bytes: 6,
    alt: 'ref alt',
    decorative: false,
    ...overrides,
  })

  it('shows a skeleton, then the image with intrinsic size and alt from the ref', async () => {
    const store = createMemoryMediaStore()
    const ref = await putImage(store, { alt: 'a diagram' })
    const { container } = render(<MediaImage media={ref} className="extra" />, { wrapper: wrapper(store) })
    expect(container.querySelector('.media-image--loading')).toHaveStyle({ aspectRatio: '40 / 30' })
    const img = await screen.findByRole('img', { name: 'a diagram' })
    expect(img).toHaveAttribute('width', '40')
    expect(img).toHaveAttribute('height', '30')
    expect(img).toHaveAttribute('src', 'blob:test/1')
    expect(img).toHaveClass('media-image', 'extra')
  })

  it('lets an alt prop override, and renders decorative images with empty alt', async () => {
    const store = createMemoryMediaStore()
    const ref = await putImage(store, { alt: 'orig' })
    const { rerender, container } = render(<MediaImage media={ref} alt="override" />, { wrapper: wrapper(store) })
    expect(await screen.findByRole('img', { name: 'override' })).toBeInTheDocument()
    rerender(<MediaImage media={{ ...ref, decorative: true }} alt="override" />)
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('alt', ''))
  })

  it('shows an accessible placeholder when the image is missing', async () => {
    vi.useFakeTimers()
    const store = createMemoryMediaStore()
    render(<MediaImage media={refOf()} />, { wrapper: wrapper(store) })
    await act(() => vi.advanceTimersByTimeAsync(MEDIA_RETRY_DELAY_MS + 10))
    const placeholder = screen.getByRole('img', { name: 'Image unavailable' })
    expect(placeholder).toHaveTextContent('Image unavailable')
    expect(placeholder).toHaveStyle({ aspectRatio: '40 / 30' })
  })
})

describe('MediaStoreProvider / useMediaStore', () => {
  it('provides the given store', () => {
    const store = createMemoryMediaStore()
    const { result } = renderHook(() => useMediaStore(), { wrapper: wrapper(store) })
    expect(result.current).toBe(store)
  })

  it('defaults to a shared lazily-created store that falls back to memory without IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const { result } = renderHook(() => useMediaStore())
    const ref = await putImage(result.current)
    expect(await result.current.has(ref.id)).toBe(true)
    const again = renderHook(() => useMediaStore(), {
      wrapper: ({ children }) => <MediaStoreProvider>{children}</MediaStoreProvider>,
    })
    expect(again.result.current).toBe(result.current)
  })
})

describe('createDefaultMediaStore', () => {
  const unavailable = (): MediaStore => ({
    ...createMemoryMediaStore(),
    has: () => Promise.reject(new MediaStoreError('unavailable', 'no idb')),
  })

  it('uses the fallback when the primary is unavailable, choosing once', async () => {
    const fallback = createMemoryMediaStore()
    const makeFallback = vi.fn(() => fallback)
    const store = createDefaultMediaStore(unavailable, makeFallback)
    const ref = await putImage(store)
    expect(await fallback.has(ref.id)).toBe(true)
    expect(await store.get(ref.id)).not.toBeNull()
    expect((await store.list()).length).toBe(1)
    expect((await store.usage()).count).toBe(1)
    await store.delete(ref.id)
    expect(await store.has(ref.id)).toBe(false)
    expect(makeFallback).toHaveBeenCalledOnce()
  })

  it('keeps the primary on other errors or success', async () => {
    const primary = createMemoryMediaStore()
    const store = createDefaultMediaStore(
      () => primary,
      () => createMemoryMediaStore(),
    )
    const ref = await putImage(store)
    expect(await primary.has(ref.id)).toBe(true)
    const flaky: MediaStore = { ...createMemoryMediaStore(), has: () => Promise.reject(new Error('other')) }
    const kept = createDefaultMediaStore(
      () => flaky,
      () => createMemoryMediaStore(),
    )
    await expect(kept.has('0'.repeat(64))).rejects.toThrow('other')
  })
})
