/** A set's tags as chips (renders nothing when it has none). */
export const SetTags = ({ tags }: { readonly tags: readonly string[] }) =>
  tags.length === 0 ? null : (
    <ul aria-label="Tags" className="tag-chips">
      {tags.map((tag) => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  )
