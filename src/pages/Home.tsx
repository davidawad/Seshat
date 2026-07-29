import { Link } from 'react-router-dom'
import './home.css'

export const HomePage = () => (
  <section aria-labelledby="home-heading">
    <p className="home-eyebrow">Free &amp; open source</p>
    <h1 id="home-heading">Seshat is a flashcard app built on what actually works.</h1>
    <p className="home-lede">
      Not streaks. Not hearts. Not a proprietary &ldquo;Memory Score.&rdquo; Every non-trivial decision in here — the
      card formats, the spacing algorithm, the confidence prompt, even the typography — is backed by a citation, and you
      can read the actual paper.
    </p>

    <div className="home-cta-row">
      <Link to="/sets" className="home-cta-primary">
        Browse your sets
      </Link>
    </div>

    <section aria-labelledby="home-why-heading">
      <h2 id="home-why-heading">Why this exists</h2>
      <p>
        I made my own flashcards in Quizlet — the actual studying material, the actual work — and then Quizlet put my
        own flashcards behind a paywall. That&rsquo;s the whole origin story. So I built Seshat instead: free, open
        source, and grounded in the cognitive-science literature on how people actually learn. It&rsquo;s named after
        Seshat, the ancient Egyptian goddess of writing, libraries, record-keeping, and architecture. See{' '}
        <Link to="/docs">Docs</Link> for the longer version, and how your data is stored (short answer: it never leaves
        your browser — there&rsquo;s no server to leave it on).
      </p>
    </section>

    <section aria-labelledby="home-research-heading">
      <h2 id="home-research-heading">The research this is built on</h2>
      <p>
        Full write-ups with verified links live in the <code>research/</code> folder and on the{' '}
        <Link to="/attributions">Attributions</Link> page. Here&rsquo;s the short version.
      </p>

      <h3>How memory actually works</h3>
      <dl className="home-citation-list">
        <div>
          <dt>Spaced practice beats cramming, by a lot</dt>
          <dd>
            Distributed practice has the largest effect size of ten commonly studied learning techniques (d = 0.85, 242
            studies) — bigger than practice testing (d = 0.74), which is itself far ahead of highlighting or rereading.
            Donoghue &amp; Hattie, 2021.
          </dd>
        </div>
        <div>
          <dt>Producing an answer beats recognizing one</dt>
          <dd>
            Actively retrieving an answer from memory produces better retention than restudying it (d ≈ 0.50 pooled
            across 61 studies) — and cued/free recall (g ≈ 0.72–0.82) beats multiple-choice recognition (g ≈ 0.36). This
            is why Seshat defaults to short-answer and cloze cards, not flip-and-guess. Rowland, 2014.
          </dd>
        </div>
        <div>
          <dt>Current performance lies to you about what you&rsquo;ve learned</dt>
          <dd>
            Conditions that feel easy in the moment (massed practice, passive rereading) often produce worse long-term
            retention than conditions that feel harder (spacing, retrieval, self-generation) — the &ldquo;desirable
            difficulties&rdquo; effect. It&rsquo;s why Seshat tracks confidence against actual correctness instead of
            optimizing for how smooth a session feels. Bjork &amp; Bjork, 1992.
          </dd>
        </div>
      </dl>

      <h3>How to actually read the cards</h3>
      <dl className="home-citation-list">
        <div>
          <dt>There is no single &ldquo;best font&rdquo;</dt>
          <dd>
            In a large crowdsourced study across 16 fonts, reading speed varied 35% between each person&rsquo;s fastest
            and slowest font — with no comprehension loss — and people&rsquo;s preferred font was rarely their fastest
            one. This is why Seshat makes typeface a first-class setting instead of hard-coding one. Wallace et al.,
            2022.
          </dd>
        </div>
        <div>
          <dt>Low-vision readers need uniform stroke width, not just &ldquo;no serifs&rdquo;</dt>
          <dd>
            For readers with low vision, low stroke-width contrast (not serif-vs-sans-serif) was the more decisive
            legibility variable — the design principle behind Atkinson Hyperlegible, Seshat&rsquo;s default typeface.
            Minakata et al., 2023.
          </dd>
        </div>
        <div>
          <dt>Line length and spacing are not cosmetic</dt>
          <dd>
            WCAG 2.1&rsquo;s text-spacing success criterion sets concrete minimums — line height ≥1.5×, paragraph
            spacing ≥2×, letter spacing ≥0.12× font size — because cramped text measurably costs low-vision readers
            comprehension. Seshat&rsquo;s line-height and measure controls in Settings are built around this. W3C, WCAG
            2.1 SC 1.4.12.
          </dd>
        </div>
      </dl>
    </section>

    <section aria-labelledby="home-how-heading">
      <h2 id="home-how-heading">How it works, in practice</h2>
      <p>
        <strong>Recall-first:</strong> short-answer and cloze cards ask you to produce an answer, not recognize one.{' '}
        <strong>FSRS scheduling:</strong> a trainable per-card, per-learner model decides when you&rsquo;re about to
        forget something, instead of a fixed interval table. <strong>Confidence calibration:</strong> you rate how sure
        you were before you see if you were right, and Seshat shows you the gap. See <Link to="/docs">Docs</Link> for
        the full explanation, or jump straight to your <Link to="/sets">sets</Link>.
      </p>
    </section>
  </section>
)
