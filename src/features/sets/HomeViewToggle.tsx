import { useId } from 'react'
import { GridViewIcon, TableViewIcon } from '../../components/icons'
import { TESTIDS } from '../../lib/testids'
import type { HomeView } from '../../types'

interface HomeViewToggleProps {
  readonly value: HomeView
  readonly onChange: (view: HomeView) => void
}

/**
 * Two icon buttons next to the "Your sets" heading: cards or table. A native
 * radio group, so arrow keys, one tab stop and "n of 2" announcements come
 * for free; the choice is saved in Settings (`homeView`) and applies at once.
 */
export const HomeViewToggle = ({ value, onChange }: HomeViewToggleProps) => {
  const name = useId()
  const option = (view: HomeView, label: string, testId: string, icon: React.ReactNode) => (
    <label className="view-toggle-option" title={label}>
      <input
        type="radio"
        name={name}
        value={view}
        checked={value === view}
        onChange={() => onChange(view)}
        aria-label={label}
        data-testid={testId}
      />
      {icon}
    </label>
  )
  return (
    <div className="view-toggle" role="radiogroup" aria-label="Set view" data-testid={TESTIDS.homeViewToggle}>
      {option('grid', 'Card view', TESTIDS.homeViewGrid, <GridViewIcon />)}
      {option('table', 'Table view', TESTIDS.homeViewTable, <TableViewIcon />)}
    </div>
  )
}
