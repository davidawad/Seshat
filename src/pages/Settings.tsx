import { useId } from 'react'
import '../features/settings/settings.css'
import { useSeshatStore } from '../lib/store'
import {
  RETENTION_PRESETS,
  retentionPresetSchema,
  themeSchema,
  typefaceSchema,
  type RetentionPreset,
  type Settings,
  type Theme,
  type Typeface,
} from '../types'

// ---------------------------------------------------------------------------
// Static copy — kept out of JSX so the render function stays about layout.
// ---------------------------------------------------------------------------

const TYPEFACE_LABELS: Record<Typeface, string> = {
  'atkinson-hyperlegible': 'Atkinson Hyperlegible',
  verdana: 'Verdana',
  inter: 'Inter',
  'source-serif-4': 'Source Serif 4',
  georgia: 'Georgia',
}

const TYPEFACE_DESCRIPTIONS: Record<Typeface, string> = {
  'atkinson-hyperlegible': 'Maximum character distinction — designed for low-vision readers.',
  verdana: 'A reliable general-purpose screen face.',
  inter: 'A modern UI face, also comfortable for reading.',
  'source-serif-4': 'A serif built for long-form reading on screen and in PDF.',
  georgia: 'A classic, widely available serif for long-form reading.',
}

// Maps directly onto tokens.css's [data-typeface="..."] selectors, so the
// preview renders in the same font the app would actually use.
const TYPEFACE_PREVIEW_STYLE: Record<Typeface, string> = {
  'atkinson-hyperlegible': 'var(--font-atkinson)',
  verdana: 'var(--font-verdana)',
  inter: 'var(--font-inter)',
  'source-serif-4': 'var(--font-source-serif)',
  georgia: 'var(--font-georgia)',
}

const PREVIEW_TEXT = 'The quick brown fox jumps over the lazy dog — 0123456789.'

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Match system',
}

const RETENTION_PRESET_LABELS: Record<RetentionPreset, string> = {
  'low-workload': 'Low workload (85% retention)',
  balanced: 'Balanced (90% retention)',
  'exam-prep': 'Exam prep (93% retention)',
  custom: 'Custom',
}

// ---------------------------------------------------------------------------
// Small field components — one per Settings key, each a real labeled,
// keyboard-operable form control.
// ---------------------------------------------------------------------------

interface FieldProps {
  readonly settings: Settings
  readonly updateSettings: (patch: Partial<Settings>) => void
}

