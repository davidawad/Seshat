import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearMirrors } from '../../lib/persistence'
import { SeshatProvider } from '../../lib/store'
import { STORAGE_KEY } from '../../lib/storage'
import { dismissTip, isTipDismissed } from '../../lib/tipDismissal'
import { SettingsForm } from './SettingsForm'

afterEach(() => cleanup())

beforeEach(() => {
  window.localStorage.clear()
  clearMirrors() // settings are also mirrored to a cookie that would otherwise leak between tests
})

const stored = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').settings

describe('SettingsForm study-step flags', () => {
  it('both checkboxes default off, toggle, and persist', async () => {
    const user = userEvent.setup()
    render(
      <SeshatProvider>
        <SettingsForm />
      </SeshatProvider>,
    )
    const confidence = screen.getByRole('checkbox', { name: /how confident are you/i })
    const selfRating = screen.getByRole('checkbox', { name: /rate how well i recalled/i })
    expect(confidence).not.toBeChecked()
    expect(selfRating).not.toBeChecked()

    await user.click(confidence)
    await user.click(selfRating)
    expect(confidence).toBeChecked()
    expect(selfRating).toBeChecked()
    expect(stored()).toMatchObject({ confidencePromptEnabled: true, selfRatingPromptEnabled: true })

    await user.click(confidence)
    expect(stored()).toMatchObject({ confidencePromptEnabled: false, selfRatingPromptEnabled: true })
  })

  it('shows each flag with its research citation and file path under it', () => {
    render(
      <SeshatProvider>
        <SettingsForm />
      </SeshatProvider>,
    )
    expect(screen.getByRole('checkbox', { name: /how confident are you/i })).toHaveAccessibleDescription(
      /janssen.*lazonder.*g = 0\.25.*janssen-lazonder-2024\.md/is,
    )
    expect(screen.getByRole('checkbox', { name: /rate how well i recalled/i })).toHaveAccessibleDescription(
      /rowland.*rowland-2014\.md/is,
    )
  })
})

describe('SettingsForm card tips', () => {
  it('defaults on, persists when off, and turning it back on revives dismissed tips', async () => {
    const user = userEvent.setup()
    dismissTip('set-preview-flip')
    render(
      <SeshatProvider>
        <SettingsForm />
      </SeshatProvider>,
    )
    const tips = screen.getByRole('checkbox', { name: 'Show card tips' })
    expect(tips).toBeChecked()
    await user.click(tips)
    expect(stored()).toMatchObject({ cardTipsEnabled: false })
    expect(isTipDismissed('set-preview-flip')).toBe(true)
    await user.click(tips)
    expect(stored()).toMatchObject({ cardTipsEnabled: true })
    expect(isTipDismissed('set-preview-flip')).toBe(false)
  })
})
