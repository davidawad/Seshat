import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMediaStore } from './media/MediaStoreProvider'
import { useSeshatStore } from './store'
import { type WebMcpDeps, detectModelContext, registerWebMcpTools } from './webmcp'

/**
 * Mounts Seshat's WebMCP tools (see `webmcp.ts`) once for the app's
 * lifetime. A ref refreshed after every render hands tool calls the CURRENT
 * store, so the one-time registration never reads stale state; the effect's
 * cleanup unregisters, which keeps React StrictMode's double-mount from
 * leaving duplicates behind. Does nothing where WebMCP is unavailable.
 */
export const useWebMcp = (): void => {
  const store = useSeshatStore()
  const media = useMediaStore()
  const navigate = useNavigate()
  const depsRef = useRef<WebMcpDeps>({ store, media, navigate, now: () => new Date() })

  useEffect(() => {
    depsRef.current = { store, media, navigate, now: () => new Date() }
  })

  useEffect(() => registerWebMcpTools(detectModelContext(), () => depsRef.current), [])
}
