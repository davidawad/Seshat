import { z } from 'zod'

/** Content address of a stored image: lowercase hex SHA-256 of the encoded bytes. */
export const mediaIdSchema = z.string().regex(/^[0-9a-f]{64}$/, 'media id must be 64 lowercase hex chars')

export const mediaMimeSchema = z.enum(['image/webp', 'image/jpeg', 'image/png'])

/** Small reference a card holds instead of the image bytes themselves. */
export const mediaRefSchema = z.object({
  id: mediaIdSchema,
  mime: mediaMimeSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().nonnegative(),
  alt: z.string().default(''),
  decorative: z.boolean().default(false),
})

export type MediaRef = z.infer<typeof mediaRefSchema>
export type MediaMime = z.infer<typeof mediaMimeSchema>

/** One image's bytes as they travel inside a backup / set export (base64, never a data URL). */
export const mediaPayloadSchema = z.object({
  mime: mediaMimeSchema,
  dataBase64: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})
export type MediaPayload = z.infer<typeof mediaPayloadSchema>

/** `media` in backups and set exports: mediaId -> payload. */
export const mediaMapSchema = z.record(mediaIdSchema, mediaPayloadSchema)
export type MediaMap = z.infer<typeof mediaMapSchema>
