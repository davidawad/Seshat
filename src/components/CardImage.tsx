import { MediaImage, type MediaRef } from '../lib/media'

interface CardImageProps {
  /** The stored image (IndexedDB media store); wins when present. */
  readonly image?: MediaRef | null | undefined
  /** LEGACY inline data URL, shown only when there is no `image` (data not migrated yet). */
  readonly imageDataUrl?: string | undefined
  readonly alt: string
  readonly className?: string
}

/** One card image: a MediaRef when the card has one, else the legacy data URL, else nothing. */
export const CardImage = ({ image, imageDataUrl, alt, className }: CardImageProps) => {
  if (image) return <MediaImage media={image} alt={alt} {...(className === undefined ? {} : { className })} />
  if (imageDataUrl !== undefined) {
    return <img src={imageDataUrl} alt={alt} {...(className === undefined ? {} : { className })} />
  }
  return null
}
