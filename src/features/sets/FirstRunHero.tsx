import { Link } from 'react-router-dom'
import { TESTIDS } from '../../lib/testids'
import { type StarterSet, STARTER_SETS } from './starter-sets'
import { TRY_SAMPLE_SET } from './try-sample'
import './first-run-hero.css'

interface FirstRunHeroProps {
  /** Called with the set to add (the neutral sample, or one of the "More examples"). */
  readonly onLoad: (set: StarterSet['set']) => void
}

/**
 * The empty Home: what Seshat is, where the cards live, and three ways to get a first
 * set (import from Quizlet, create one, or try a bundled 10-card sample). The niche
 * example decks sit behind a disclosure so they do not read as the product.
 */
export const FirstRunHero = ({ onLoad }: FirstRunHeroProps) => (
  <div className="first-run" data-testid={TESTIDS.setsBrowserHero}>
    <p className="first-run-promise">Research-backed spaced repetition. Your cards stay on this device.</p>
    <p className="first-run-privacy" data-testid={TESTIDS.setsBrowserPrivacy}>
      No account and no server: everything is saved in this browser, and Settings can export a backup.{' '}
      <Link to="/about">See the research</Link>.
    </p>
    <div className="first-run-actions">
      <Link to="/sets/import" className="first-run-cta" data-testid={TESTIDS.setsBrowserHeroImport}>
        <span className="first-run-cta-title">Import from Quizlet</span>
        <span className="first-run-cta-hint">Paste an export or upload a file</span>
      </Link>
      <Link to="/sets/new" className="first-run-cta" data-testid={TESTIDS.setsBrowserHeroCreate}>
        <span className="first-run-cta-title">Create a set</span>
        <span className="first-run-cta-hint">Type your own terms</span>
      </Link>
      <button
        type="button"
        className="first-run-cta"
        data-testid={TESTIDS.setsBrowserSampleLoad}
        onClick={() => onLoad(TRY_SAMPLE_SET)}
      >
        <span className="first-run-cta-title">Try a 10-card sample</span>
        <span className="first-run-cta-hint">General knowledge, ready to study</span>
      </button>
    </div>
    <details className="first-run-more" data-testid={TESTIDS.setsBrowserMoreExamples}>
      <summary>More examples</summary>
      <ul className="starter-set-list">
        {STARTER_SETS.map((starter) => (
          <li key={starter.id}>
            <button type="button" data-testid={TESTIDS.setsBrowserStarterLoad} onClick={() => onLoad(starter.set)}>
              Load: {starter.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  </div>
)
