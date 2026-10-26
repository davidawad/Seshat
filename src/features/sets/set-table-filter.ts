import type { StudySet } from '../../types'

/** Table filter predicate: the (trimmed, case-insensitive) needle appears in the set's name or any tag. */
export const rowMatchesFilter = ({ set }: { readonly set: StudySet }, filter: string): boolean => {
  const needle = filter.trim().toLowerCase()
  return (
    needle.length === 0 ||
    set.name.toLowerCase().includes(needle) ||
    set.tags.some((tag) => tag.toLowerCase().includes(needle))
  )
}
