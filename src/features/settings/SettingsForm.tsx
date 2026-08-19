import { useId } from 'react'
import { Combobox } from '../../components/Combobox'
import './settings.css'
import { KeybindingsField } from './KeybindingsField'
import { useSeshatStore } from '../../lib/store'
import {
  RETENTION_PRESETS,
  retentionPresetSchema,
  themeSchema,
  typefaceSchema,
  type RetentionPreset,
  type Settings,
  type Theme,
  type Typeface,
} from '../../types'

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

const TYPEFACE_OPTIONS = typefaceSchema.options.map((typeface) => ({
  value: typeface,
  label: TYPEFACE_LABELS[typeface],
}))

const PREVIEW_TEXT = 'The quick brown fox jumps over the lazy dog — 0123456789.'

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Match system',
}

const THEME_OPTIONS = themeSchema.options.map((theme) => ({ value: theme, label: THEME_LABELS[theme] }))

const RETENTION_PRESET_LABELS: Record<RetentionPreset, string> = {
  'low-workload': 'Low workload (85% retention)',
  balanced: 'Balanced (90% retention)',
  'exam-prep': 'Exam prep (93% retention)',
  custom: 'Custom',
}

const RETENTION_PRESET_OPTIONS = retentionPresetSchema.options.map((preset) => ({
  value: preset,
  label: RETENTION_PRESET_LABELS[preset],
}))

// ---------------------------------------------------------------------------
// Small field components — one per Settings key, each a real labeled,
// keyboard-operable form control.
// ---------------------------------------------------------------------------

interface FieldProps {
  readonly settings: Settings
  readonly updateSettings: (patch: Partial<Settings>) => void
}

const TypefaceField = ({ settings, updateSettings }: FieldProps) => {
  const selectId = useId()
  const hintId = useId()
  return (
    <div className="settings-field">
      <label htmlFor={selectId}>Typeface</label>
      <p id={hintId} className="field-hint">
        Font choice varies by reader — {TYPEFACE_DESCRIPTIONS[settings.typeface].toLowerCase()}
      </p>
      <Combobox
        id={selectId}
        value={settings.typeface}
        onChange={(typeface) => updateSettings({ typeface })}
        options={TYPEFACE_OPTIONS}
        aria-describedby={hintId}
      />
      <p className="settings-preview" style={{ fontFamily: TYPEFACE_PREVIEW_STYLE[settings.typeface] }}>
        {PREVIEW_TEXT}
      </p>
    </div>
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

const ThemeField = ({ settings, updateSettings }: FieldProps) => {
  const selectId = useId()
  return (
    <div className="settings-field">
      <label htmlFor={selectId}>Theme</label>
      <Combobox
        id={selectId}
        value={settings.theme}
        onChange={(theme) => updateSettings({ theme })}
        options={THEME_OPTIONS}
      />
    </div>
  )
}

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
  const selectId = useId()
  const customInputId = useId()
  return (
    <div className="settings-field">
      <label htmlFor={selectId}>Retention target</label>
      <p className="field-hint">
        Higher retention means more, harder reviews. See <code>research/learning-science</code> for the
        Anki/FSRS-guidance sources behind these presets.
      </p>
      <Combobox
        id={selectId}
        value={settings.retentionPreset}
        onChange={(preset) => {
          if (preset === 'custom') {
            updateSettings({ retentionPreset: preset })
          } else {
            updateSettings({ retentionPreset: preset, desiredRetention: RETENTION_PRESETS[preset] })
          }
        }}
        options={RETENTION_PRESET_OPTIONS}
      />
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
    </div>
  )
}

const SelfExplanationField = ({ settings, updateSettings }: FieldProps) => {
  const inputId = useId()
  const hintId = useId()
  return (
    <div className="settings-field">
      <label className="settings-option-inline" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          checked={settings.selfExplanationEnabled}
          onChange={(event) => updateSettings({ selfExplanationEnabled: event.target.checked })}
          aria-describedby={hintId}
        />
        <span>Prompt "why is that correct?" after each answer</span>
      </label>
      <p
        id={hintId}
        className="field-hint"
        title="Bisra et al. (2018), Educational Psychology Review — meta-analysis of 69 effect sizes, g = 0.55."
      >
        Off by default — it adds a step to every review. Typing your own explanation of why an answer is correct (not
        just reading one) reliably improves learning: Bisra, Liu, Nesbit, Salimi &amp; Winne (2018),{' '}
        <cite>Inducing Self-Explanation: A Meta-Analysis</cite>, <i>Educational Psychology Review</i> — g = 0.55 across
        69 effect sizes. Nothing you type here is sent anywhere; it's saved locally alongside your review history so you
        can look back on your own reasoning later. See <code>research/learning-science/bisra-2018.md</code>.
      </p>
    </div>
  )
}

const ExperimentalGamesField = ({ settings, updateSettings }: FieldProps) => {
  const inputId = useId()
  const hintId = useId()
  return (
    <div className="settings-field">
      <label className="settings-option-inline" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          checked={settings.experimentalGamesEnabled}
          onChange={(event) => updateSettings({ experimentalGamesEnabled: event.target.checked })}
          aria-describedby={hintId}
        />
        <span>Experimental: Games (Match, Blast, Blocks)</span>
      </label>
      <p id={hintId} className="field-hint">
        Arcade-style practice modes — fun, ungraded, and separate from the FSRS-scheduled study modes. On by default;
        turn off to keep the app to just Study/Flashcards/Test.
      </p>
    </div>
  )
}

const InstallPromptField = ({ settings, updateSettings }: FieldProps) => {
  const inputId = useId()
  const hintId = useId()
  return (
    <div className="settings-field">
      <label className="settings-option-inline" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          checked={settings.installPromptEnabled}
          onChange={(event) => updateSettings({ installPromptEnabled: event.target.checked })}
          aria-describedby={hintId}
        />
        <span>Show the &ldquo;Install Seshat&rdquo; banner</span>
      </label>
      <p id={hintId} className="field-hint">
        Off by default. The banner is a fixed overlay that can sit on top of page content, so it&rsquo;s opt-in rather
        than sprung on everyone. Browsers only offer the install prompt once per page load, so turning this on takes
        effect on your next reload rather than immediately.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------

/** The Settings content itself — rendered inside the large modal opened from the footer (see components/Modal.tsx). */
export const SettingsForm = () => {
  const { state, updateSettings } = useSeshatStore()
  const { settings } = state
  const fieldProps: FieldProps = { settings, updateSettings }

  return (
    <>
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
        <SelfExplanationField {...fieldProps} />
        <ExperimentalGamesField {...fieldProps} />
        <InstallPromptField {...fieldProps} />
        <KeybindingsField />
      </form>
    </>
  )
}
