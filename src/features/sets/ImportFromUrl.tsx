import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { parseImportParam } from './url-import'

/**
 * Mounted once near the top of `Layout.tsx` so it fires on every page,
 * regardless of which route the `?import=` param happens to be appended
 * to. Handles Seshat's URL query-param import: visit any URL with a set's
 * JSON in `import` (see `url-import.ts` for the exact decode/validate
 * contract, `AGENTS.md`/`public/agents.txt` for the external docs) and land
 * on the newly-imported set with no file upload or console scripting.
 *
 * Renders nothing in the overwhelmingly common case (no `import` param) —
 * only ever renders an inline error banner, and only after a present-but-
 * unparseable param. The error banner is scoped to the page it appeared
 * on: since this component lives in `Layout.tsx` outside `<Outlet>`, it
 * never remounts on route changes, so an error from a failed import link
 * would otherwise keep showing after the learner navigates away to
 * unrelated pages — the pathname-tracking effect below clears it instead.
 */
export const ImportFromUrl = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { importSet } = useSeshatStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  // Layout mounts once for the whole app's lifetime (it wraps every route,
  // and react-router doesn't remount it on nested navigation), so this
  // guards against the param being re-processed if this effect re-fires
  // for any other reason before the param removal below has taken effect.
  const handledRef = useRef(false)
  const errorPathnameRef = useRef<string | null>(null)

  // Dismiss a standing error banner as soon as the learner navigates to a
  // different page than the one the failed import link left them on —
  // don't let it silently persist across a route change.
  useEffect(() => {
    if (errorPathnameRef.current !== null && errorPathnameRef.current !== location.pathname) {
      setError(null)
      errorPathnameRef.current = null
    }
  }, [location.pathname])

  useEffect(() => {
    if (handledRef.current) return
    const result = parseImportParam(searchParams.get('import'))
    if (result === null) return
    handledRef.current = true

    // Strip `import` immediately regardless of outcome, so a refresh never
    // re-imports and the (possibly large) JSON doesn't linger in the visible
    // URL longer than this one pass. `replace: true` so this never adds a
    // back-button entry of its own.
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('import')
        return next
      },
      { replace: true },
    )

    if (!result.ok) {
      setError(result.error)
      errorPathnameRef.current = location.pathname
      return
    }

    const set = importSet(result.value)
    navigate(`/sets/${set.id}`, { replace: true })
  }, [searchParams, setSearchParams, importSet, navigate, location.pathname])

  if (error === null) return null

  return (
    <p role="alert" className="url-import-error">
      Couldn&apos;t import the set from that link: {error}
    </p>
  )
}
