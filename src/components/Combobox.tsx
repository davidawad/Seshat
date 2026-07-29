export interface ComboboxOption<T extends string> {
  readonly value: T
  readonly label: string
}

export interface ComboboxProps<T extends string> {
  readonly id: string
  readonly value: T
  readonly onChange: (value: T) => void
  readonly options: readonly ComboboxOption<T>[]
  readonly 'aria-describedby'?: string
}

/**
 * The one reusable dropdown for every "pick one of a small fixed set of
 * named options" choice in the app — card kind, typeface, theme, retention
 * preset. A styled native `<select>` rather than a hand-rolled ARIA
 * combobox widget: the platform one already implements the full
 * keyboard/screen-reader combobox pattern correctly, for free.
 */
export const Combobox = <T extends string>({ id, value, onChange, options, ...rest }: ComboboxProps<T>) => (
  <select
    id={id}
    className="combobox"
    value={value}
    onChange={(event) => onChange(event.target.value as T)}
    aria-describedby={rest['aria-describedby']}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
)
