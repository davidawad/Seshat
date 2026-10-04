import type { CSSProperties } from 'react'
import './media-image.css'
import type { MediaRef } from './types'
import { useMediaUrl } from './useMediaUrl'

interface MediaImageProps {
  readonly media: MediaRef
  /** Overrides `media.alt` (ignored for decorative images). */
  readonly alt?: string
  readonly className?: string
}

/** Stored image with intrinsic size reserved up front (no layout shift), a loading skeleton and a missing-image placeholder. */
export function MediaImage({ media, alt, className }: MediaImageProps) {
  const { url, status } = useMediaUrl(media)
  const classes = (state: string) => ['media-image', `media-image--${state}`, className].filter(Boolean).join(' ')
  const style: CSSProperties = { aspectRatio: `${media.width} / ${media.height}` }
  const label = media.decorative ? '' : (alt ?? media.alt)

  if (status === 'ready' && url) {
    return (
      <img src={url} alt={label} width={media.width} height={media.height} style={style} className={classes('ready')} />
    )
  }
  if (status === 'missing') {
    return (
      <span role="img" aria-label="Image unavailable" style={style} className={classes('missing')}>
        Image unavailable
      </span>
    )
  }
  return <span aria-hidden="true" style={style} className={classes('loading')} />
}
