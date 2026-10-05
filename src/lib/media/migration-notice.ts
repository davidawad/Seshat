import type { MigrationOutcome } from './migrate'

/** A one-off, non-blocking message about what the boot migration did. */
export interface MigrationNotice {
  readonly tone: 'info' | 'warning'
  readonly text: string
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

export const noticeFor = (outcome: MigrationOutcome): MigrationNotice | null => {
  switch (outcome.status) {
    case 'not-needed':
      return null
    case 'migrated':
      return outcome.images === 0
        ? null
        : {
            tone: 'info',
            text: `Seshat moved ${plural(outcome.images, 'image')} into its new image storage. A copy of your previous data is kept; you can restore it under Settings.`,
          }
    case 'failed':
      return {
        tone: 'warning',
        text: `Seshat could not finish upgrading how it stores your images (${outcome.message}). Nothing was lost: your data is unchanged and still works. It will try again next time you open Seshat.`,
      }
  }
}

let current: MigrationNotice | null = null
const listeners = new Set<() => void>()

export const getMigrationNotice = (): MigrationNotice | null => current

export const setMigrationNotice = (notice: MigrationNotice | null): void => {
  current = notice
  for (const listener of listeners) listener()
}

export const subscribeMigrationNotice = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
