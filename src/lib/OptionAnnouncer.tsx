interface OptionAnnouncerProps {
  readonly index: number | null
  readonly labels: readonly string[]
}

/** Visually-hidden polite live region: "Option 2 of 4: <text>" for the highlighted option (empty when none). */
export const OptionAnnouncer = ({ index, labels }: OptionAnnouncerProps) => (
  <p role="status" aria-live="polite" className="sr-only">
    {index === null || labels[index] === undefined ? '' : `Option ${index + 1} of ${labels.length}: ${labels[index]}`}
  </p>
)