const TypefaceField = ({ settings, updateSettings }: FieldProps) => {
  const groupId = useId()
  return (
    <fieldset>
      <legend>Typeface</legend>
      <p id={groupId} className="field-hint">
        Font choice varies by reader — compare the preview text below and pick what's most legible to you.
      </p>
      <div className="settings-option-list" role="radiogroup" aria-describedby={groupId}>
        {typefaceSchema.options.map((typeface) => {
          const inputId = `typeface-${typeface}`
          return (
            <label key={typeface} className="settings-option" htmlFor={inputId}>
              <input
                type="radio"
                id={inputId}
                name="typeface"
                value={typeface}
                checked={settings.typeface === typeface}
                onChange={() => updateSettings({ typeface })}
              />
              <span className="settings-option-body">
                <span className="settings-option-title">{TYPEFACE_LABELS[typeface]}</span>
                <span className="field-hint">{TYPEFACE_DESCRIPTIONS[typeface]}</span>
                <span className="settings-preview" style={{ fontFamily: TYPEFACE_PREVIEW_STYLE[typeface] }}>
                  {PREVIEW_TEXT}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

const FontSizeField = ({ settings, updateSettings }: FieldProps) => {
  const inputId = useId()
  return (
    <div className="settings-field">
      <label htmlFor={inputId}>Body text size ({settings.bodyFontSizePt.toFixed(1)}pt)</label>
      <input
        id={inputId}
        type="range"
        min={11.5}
        max={13}
        step={0.1}
        value={settings.bodyFontSizePt}
        onChange={(event) => updateSettings({ bodyFontSizePt: Number(event.target.value) })}
      />
      <p
        className="settings-preview"
        style={{ fontSize: `${settings.bodyFontSizePt}pt`, lineHeight: settings.lineHeight }}
      >
        {PREVIEW_TEXT}
      </p>
    </div>
  )
}

const LineHeightField = ({ settings, updateSettings }: FieldProps) => {
  const inputId = useId()
  return (
    <div className="settings-field">
      <label htmlFor={inputId}>Line height ({settings.lineHeight.toFixed(2)})</label>
      <input
        id={inputId}
        type="range"
        min={1.4}
        max={1.5}
        step={0.01}
        value={settings.lineHeight}
        onChange={(event) => updateSettings({ lineHeight: Number(event.target.value) })}
      />
    </div>
  )
}

const MeasureField = ({ settings, updateSettings }: FieldProps) => {
  const inputId = useId()
  return (
    <div className="settings-field">
      <label htmlFor={inputId}>Line length ({settings.measureCh} characters)</label>
      <input
        id={inputId}
        type="range"
        min={55}
        max={75}
        step={1}
        value={settings.measureCh}
        onChange={(event) => updateSettings({ measureCh: Number(event.target.value) })}
      />
    </div>
  )
}

const ThemeField = ({ settings, updateSettings }: FieldProps) => (
  <fieldset>
    <legend>Theme</legend>
    <div className="settings-option-list" role="radiogroup">
      {themeSchema.options.map((theme) => {
        const inputId = `theme-${theme}`
        return (
          <label key={theme} className="settings-option settings-option-inline" htmlFor={inputId}>
            <input
              type="radio"
              id={inputId}
              name="theme"
              value={theme}
              checked={settings.theme === theme}
              onChange={() => updateSettings({ theme })}
            />
            <span>{THEME_LABELS[theme]}</span>
          </label>
        )
      })}
    </div>
  </fieldset>
)

const ReducedMotionField = ({ settings, updateSettings }: FieldProps) => {
  const inputId = useId()
  return (
    <div className="settings-field">
      <label className="settings-option-inline" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          checked={settings.reducedMotion}
          onChange={(event) => updateSettings({ reducedMotion: event.target.checked })}
        />
        <span>Reduce motion (in addition to your OS setting)</span>
      </label>
    </div>
  )
}

const RetentionField = ({ settings, updateSettings }: FieldProps) => {
  const customInputId = useId()
  return (
    <fieldset>
      <legend>Retention target</legend>
      <p className="field-hint">
        Higher retention means more, harder reviews. See <code>research/learning-science</code> for the
        Anki/FSRS-guidance sources behind these presets.
      </p>
      <div className="settings-option-list" role="radiogroup">
        {retentionPresetSchema.options.map((preset) => {
          const inputId = `retention-${preset}`
          return (
            <label key={preset} className="settings-option-inline" htmlFor={inputId}>
              <input
                type="radio"
                id={inputId}
                name="retention-preset"
                value={preset}
                checked={settings.retentionPreset === preset}
                onChange={() => {
                  if (preset === 'custom') {
                    updateSettings({ retentionPreset: preset })
                  } else {
                    updateSettings({ retentionPreset: preset, desiredRetention: RETENTION_PRESETS[preset] })
                  }
                }}
              />
              <span>{RETENTION_PRESET_LABELS[preset]}</span>
            </label>
          )
        })}
      </div>
      {settings.retentionPreset === 'custom' && (
        <div className="settings-field">
          <label htmlFor={customInputId}>Desired retention ({Math.round(settings.desiredRetention * 100)}%)</label>
          <input
            id={customInputId}
            type="number"
            min={0.7}
            max={0.98}
            step={0.01}
            value={settings.desiredRetention}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (Number.isNaN(value)) return
              updateSettings({ desiredRetention: value })
            }}
          />
        </div>
      )}
    </fieldset>
  )
}

// ---------------------------------------------------------------------------

export const SettingsPage = () => {
  const { state, updateSettings } = useSeshatStore()
  const { settings } = state
  const fieldProps: FieldProps = { settings, updateSettings }

  return (
    <section aria-labelledby="settings-heading">
      <h1 id="settings-heading">Settings</h1>
      <p>
        Typography and legibility research shows there's no universal winner — pick what's legible to you and adjust
        study workload to taste.
      </p>
      <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
        <TypefaceField {...fieldProps} />
        <FontSizeField {...fieldProps} />
        <LineHeightField {...fieldProps} />
        <MeasureField {...fieldProps} />
        <ThemeField {...fieldProps} />
        <ReducedMotionField {...fieldProps} />
        <RetentionField {...fieldProps} />
      </form>
    </section>
  )
}
